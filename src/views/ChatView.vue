<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MessageBubble from '../components/MessageBubble.vue'
import CitationDrawer from '../components/CitationDrawer.vue'
import Icon from '../components/Icon.vue'
import { useChatStore } from '../stores/chat.js'
import { useSettingsStore } from '../stores/settings.js'
import { useLibraryStore } from '../stores/library.js'
import { useToast } from '../composables/useToast.js'
import { askConfirm } from '../composables/useConfirm.js'
import { formatRelative } from '../core/text.js'

const chat = useChatStore()
const settings = useSettingsStore()
const library = useLibraryStore()
const toast = useToast()
const router = useRouter()

const draft = ref('')
const scrollEl = ref(null)
const autoScroll = ref(true)
const editingId = ref('')
const editingTitle = ref('')
const renameInput = ref(null)
const drawerOpen = ref(false)
const activeCitation = ref(null)
const sideOpen = ref(false)
const scopeMenuOpen = ref(false)

const SUGGESTIONS = [
  '帮我梳理这一章的定理脉络，并标出它们的条件。',
  '把这份讲义里最重要的 10 个定义和结论列成提纲。',
  '这道题我不会，请先给思路，再给完整过程。',
  '这一章最容易考的证明题类型有哪些？',
]

const readyDocs = computed(() => library.docs.filter((doc) => doc.status === 'ready'))
const messages = computed(() => chat.messages)
const currentTitle = computed(() => chat.currentChat?.title || '新对话')
const selectedDocs = computed(() =>
  readyDocs.value.filter((doc) => chat.scopeDocIds.includes(doc.id)),
)

const scopeSummary = computed(() => {
  if (chat.scope === 'none') return '不使用资料'
  if (chat.scope === 'docs') {
    if (!chat.scopeDocIds.length) return '全部资料'
    if (selectedDocs.value.length <= 2) return selectedDocs.value.map((d) => d.title).join('、')
    return `指定 ${selectedDocs.value.length} 份资料`
  }
  return '全部资料'
})

watch(
  () => {
    const last = messages.value[messages.value.length - 1]
    if (!last) return ''
    return `${last.content?.length || 0}|${last.reasoning?.length || 0}|${last.status || ''}`
  },
  () => {
    if (autoScroll.value) scrollToBottom()
  },
)

watch(
  () => chat.currentId,
  () => {
    autoScroll.value = true
    nextTick(scrollToBottom)
  },
)

onMounted(() => {
  nextTick(scrollToBottom)
})

function scrollToBottom() {
  const el = scrollEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 140
}

async function ensureKeyOrWarn() {
  if (settings.canCallApi) return true
  toast.warning('先在「设置」里填写 DeepSeek API Key，或打开演示模式。')
  router.push('/settings')
  return false
}

async function send(text) {
  const content = String(text ?? draft.value ?? '').trim()
  if (!content || chat.streaming) return
  if (!(await ensureKeyOrWarn())) return
  draft.value = ''
  autoScroll.value = true
  await chat.send(content)
  await nextTick()
  scrollToBottom()
}

function onComposerKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    send()
  }
}

function useSuggestion(text) {
  draft.value = text
  send(text)
}

function stop() {
  chat.stop()
}

async function newChat() {
  await chat.newChat()
  sideOpen.value = false
  draft.value = ''
  autoScroll.value = true
}

async function selectChat(id) {
  if (id === chat.currentId) {
    sideOpen.value = false
    return
  }
  await chat.selectChat(id)
  sideOpen.value = false
}

function startRename(item) {
  editingId.value = item.id
  editingTitle.value = item.title
  nextTick(() => {
    const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
    el?.focus?.()
    el?.select?.()
  })
}

async function commitRename() {
  if (!editingId.value) return
  const id = editingId.value
  const title = editingTitle.value.trim()
  editingId.value = ''
  if (title) await chat.renameChat(id, title)
}

async function removeChat(item) {
  const ok = await askConfirm({
    title: '删除对话',
    message: `确定删除「${item.title}」吗？该对话下的消息会一起删除，无法恢复。`,
    confirmText: '删除',
  })
  if (!ok) return
  await chat.deleteChat(item.id)
  toast.success('已删除对话')
}

async function clearMessages() {
  const ok = await askConfirm({
    title: '清空当前对话',
    message: '会删除这个对话里的全部消息，但保留对话本身。',
    confirmText: '清空',
  })
  if (!ok) return
  await chat.clearMessages()
  toast.success('已清空')
}

function onScopeChange(event) {
  const value = event.target.value
  if (value === 'docs' && !chat.scopeDocIds.length) {
    chat.setScope('docs', readyDocs.value.slice(0, 3).map((doc) => doc.id))
  } else {
    chat.setScope(value, value === 'docs' ? chat.scopeDocIds : [])
  }
  scopeMenuOpen.value = false
}

function toggleDoc(docId) {
  const next = new Set(chat.scopeDocIds)
  if (next.has(docId)) next.delete(docId)
  else next.add(docId)
  chat.setScope('docs', [...next])
}

function openCitation(payload) {
  if (payload && typeof payload === 'object') {
    activeCitation.value = payload
    drawerOpen.value = true
    return
  }
  const n = Number(payload)
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const found = messages.value[i].citations?.find((cite) => cite.n === n)
    if (found) {
      activeCitation.value = found
      drawerOpen.value = true
      return
    }
  }
  toast.info(`本次回答没有引用「资料${n}」。`)
}

async function regenerate() {
  if (!(await ensureKeyOrWarn())) return
  autoScroll.value = true
  await chat.regenerate()
}

async function copyLast() {
  const last = [...messages.value].reverse().find((m) => m.role === 'assistant' && m.content)
  if (!last) return
  try {
    await navigator.clipboard.writeText(last.content)
    toast.success('已复制最后一条回答')
  } catch {
    toast.error('复制失败')
  }
}

defineExpose({ send })
</script>

<template>
  <div class="chat-view">
    <div v-if="sideOpen" class="side-backdrop" @click="sideOpen = false"></div>

    <aside class="chat-side" :class="{ open: sideOpen }">
      <div class="side-head">
        <button class="btn primary block" @click="newChat">
          <Icon name="plus" :size="16" /> 新对话
        </button>
      </div>

      <div class="side-list">
        <div v-if="!chat.chats.length" class="side-empty">还没有对话，直接提问就会自动创建。</div>
        <div
          v-for="item in chat.chats"
          :key="item.id"
          class="chat-item"
          :class="{ active: item.id === chat.currentId }"
          @click="selectChat(item.id)"
        >
          <input
            v-if="editingId === item.id"
            ref="renameInput"
            v-model="editingTitle"
            class="rename-input"
            @click.stop
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="editingId = ''"
            @blur="commitRename"
          />
          <template v-else>
            <div class="chat-title truncate">{{ item.title }}</div>
            <div class="chat-meta">{{ formatRelative(item.updatedAt) }}</div>
          </template>
          <div class="chat-actions" @click.stop>
            <button class="mini" title="重命名" @click="startRename(item)">
              <Icon name="edit" :size="13" />
            </button>
            <button class="mini" title="删除" @click="removeChat(item)">
              <Icon name="trash" :size="13" />
            </button>
          </div>
        </div>
      </div>

      <div class="side-foot">
        <span class="xs muted">对话保存在本机浏览器</span>
      </div>
    </aside>

    <section class="chat-main">
      <header class="chat-head">
        <button class="btn ghost icon history-btn" aria-label="历史对话" @click="sideOpen = true">
          <Icon name="layers" :size="18" />
        </button>
        <div class="head-text">
          <h2 class="truncate">{{ currentTitle }}</h2>
          <p class="sub">
            {{ settings.courseLabel }} · 资料范围：{{ scopeSummary }}
          </p>
        </div>

        <div class="head-actions">
          <label class="scope-control">
            <span class="sr-only">资料范围</span>
            <select class="select" :value="chat.scope" @change="onScopeChange">
              <option value="all">全部资料</option>
              <option value="docs">指定资料</option>
              <option value="none">不使用资料</option>
            </select>
          </label>

          <details v-if="chat.scope === 'docs'" class="scope-details" :open="scopeMenuOpen">
            <summary class="chip">选资料（{{ chat.scopeDocIds.length }}）</summary>
            <div class="scope-panel">
              <div v-if="!readyDocs.length" class="scope-empty">
                还没有可用资料，先去
                <RouterLink to="/library">资料库</RouterLink> 上传。
              </div>
              <label v-for="doc in readyDocs" :key="doc.id" class="scope-row">
                <input
                  type="checkbox"
                  :checked="chat.scopeDocIds.includes(doc.id)"
                  @change="toggleDoc(doc.id)"
                />
                <span class="truncate">{{ doc.title }}</span>
                <span class="xs muted">{{ doc.chunkCount }} 块</span>
              </label>
            </div>
          </details>

          <button v-if="messages.length" class="btn ghost sm" @click="clearMessages">清空</button>
        </div>
      </header>

      <div ref="scrollEl" class="messages" @scroll="onScroll">
        <div class="thread">
          <div v-if="!messages.length" class="welcome">
            <div class="welcome-mark serif">∫</div>
            <h1>期末复习，从一份讲义开始</h1>
            <p class="welcome-sub">
              上传课件、笔记或往年题，AI 会<strong>只依据你的资料</strong>答疑、出题、批改。
              回答里的【资料n】可以点开对照原文。
            </p>

            <div v-if="!library.chunks.length" class="welcome-tip">
              <Icon name="library" :size="16" />
              <span>资料库还是空的，先去 <RouterLink to="/library">上传资料</RouterLink> 效果最好。</span>
            </div>
            <div v-else class="welcome-stats">
              <span class="badge accent">{{ library.docs.length }} 份资料</span>
              <span class="badge">{{ library.chunkCount }} 个检索块</span>
              <span class="badge">{{ settings.courseLabel }}</span>
            </div>

            <div class="suggestions">
              <button
                v-for="item in SUGGESTIONS"
                :key="item"
                class="suggestion"
                @click="useSuggestion(item)"
              >
                <Icon name="sparkle" :size="14" />
                <span>{{ item }}</span>
              </button>
            </div>
          </div>

          <MessageBubble
            v-for="(message, index) in messages"
            :key="message.id"
            :message="message"
            :streaming="chat.streaming"
            :model-label="settings.mockMode ? '演示' : settings.model"
            @cite="openCitation"
            @regenerate="regenerate"
          />
          <div v-if="chat.streaming" class="streaming-hint">
            <span class="pulse"></span>
            {{ settings.mockMode ? '演示模式生成中…' : 'DeepSeek 生成中…' }}
            <button class="btn ghost sm" @click="stop">停止</button>
          </div>
        </div>
      </div>

      <div v-if="chat.error" class="chat-error">
        <Icon name="alert" :size="16" />
        <div>
          <strong>{{ chat.error.title }}</strong>
          <span>{{ chat.error.message }}</span>
          <em v-if="chat.error.hint">{{ chat.error.hint }}</em>
        </div>
        <button class="btn ghost sm" @click="chat.error = null">知道了</button>
      </div>

      <footer class="composer">
        <div class="composer-inner">
          <textarea
            v-model="draft"
            class="textarea"
            rows="3"
            placeholder="问点什么：概念辨析、定理条件、解题步骤、出题要求……（Ctrl/⌘ + Enter 发送）"
            :disabled="chat.streaming"
            @keydown="onComposerKeydown"
          ></textarea>
          <div class="composer-bar">
            <div class="left">
              <span class="hint">
                {{ settings.mockMode ? '演示模式：回答由本地脚本生成' : settings.hasKey ? `模型 ${settings.model}` : '未配置 Key' }}
              </span>
              <button v-if="messages.length" class="link-btn" @click="copyLast">
                <Icon name="copy" :size="13" /> 复制最后回答
              </button>
            </div>
            <div class="right">
              <button v-if="chat.streaming" class="btn danger" @click="stop">
                <Icon name="stop" :size="15" /> 停止
              </button>
              <button
                v-else
                class="btn primary"
                :disabled="!draft.trim()"
                @click="send()"
              >
                <Icon name="send" :size="15" /> 发送
              </button>
            </div>
          </div>
        </div>
      </footer>
    </section>

    <CitationDrawer :open="drawerOpen" :citation="activeCitation" @close="drawerOpen = false" />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* 左侧会话列表 */
.chat-side {
  width: 246px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  min-height: 0;
}

.side-head {
  padding: 14px 12px 10px;
}

.side-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.side-empty {
  padding: 16px 10px;
  font-size: var(--fs-xs);
  color: var(--text-mute);
  line-height: 1.65;
}

.chat-item {
  position: relative;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--transition), border-color var(--transition);
}
.chat-item:hover {
  background: var(--surface-2);
}
.chat-item.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 26%, transparent);
}

.chat-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  padding-right: 44px;
}
.chat-meta {
  font-size: 10.5px;
  color: var(--text-mute);
  margin-top: 2px;
}

.chat-actions {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 2px;
}
.chat-item:hover .chat-actions {
  display: flex;
}

.mini {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-mute);
  background: var(--surface);
  border: 1px solid var(--border);
}
.mini:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.rename-input {
  width: 100%;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: var(--surface);
  font-size: 13px;
}

.side-foot {
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

/* 主区 */
.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 45%, transparent);
}

.history-btn {
  display: none;
}

.head-text {
  min-width: 0;
}
.head-text h2 {
  font-size: var(--fs-lg);
  margin: 0;
  max-width: 420px;
}
.head-text .sub {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-mute);
}

.head-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scope-control .select {
  width: auto;
  padding: 6px 9px;
  font-size: 12px;
}

.scope-details {
  position: relative;
}
.scope-details summary {
  cursor: pointer;
  list-style: none;
}
.scope-details summary::-webkit-details-marker {
  display: none;
}

.scope-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  width: 280px;
  max-height: 320px;
  overflow-y: auto;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.scope-panel .scope-empty {
  padding: 8px;
  font-size: var(--fs-xs);
  color: var(--text-mute);
  line-height: 1.6;
}
.scope-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: var(--fs-sm);
  cursor: pointer;
}
.scope-row:hover {
  background: var(--surface-2);
}
.scope-row input {
  accent-color: var(--accent);
}
.scope-row .muted {
  margin-left: auto;
  flex: none;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px 6px;
  min-height: 0;
  scroll-behavior: smooth;
}

.thread {
  max-width: 900px;
  margin: 0 auto;
}

/* 欢迎页 */
.welcome {
  padding: 26px 4px 30px;
  text-align: center;
  color: var(--text-soft);
}
.welcome-mark {
  width: 54px;
  height: 54px;
  margin: 0 auto 14px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #fff;
  font-size: 30px;
  box-shadow: var(--shadow);
}
[data-theme='dark'] .welcome-mark {
  color: #0e1418;
}
.welcome h1 {
  font-size: clamp(20px, 2.4vw, 27px);
  margin-bottom: 8px;
}
.welcome-sub {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--text-mute);
  max-width: 560px;
  margin: 0 auto 16px;
}
.welcome-sub strong {
  color: var(--text-soft);
}

.welcome-tip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--fs-sm);
  margin-bottom: 6px;
}
.welcome-stats {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.suggestions {
  margin-top: 22px;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  max-width: 660px;
  margin-inline: auto;
}
.suggestion {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  text-align: left;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-soft);
  font-size: var(--fs-sm);
  line-height: 1.55;
  transition: all var(--transition);
}
.suggestion:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--text);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.suggestion svg {
  color: var(--accent);
  flex: none;
  margin-top: 2px;
}

.streaming-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  font-size: var(--fs-xs);
  color: var(--text-mute);
  padding: 2px 0 18px;
}
.pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.2s infinite ease-in-out;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.chat-error {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 22px 8px;
  padding: 10px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  background: var(--danger-soft);
  color: var(--text-soft);
  font-size: var(--fs-sm);
}
.chat-error strong {
  color: var(--danger);
  margin-right: 6px;
}
.chat-error em {
  display: block;
  font-style: normal;
  color: var(--text-mute);
  font-size: var(--fs-xs);
  margin-top: 2px;
}
.chat-error > div {
  flex: 1;
}

/* 输入区 */
.composer {
  flex: none;
  border-top: 1px solid var(--border);
  padding: 12px 24px 14px;
  background: color-mix(in srgb, var(--surface) 55%, transparent);
}
.composer-inner {
  max-width: 900px;
  margin: 0 auto;
}
.composer .textarea {
  min-height: 78px;
  max-height: 220px;
  resize: vertical;
  background: var(--surface);
  font-size: var(--fs-base);
}
.composer-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.composer-bar .left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.composer-bar .right {
  margin-left: auto;
}
.hint {
  font-size: 11.5px;
  color: var(--text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-mute);
  white-space: nowrap;
}
.link-btn:hover {
  color: var(--accent);
}

.side-backdrop {
  display: none;
}

@media (max-width: 900px) {
  .chat-side {
    position: fixed;
    inset: var(--topbar-h) auto 0 0;
    width: min(280px, 82vw);
    transform: translateX(-102%);
    transition: transform 220ms ease;
    background: var(--surface);
    z-index: 45;
    box-shadow: var(--shadow-lg);
  }
  .chat-side.open {
    transform: translateX(0);
  }
  .side-backdrop {
    display: block;
    position: fixed;
    inset: var(--topbar-h) 0 0 0;
    background: rgba(20, 24, 28, 0.35);
    z-index: 44;
  }
  .history-btn {
    display: inline-flex;
  }
  .chat-head {
    padding: 10px 12px;
    flex-wrap: wrap;
  }
  .head-text h2 {
    max-width: 210px;
    font-size: var(--fs-base);
  }
  .head-actions {
    width: 100%;
    margin-left: 0;
  }
  .messages {
    padding: 14px 12px 4px;
  }
  .composer {
    padding: 10px 12px 12px;
  }
  .composer-bar .left .hint {
    display: none;
  }
}
</style>
