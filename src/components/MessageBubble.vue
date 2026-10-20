<script setup>
import { computed, ref } from 'vue'
import MarkdownView from './MarkdownView.vue'
import CitationList from './CitationList.vue'
import Icon from './Icon.vue'
import { formatRelative } from '../core/text.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({
  message: { type: Object, required: true },
  streaming: { type: Boolean, default: false },
  modelLabel: { type: String, default: '' },
})

const emit = defineEmits(['cite', 'regenerate'])

const toast = useToast()
const showReasoning = ref(false)

const isUser = computed(() => props.message.role === 'user')
const isStreamingHere = computed(() => props.streaming && props.message.status === 'streaming')
const showTyping = computed(() => isStreamingHere.value && !props.message.content)

const retrievalNote = computed(() => {
  if (isUser.value) return ''
  const reason = props.message.retrieval?.emptyReason
  if (reason === 'no-match') return '资料库里没有检索到与这个问题直接相关的段落，下面的回答主要基于通用数学知识。'
  if (reason === 'scope-empty') return '所选资料还没有解析出文本内容。'
  if (reason === 'empty-query') return '问题里没有可用于检索的关键词，回答基于通用知识。'
  if (props.message.retrieval?.droppedCount > 0) {
    return `受上下文长度限制，有 ${props.message.retrieval.droppedCount} 段资料没有放进本次提问。`
  }
  return ''
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.message.content || '')
    toast.success('已复制回答')
  } catch {
    toast.error('复制失败，请手动选择文本')
  }
}

function openCitation(cite) {
  emit('cite', cite)
}
</script>

<template>
  <article class="msg" :class="[message.role, message.status]">
    <div class="avatar" :class="message.role">
      <template v-if="isUser">我</template>
      <template v-else>Σ</template>
    </div>

    <div class="bubble">
      <div class="meta">
        <span class="who">{{ isUser ? '我' : '复习助手' }}</span>
        <span v-if="!isUser && modelLabel" class="badge">{{ modelLabel }}</span>
        <span v-if="isStreamingHere" class="badge accent">生成中</span>
        <span v-else-if="message.status === 'stopped'" class="badge warn">已停止</span>
        <span v-else-if="message.status === 'error'" class="badge danger">失败</span>
        <span class="time">{{ formatRelative(message.createdAt) }}</span>
      </div>

      <div v-if="!isUser && message.reasoning" class="reasoning">
        <button type="button" class="reason-toggle" @click="showReasoning = !showReasoning">
          <Icon name="sparkle" :size="14" />
          <span>思考过程</span>
          <span class="muted xs">{{ showReasoning ? '收起' : '展开' }}</span>
        </button>
        <div v-if="showReasoning" class="reason-body">{{ message.reasoning }}</div>
      </div>

      <div v-if="isUser" class="user-text">{{ message.content }}</div>
      <template v-else>
        <MarkdownView v-if="message.content" :content="message.content" @cite="openCitation" />
        <div v-if="showTyping" class="typing" aria-label="正在生成">
          <span></span><span></span><span></span>
        </div>
        <span v-if="isStreamingHere && message.content" class="caret"></span>
      </template>

      <div v-if="message.error" class="error-box">
        <div class="error-title">
          <Icon name="alert" :size="15" />
          {{ message.error.title || '生成失败' }}
        </div>
        <p>{{ message.error.message }}</p>
        <p v-if="message.error.hint" class="hint">{{ message.error.hint }}</p>
        <button class="btn sm" @click="emit('regenerate')">重试</button>
      </div>

      <p v-if="retrievalNote" class="retrieval-note">{{ retrievalNote }}</p>

      <CitationList
        v-if="!isUser && message.citations?.length"
        :citations="message.citations"
        @open="openCitation"
      />

      <footer v-if="!isUser && !isStreamingHere && message.content" class="actions">
        <button type="button" class="link-btn" @click="copy">
          <Icon name="copy" :size="13" /> 复制
        </button>
        <button type="button" class="link-btn" @click="emit('regenerate')">
          <Icon name="refresh" :size="13" /> 重新生成
        </button>
        <span v-if="message.usage?.total_tokens" class="usage">
          {{ message.usage.total_tokens }} tokens
        </span>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.msg {
  display: flex;
  gap: 12px;
  padding: 4px 0 18px;
  align-items: flex-start;
}

.msg.user {
  flex-direction: row-reverse;
}

.avatar {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-serif);
  background: var(--surface-3);
  color: var(--text-soft);
  margin-top: 2px;
}
.avatar.assistant {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.avatar.user {
  background: var(--surface-3);
  color: var(--text);
}

.bubble {
  min-width: 0;
  max-width: min(760px, 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 12px 16px 10px;
  box-shadow: var(--shadow-sm);
}
.msg.user .bubble {
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border));
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11.5px;
  color: var(--text-mute);
}
.who {
  font-weight: 700;
  color: var(--text-soft);
}
.time {
  margin-left: auto;
  font-size: 11px;
}

.user-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.75;
}

.reasoning {
  margin-bottom: 10px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  overflow: hidden;
}
.reason-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 10px;
  font-size: 12px;
  color: var(--text-mute);
  font-weight: 600;
}
.reason-toggle:hover {
  color: var(--text);
}
.reason-body {
  padding: 0 12px 10px;
  font-size: var(--fs-sm);
  line-height: 1.7;
  color: var(--text-mute);
  white-space: pre-wrap;
  max-height: 320px;
  overflow-y: auto;
}

.typing {
  display: inline-flex;
  gap: 5px;
  padding: 6px 2px;
}
.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-mute);
  animation: bounce 1.1s infinite ease-in-out;
}
.typing span:nth-child(2) {
  animation-delay: 0.14s;
}
.typing span:nth-child(3) {
  animation-delay: 0.28s;
}
@keyframes bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.caret {
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--accent);
  animation: blink 0.9s steps(2) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}

.error-box {
  margin-top: 10px;
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  font-size: var(--fs-sm);
  color: var(--text);
}
.error-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: var(--danger);
  margin-bottom: 4px;
}
.error-box p {
  margin: 0 0 4px;
  color: var(--text-soft);
}
.error-box .hint {
  color: var(--text-mute);
  font-size: var(--fs-xs);
}
.error-box .btn {
  margin-top: 6px;
}

.retrieval-note {
  margin: 10px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
  padding: 7px 10px;
  border-radius: var(--radius-xs);
  background: var(--surface-2);
  border-left: 2px solid var(--border-strong);
}

.actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-mute);
  padding: 2px 0;
}
.link-btn:hover {
  color: var(--accent);
}
.usage {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-mute);
  opacity: 0.85;
}

@media (max-width: 640px) {
  .avatar {
    display: none;
  }
  .bubble {
    padding: 11px 13px 8px;
  }
}
</style>
