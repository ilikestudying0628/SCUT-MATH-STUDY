<script setup>
import { computed, onMounted, ref } from 'vue'
import MarkdownView from '../components/MarkdownView.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import { useSettingsStore } from '../stores/settings.js'
import { useLibraryStore } from '../stores/library.js'
import { useToast } from '../composables/useToast.js'
import { buildSummaryMessages, SUMMARY_KINDS } from '../core/prompts/summary.js'
import { spreadChunks } from '../core/retrieval.js'
import { chatOnce } from '../api/deepseek.js'
import * as mock from '../api/mock.js'
import { describeError, isAbortError } from '../api/errors.js'
import { downloadText, printElement, safeFilename } from '../core/exporters.js'

const settings = useSettingsStore()
const library = useLibraryStore()
const toast = useToast()

const kind = ref('outline')
const selectedDocs = ref([])
const loading = ref(false)
const error = ref(null)
const result = ref('')
const resultKind = ref('')
const printTarget = ref(null)

const KINDS = Object.entries(SUMMARY_KINDS).map(([value, meta]) => ({
  value,
  label: meta.label,
  task: meta.task,
}))

const readyDocs = computed(() => library.docs.filter((doc) => doc.status === 'ready'))
const allSelected = computed(() => selectedDocs.value.length === 0)
const currentTask = computed(() => KINDS.find((item) => item.value === kind.value)?.task || '')

onMounted(async () => {
  await library.init()
})

function toggleDoc(id) {
  const next = new Set(selectedDocs.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedDocs.value = [...next]
}

async function generate() {
  if (loading.value) return
  error.value = null

  if (!settings.canCallApi) {
    error.value = {
      title: '还没有可用的 API Key',
      message: '到「设置」填入 DeepSeek API Key，或打开演示模式。',
      hint: '',
    }
    return
  }
  if (!library.chunks.length) {
    error.value = {
      title: '资料库是空的',
      message: '先上传讲义或课件，提纲才能贴着你的课程内容写。',
      hint: '也可以先加一份示例资料。',
    }
    return
  }

  loading.value = true
  result.value = ''
  try {
    const context = spreadChunks({
      chunks: library.chunks,
      docs: library.docs,
      docIds: selectedDocs.value.length ? selectedDocs.value : null,
      maxChars: Math.max(16000, Number(settings.contextChars) || 12000),
    })
    const messages = buildSummaryMessages({
      kind: kind.value,
      courseName: settings.courseLabel,
      contextText: context.contextText,
    })
    const runner = settings.mockMode ? mock.chatOnce : chatOnce
    const response = await runner({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      messages,
      temperature: 0.5,
      maxTokens: 6000,
    })
    if (!response.text?.trim()) throw new Error('模型返回为空，请重试')
    result.value = response.text
    resultKind.value = kind.value
    toast.success(`已生成${KINDS.find((item) => item.value === kind.value)?.label}`)
  } catch (err) {
    if (!isAbortError(err)) {
      error.value = describeError(err)
      toast.error(error.value.message)
    }
  } finally {
    loading.value = false
  }
}

function exportMarkdown() {
  if (!result.value) return
  const label = KINDS.find((item) => item.value === resultKind.value)?.label || '复习提纲'
  downloadText(
    `${safeFilename(`${settings.courseLabel}-${label}`)}.md`,
    `# ${settings.courseLabel} · ${label}\n\n${result.value}`,
  )
  toast.success('已导出 Markdown')
}

function printOutline() {
  if (!printTarget.value) return
  printElement(printTarget.value)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>复习提纲</h1>
      <span class="sub">把整份资料压缩成考前能看完的框架、公式与易错点</span>
    </div>

    <section class="controls card pad no-print">
      <div class="field">
        <label>生成类型</label>
        <div class="kinds">
          <button
            v-for="item in KINDS"
            :key="item.value"
            type="button"
            class="kind"
            :class="{ active: kind === item.value }"
            :disabled="loading"
            @click="kind = item.value"
          >
            <strong>{{ item.label }}</strong>
          </button>
        </div>
        <span class="hint">{{ currentTask }}</span>
      </div>

      <div class="field">
        <label>资料范围</label>
        <div v-if="!readyDocs.length" class="no-docs">
          还没有可用资料，先去 <RouterLink to="/library">资料库</RouterLink> 上传。
        </div>
        <div v-else class="docs">
          <button
            type="button"
            class="chip"
            :class="{ active: allSelected }"
            :disabled="loading"
            @click="selectedDocs = []"
          >
            全部资料（{{ readyDocs.length }}）
          </button>
          <button
            v-for="doc in readyDocs"
            :key="doc.id"
            type="button"
            class="chip"
            :class="{ active: selectedDocs.includes(doc.id) }"
            :disabled="loading"
            @click="toggleDoc(doc.id)"
          >
            {{ doc.title }}
          </button>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" :disabled="loading || !readyDocs.length" @click="generate">
          <span v-if="loading" class="spinner" style="width: 14px; height: 14px"></span>
          <Icon v-else name="sparkle" :size="16" />
          {{ loading ? '正在整理资料…' : `生成${KINDS.find((item) => item.value === kind)?.label}` }}
        </button>
        <span class="hint">
          会随机抽样 {{ readyDocs.length }} 份资料的内容作为依据，消耗一次 API 调用。
        </span>
      </div>
    </section>

    <div v-if="error" class="error-box no-print">
      <Icon name="alert" :size="16" />
      <div>
        <strong>{{ error.title }}</strong>
        <p>{{ error.message }}</p>
        <em v-if="error.hint">{{ error.hint }}</em>
      </div>
      <button class="btn ghost sm" @click="error = null">知道了</button>
    </div>

    <section v-if="result" ref="printTarget" class="result card pad">
      <header class="result-head">
        <div>
          <span class="eyebrow">{{ settings.courseLabel }}</span>
          <h2>{{ KINDS.find((item) => item.value === resultKind)?.label }}</h2>
        </div>
        <div class="result-actions no-print">
          <button class="btn sm" @click="exportMarkdown">
            <Icon name="download" :size="14" /> 导出 Markdown
          </button>
          <button class="btn sm" @click="printOutline">
            <Icon name="print" :size="14" /> 打印 / 存 PDF
          </button>
        </div>
      </header>
      <MarkdownView :content="result" />
      <footer class="result-foot">
        AI 整理的内容可能有遗漏，考前请对照课件与真题；所有引用都能在「对话复习」里追问。
      </footer>
    </section>

    <EmptyState
      v-else-if="!loading"
      icon="book"
      title="还没有提纲"
      desc="选一个类型和资料范围，AI 会把讲义压缩成知识框架、公式速查、易错点清单或考前 30 条。"
    >
      <button v-if="readyDocs.length" class="btn primary" @click="generate">
        <Icon name="sparkle" :size="15" /> 直接生成知识框架
      </button>
      <RouterLink v-else to="/library" class="btn">去上传资料</RouterLink>
    </EmptyState>

    <div v-else class="loading-block">
      <span class="spinner"></span>
      <span>正在阅读资料并整理提纲，通常需要 10–40 秒…</span>
    </div>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.kinds {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.kind {
  padding: 12px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-soft);
  font-size: 13px;
  text-align: left;
  transition: all var(--transition);
}
.kind:hover:not(:disabled) {
  border-color: var(--border-strong);
}
.kind.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  color: var(--accent);
}
.kind strong {
  display: block;
  font-size: 13px;
}

.docs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.no-docs {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-strong);
  font-size: var(--fs-sm);
  color: var(--text-mute);
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  background: var(--danger-soft);
  color: var(--text-soft);
  font-size: var(--fs-sm);
}
.error-box strong {
  color: var(--danger);
}
.error-box p {
  margin: 2px 0 0;
}
.error-box em {
  display: block;
  margin-top: 2px;
  font-style: normal;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}
.error-box > div {
  flex: 1;
}

.result-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--border);
}
.result-head h2 {
  font-size: var(--fs-xl);
  margin: 2px 0 0;
}
.eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.6px;
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
}
.result-actions {
  margin-left: auto;
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.result-foot {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: var(--fs-xs);
  color: var(--text-mute);
  line-height: 1.6;
}

.loading-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 52px 20px;
  color: var(--text-mute);
  font-size: var(--fs-sm);
}

@media (max-width: 760px) {
  .kinds {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
