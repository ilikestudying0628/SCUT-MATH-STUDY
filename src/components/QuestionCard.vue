<script setup>
import { computed } from 'vue'
import MarkdownView from './MarkdownView.vue'
import Icon from './Icon.vue'
import { renderMarkdownInline } from '../core/markdown/index.js'
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../core/quizSchema.js'

const props = defineProps({
  question: { type: Object, required: true },
  index: { type: Number, default: 0 },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  result: { type: Object, default: null },
  revealed: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'reveal'])

const selectedLetters = computed(() => {
  const letters = String(props.modelValue || '').toUpperCase().match(/[A-H]/g)
  return letters ? [...new Set(letters)] : []
})

const isChoice = computed(() => ['single', 'multiple'].includes(props.question.type))
const isJudge = computed(() => props.question.type === 'judge')
const isText = computed(() => ['fill', 'calculation', 'proof'].includes(props.question.type))
const answered = computed(() => Boolean(String(props.modelValue || '').trim()))

const textValue = computed({
  get: () => props.modelValue || '',
  set: (value) => emit('update:modelValue', value),
})

function choose(key) {
  if (props.disabled) return
  if (props.question.type === 'multiple') {
    const set = new Set(selectedLetters.value)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    emit('update:modelValue', [...set].sort().join(''))
  } else {
    emit('update:modelValue', key)
  }
}

function setJudge(value) {
  if (!props.disabled) emit('update:modelValue', value)
}

function optionHtml(text) {
  return renderMarkdownInline(text)
}
</script>

<template>
  <article class="q-card" :class="{ answered, graded: Boolean(result) }">
    <header class="q-head">
      <span class="q-no">{{ index + 1 }}</span>
      <div class="q-tags">
        <span class="badge accent">{{ TYPE_LABELS[question.type] || question.type }}</span>
        <span class="badge">{{ question.points }} 分</span>
        <span class="badge">{{ DIFFICULTY_LABELS[question.difficulty] || '中等' }}</span>
        <span v-if="question.source" class="badge">{{ question.source }}</span>
      </div>
      <span v-if="result" class="score" :class="{ good: result.score / result.max >= 0.6, bad: result.score / result.max < 0.6 }">
        {{ result.score }} / {{ result.max }}
      </span>
      <span v-else-if="answered" class="badge ok">已作答</span>
    </header>

    <MarkdownView :content="question.stem" class="stem" />

    <div v-if="isChoice" class="options">
      <button
        v-for="option in question.options"
        :key="option.key"
        type="button"
        class="option"
        :class="{ chosen: selectedLetters.includes(option.key), locked: disabled }"
        :disabled="disabled"
        @click="choose(option.key)"
      >
        <span class="letter">{{ option.key }}</span>
        <span class="option-text" v-html="optionHtml(option.text)"></span>
        <span v-if="selectedLetters.includes(option.key)" class="tick">
          <Icon name="check" :size="14" />
        </span>
      </button>
      <p v-if="question.type === 'multiple'" class="multi-hint">多选题：可选多个选项</p>
    </div>

    <div v-else-if="isJudge" class="judge">
      <button
        type="button"
        class="judge-btn"
        :class="{ chosen: modelValue === '正确' }"
        :disabled="disabled"
        @click="setJudge('正确')"
      >
        正确
      </button>
      <button
        type="button"
        class="judge-btn"
        :class="{ chosen: modelValue === '错误' }"
        :disabled="disabled"
        @click="setJudge('错误')"
      >
        错误
      </button>
    </div>

    <div v-else-if="isText" class="answer-area">
      <textarea
        v-model="textValue"
        class="textarea"
        :rows="question.type === 'fill' ? 2 : 6"
        :disabled="disabled"
        :placeholder="
          question.type === 'fill'
            ? '填写答案，多个空用；分隔'
            : question.type === 'proof'
              ? '写出证明过程，可以先用文字说明思路，公式用 $…$ 包裹'
              : '写出计算过程与最终结果'
        "
      ></textarea>
    </div>

    <div v-if="result" class="result">
      <div class="result-head">
        <span class="badge" :class="result.score / result.max >= 0.6 ? 'ok' : 'danger'">
          {{ result.source === 'ai' ? 'AI 批改' : '自动判分' }}
        </span>
        <span v-if="result.note" class="result-note">{{ result.note }}</span>
      </div>

      <div v-if="result.grade" class="grade-detail">
        <div v-if="result.grade.hitPoints?.length" class="point-block good">
          <strong>得分点</strong>
          <ul>
            <li v-for="(item, i) in result.grade.hitPoints" :key="i">{{ item }}</li>
          </ul>
        </div>
        <div v-if="result.grade.missingPoints?.length" class="point-block warn">
          <strong>遗漏</strong>
          <ul>
            <li v-for="(item, i) in result.grade.missingPoints" :key="i">{{ item }}</li>
          </ul>
        </div>
        <div v-if="result.grade.errors?.length" class="point-block bad">
          <strong>问题</strong>
          <ul>
            <li v-for="(item, i) in result.grade.errors" :key="i">{{ item }}</li>
          </ul>
        </div>
        <p v-if="result.grade.advice" class="advice">{{ result.grade.advice }}</p>
      </div>

      <button type="button" class="link-btn" @click="emit('reveal')">
        {{ revealed ? '收起参考答案' : '查看参考答案与解析' }}
      </button>

      <div v-if="revealed" class="reveal">
        <div class="answer-line">
          <span class="label">答案</span>
          <span class="value">{{ question.answer }}</span>
        </div>
        <MarkdownView v-if="question.explanation" :content="question.explanation" class="explain" />
        <p v-if="question.knowledge?.length" class="knowledge">
          知识点：{{ question.knowledge.join('、') }}
        </p>
      </div>
    </div>

    <footer v-if="!result" class="q-foot">
      <span class="muted xs" v-if="question.knowledge?.length">
        知识点：{{ question.knowledge.join('、') }}
      </span>
    </footer>
  </article>
</template>

<style scoped>
.q-card {
  padding: 16px 18px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition);
}
.q-card.answered {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

.q-head {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.q-no {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--surface-3);
  color: var(--text-soft);
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 14px;
}

.q-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.score {
  margin-left: auto;
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: var(--fs-sm);
}
.score.good {
  color: var(--ok);
}
.score.bad {
  color: var(--danger);
}

.stem {
  font-size: var(--fs-base);
  margin-bottom: 12px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: var(--fs-sm);
  line-height: 1.65;
  transition: all var(--transition);
}
.option:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--surface);
}
.option.chosen {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  background: var(--accent-soft);
}
.option.locked {
  cursor: default;
}
.option.locked:hover {
  background: var(--surface-2);
}
.option.chosen.locked {
  background: var(--accent-soft);
}

.letter {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-strong);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-soft);
  background: var(--surface);
}
.option.chosen .letter {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
[data-theme='dark'] .option.chosen .letter {
  color: #0e1418;
}

.option-text :deep(p) {
  margin: 0;
}
.option-text :deep(.katex) {
  font-size: 1em;
}

.tick {
  margin-left: auto;
  color: var(--accent);
  flex: none;
}

.multi-hint {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.judge {
  display: flex;
  gap: 10px;
}
.judge-btn {
  padding: 9px 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-weight: 600;
  font-size: var(--fs-sm);
}
.judge-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
}
.judge-btn.chosen {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.answer-area .textarea {
  font-size: var(--fs-sm);
  line-height: 1.75;
  background: var(--surface-2);
}

.result {
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px dashed var(--border);
}
.result-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.result-note {
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.grade-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.point-block {
  font-size: var(--fs-sm);
  padding: 8px 11px;
  border-radius: var(--radius-xs);
  background: var(--surface-2);
  border-left: 2px solid var(--border-strong);
}
.point-block strong {
  font-size: 11.5px;
  letter-spacing: 0.3px;
}
.point-block ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.point-block li {
  line-height: 1.6;
  color: var(--text-soft);
}
.point-block.good {
  border-left-color: var(--ok);
}
.point-block.warn {
  border-left-color: var(--warn);
}
.point-block.bad {
  border-left-color: var(--danger);
}
.advice {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-soft);
  padding: 8px 11px;
  border-radius: var(--radius-xs);
  background: var(--accent-soft);
}

.link-btn {
  margin-top: 10px;
  font-size: var(--fs-xs);
  color: var(--accent);
  font-weight: 600;
}

.reveal {
  margin-top: 10px;
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.answer-line {
  display: flex;
  gap: 10px;
  font-size: var(--fs-sm);
  margin-bottom: 8px;
}
.answer-line .label {
  flex: none;
  font-weight: 700;
  color: var(--accent);
}
.answer-line .value {
  white-space: pre-wrap;
  word-break: break-word;
}
.explain {
  font-size: var(--fs-sm);
  color: var(--text-soft);
}
.knowledge {
  margin: 8px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.q-foot {
  margin-top: 10px;
}
</style>
