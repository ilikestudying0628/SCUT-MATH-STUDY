<script setup>
import { computed, ref } from 'vue'
import MarkdownView from './MarkdownView.vue'
import Icon from './Icon.vue'
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../core/quizSchema.js'
import { formatRelative } from '../core/text.js'

const props = defineProps({
  item: { type: Object, required: true },
})

const emit = defineEmits(['remove', 'toggle'])

const open = ref(false)
const question = computed(() => props.item.question || {})
const ratio = computed(() => {
  const max = Number(props.item.maxScore) || 0
  return max ? (Number(props.item.lastScore) || 0) / max : 0
})
</script>

<template>
  <article class="wrong-card" :class="{ mastered: item.mastered }">
    <header class="head">
      <div class="tags">
        <span class="badge accent">{{ TYPE_LABELS[question.type] || question.type }}</span>
        <span class="badge">{{ item.courseName || '未分课程' }}</span>
        <span class="badge">{{ DIFFICULTY_LABELS[question.difficulty] || '中等' }}</span>
        <span class="badge" :class="ratio >= 0.6 ? 'warn' : 'danger'">
          最近 {{ item.lastScore }} / {{ item.maxScore }}
        </span>
        <span v-if="item.attempts > 1" class="badge">错 {{ item.attempts }} 次</span>
        <span v-if="item.mastered" class="badge ok">已掌握</span>
      </div>
      <span class="time">{{ formatRelative(item.lastWrongAt) }}</span>
    </header>

    <MarkdownView :content="question.stem" class="stem" />

    <div v-if="question.options?.length" class="options">
      <span v-for="option in question.options" :key="option.key">
        {{ option.key }}. {{ option.text }}
      </span>
    </div>

    <button type="button" class="toggle" @click="open = !open">
      {{ open ? '收起解析' : '查看答案与解析' }}
      <Icon name="eye" :size="14" />
    </button>

    <div v-if="open" class="detail">
      <div class="row-line">
        <span class="label">我的作答</span>
        <span class="value">{{ item.lastAnswer || '（空）' }}</span>
      </div>
      <div class="row-line">
        <span class="label">参考答案</span>
        <span class="value">{{ question.answer }}</span>
      </div>
      <MarkdownView v-if="question.explanation" :content="question.explanation" class="explain" />
      <p v-if="item.grade?.advice" class="advice">{{ item.grade.advice }}</p>
      <p v-if="question.knowledge?.length" class="knowledge">
        知识点：{{ question.knowledge.join('、') }}
      </p>
    </div>

    <footer class="actions">
      <button class="btn ghost sm" @click="emit('toggle', item)">
        <Icon name="check" :size="14" />
        {{ item.mastered ? '恢复未掌握' : '标记已掌握' }}
      </button>
      <button class="btn ghost sm danger-text" @click="emit('remove', item)">
        <Icon name="trash" :size="14" /> 删除
      </button>
    </footer>
  </article>
</template>

<style scoped>
.wrong-card {
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.wrong-card.mastered {
  opacity: 0.62;
  background: var(--surface-2);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.time {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--text-mute);
}

.stem {
  font-size: var(--fs-sm);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0;
  font-size: var(--fs-xs);
  color: var(--text-soft);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  font-size: var(--fs-xs);
  color: var(--accent);
  font-weight: 600;
}

.detail {
  margin-top: 10px;
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: var(--fs-sm);
}
.row-line {
  display: flex;
  gap: 10px;
}
.row-line .label {
  flex: none;
  width: 62px;
  color: var(--text-mute);
  font-size: var(--fs-xs);
  padding-top: 2px;
}
.row-line .value {
  white-space: pre-wrap;
  word-break: break-word;
}
.explain {
  font-size: var(--fs-sm);
  color: var(--text-soft);
}
.advice {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--accent);
  padding: 7px 10px;
  border-radius: var(--radius-xs);
  background: var(--accent-soft);
}
.knowledge {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.danger-text {
  color: var(--danger);
}
</style>
