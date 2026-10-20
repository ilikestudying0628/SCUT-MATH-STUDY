<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { QUESTION_TYPES, TYPE_LABELS } from '../core/quizSchema.js'

const props = defineProps({
  docs: { type: Array, default: () => [] },
  generating: { type: Boolean, default: false },
  progress: { type: Object, default: () => ({ done: 0, total: 0, label: '' }) },
  courseLabel: { type: String, default: '' },
})

const emit = defineEmits(['generate', 'stop'])

const types = ref(['single', 'calculation', 'proof'])
const count = ref(5)
const difficulty = ref('medium')
const focus = ref('')
const selectedDocs = ref([])

const readyDocs = computed(() => props.docs || [])
const allSelected = computed(() => selectedDocs.value.length === 0)
const estimated = computed(() => {
  const chunkTotal = readyDocs.value
    .filter((doc) => allSelected.value || selectedDocs.value.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.chunkCount || 0), 0)
  return chunkTotal
})

const COUNTS = [5, 8, 10, 15]
const DIFFICULTIES = [
  { value: 'easy', label: '基础' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '拔高' },
]

function toggleType(type) {
  if (props.generating) return
  const set = new Set(types.value)
  if (set.has(type)) set.delete(type)
  else set.add(type)
  types.value = QUESTION_TYPES.filter((t) => set.has(t))
}

function toggleDoc(id) {
  if (props.generating) return
  const set = new Set(selectedDocs.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedDocs.value = [...set]
}

function resetDocScope() {
  selectedDocs.value = []
}

function generate() {
  if (props.generating || !types.value.length) return
  emit('generate', {
    types: [...types.value],
    count: count.value,
    difficulty: difficulty.value,
    focus: focus.value.trim(),
    docIds: [...selectedDocs.value],
  })
}
</script>

<template>
  <section class="config card pad">
    <header class="head">
      <div>
        <h2>生成练习卷</h2>
        <p class="xs muted">{{ courseLabel }} · 依据资料出题，附答案与解析</p>
      </div>
      <span class="badge accent">AI 命题</span>
    </header>

    <div class="field">
      <label>资料范围</label>
      <div v-if="!readyDocs.length" class="no-docs">
        资料库还是空的。<RouterLink to="/library">先上传资料</RouterLink>，AI 才能按你的课程内容出题。
      </div>
      <template v-else>
        <div class="doc-scope">
          <button
            type="button"
            class="chip"
            :class="{ active: allSelected }"
            @click="resetDocScope"
          >
            全部资料（{{ readyDocs.length }}）
          </button>
          <button
            v-for="doc in readyDocs"
            :key="doc.id"
            type="button"
            class="chip"
            :class="{ active: selectedDocs.includes(doc.id) }"
            @click="toggleDoc(doc.id)"
          >
            {{ doc.title }}
          </button>
        </div>
        <span class="hint">将用到约 {{ estimated }} 个检索块的内容。</span>
      </template>
    </div>

    <div class="field">
      <label>题型</label>
      <div class="type-grid">
        <button
          v-for="type in QUESTION_TYPES"
          :key="type"
          type="button"
          class="type-btn"
          :class="{ active: types.includes(type) }"
          @click="toggleType(type)"
        >
          {{ TYPE_LABELS[type] }}
        </button>
      </div>
    </div>

    <div class="row-2">
      <div class="field">
        <label>题目数量</label>
        <div class="segmented">
          <button
            v-for="option in COUNTS"
            :key="option"
            type="button"
            :class="{ active: count === option }"
            @click="count = option"
          >
            {{ option }}
          </button>
        </div>
      </div>
      <div class="field">
        <label>难度</label>
        <div class="segmented">
          <button
            v-for="option in DIFFICULTIES"
            :key="option.value"
            type="button"
            :class="{ active: difficulty === option.value }"
            @click="difficulty = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="field">
      <label for="quiz-focus">侧重点（可选）</label>
      <input
        id="quiz-focus"
        v-model="focus"
        class="input"
        placeholder="例如：中值定理证明、级数敛散性、留数计算"
        maxlength="80"
      />
    </div>

    <div class="actions">
      <button
        v-if="!generating"
        class="btn primary block"
        :disabled="!types.length || !readyDocs.length"
        @click="generate"
      >
        <Icon name="sparkle" :size="16" /> 开始出题
      </button>
      <template v-else>
        <div class="progress">
          <span class="spinner"></span>
          <span>{{ progress.label || '生成中…' }}</span>
          <span class="muted xs">{{ progress.done }}/{{ progress.total }}</span>
        </div>
        <button class="btn danger" @click="emit('stop')">
          <Icon name="stop" :size="15" /> 取消
        </button>
      </template>
    </div>

    <p class="foot-note">
      出题会消耗 API 额度；题目若与老师风格不符，可以在侧重点里写清楚章节或题型。
    </p>
  </section>
</template>

<style scoped>
.config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.head h2 {
  font-size: var(--fs-lg);
  margin: 0 0 2px;
}
.head .badge {
  margin-left: auto;
}

.doc-scope {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 150px;
  overflow-y: auto;
}

.no-docs {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-strong);
  font-size: var(--fs-sm);
  color: var(--text-mute);
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.type-btn {
  padding: 8px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-soft);
  transition: all var(--transition);
}
.type-btn:hover {
  border-color: var(--border-strong);
}
.type-btn.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  color: var(--accent);
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.segmented {
  display: flex;
  padding: 3px;
  gap: 3px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.segmented button {
  flex: 1;
  padding: 6px 4px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-mute);
  transition: all var(--transition);
}
.segmented button:hover {
  color: var(--text);
}
.segmented button.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--fs-sm);
}
.progress .muted {
  margin-left: auto;
}

.foot-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-mute);
}

@media (max-width: 520px) {
  .type-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .row-2 {
    grid-template-columns: 1fr;
  }
}
</style>
