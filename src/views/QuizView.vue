<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import QuizConfigForm from '../components/QuizConfigForm.vue'
import QuestionCard from '../components/QuestionCard.vue'
import GradeReport from '../components/GradeReport.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import { useQuizStore } from '../stores/quiz.js'
import { useLibraryStore } from '../stores/library.js'
import { useSettingsStore } from '../stores/settings.js'
import { useToast } from '../composables/useToast.js'
import { askConfirm } from '../composables/useConfirm.js'
import { downloadText, printElement, quizToMarkdown, safeFilename, totalPoints } from '../core/exporters.js'
import { formatDateTime } from '../core/text.js'

const quiz = useQuizStore()
const library = useLibraryStore()
const settings = useSettingsStore()
const toast = useToast()

const answers = ref({})
const attempt = ref(null)
const revealed = reactive({})
const printTarget = ref(null)

const activeQuiz = computed(() => quiz.activeQuiz)
const readyDocs = computed(() => library.docs.filter((doc) => doc.status === 'ready'))

const answeredCount = computed(() => {
  if (!activeQuiz.value) return 0
  return activeQuiz.value.questions.filter((question) =>
    String(answers.value[question.id] || '').trim(),
  ).length
})

const bestScore = computed(() => {
  const attempts = activeQuiz.value?.attempts || []
  if (!attempts.length) return null
  const best = attempts.reduce((max, item) =>
    item.totalScore / Math.max(1, item.maxTotal) > max.totalScore / Math.max(1, max.maxTotal) ? item : max,
  )
  return best
})

onMounted(async () => {
  await quiz.init()
  if (quiz.activeQuiz) loadAttempt(quiz.activeQuiz)
})

watch(
  () => quiz.activeId,
  () => {
    if (quiz.activeQuiz) loadAttempt(quiz.activeQuiz)
    else {
      answers.value = {}
      attempt.value = null
    }
  },
)

function loadAttempt(target) {
  const last = target?.attempts?.[0]
  answers.value = last ? { ...last.answers } : {}
  attempt.value = last || null
  for (const key of Object.keys(revealed)) delete revealed[key]
}

async function generate(config) {
  const created = await quiz.generate(config)
  if (!created) {
    toast.error(quiz.error?.message || '出题失败')
    return
  }
  answers.value = {}
  attempt.value = null
  toast.success(`已生成 ${created.questions.length} 道题，开始练习吧`)
}

function stopGenerate() {
  quiz.stop()
}

async function submit() {
  if (!activeQuiz.value || quiz.grading) return
  const total = activeQuiz.value.questions.length
  const missing = total - answeredCount.value
  const ok = await askConfirm({
    title: '提交批改',
    message: missing
      ? `还有 ${missing} 题没作答，未作答的题会得 0 分。确定提交吗？`
      : '客观题本地判分，主观题由 AI 按步骤评分。提交后可以重做。',
    confirmText: '提交',
    danger: false,
  })
  if (!ok) return
  const result = await quiz.grade(activeQuiz.value.id, { ...answers.value })
  if (!result) {
    toast.error(quiz.error?.message || '批改失败')
    return
  }
  attempt.value = result
  toast.success(`批改完成：${result.totalScore} / ${result.maxTotal} 分`)
}

function redo() {
  answers.value = {}
  attempt.value = null
  for (const key of Object.keys(revealed)) delete revealed[key]
  toast.info('已清空作答，可以重新做一遍')
}

function newPractice() {
  quiz.activeId = null
  answers.value = {}
  attempt.value = null
}

function exportMarkdown() {
  if (!activeQuiz.value) return
  const filename = `${safeFilename(activeQuiz.value.title)}.md`
  downloadText(filename, quizToMarkdown(activeQuiz.value, { withAnswers: true }))
  toast.success('已导出 Markdown')
}

function printQuiz() {
  if (!printTarget.value) return
  printElement(printTarget.value)
}

async function removeQuiz(item) {
  const ok = await askConfirm({
    title: '删除练习卷',
    message: `确定删除「${item.title}」吗？批改记录会一起删除，错题本里的题不受影响。`,
    confirmText: '删除',
  })
  if (!ok) return
  await quiz.remove(item.id)
  toast.success('已删除')
}

function openQuiz(id) {
  quiz.setActive(id)
}

function bestOf(item) {
  const attempts = item.attempts || []
  if (!attempts.length) return ''
  const best = attempts.reduce((max, cur) =>
    cur.totalScore / Math.max(1, cur.maxTotal) > max.totalScore / Math.max(1, max.maxTotal) ? cur : max,
  )
  return `${best.totalScore}/${best.maxTotal}`
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>出题练习</h1>
      <span class="sub">按资料出卷、在线作答、AI 按步骤批改</span>
      <div class="spacer"></div>
      <button v-if="activeQuiz" class="btn" @click="newPractice">
        <Icon name="plus" :size="15" /> 新建练习
      </button>
    </div>

    <div class="quiz-layout">
      <aside class="config-col no-print">
        <QuizConfigForm
          :docs="readyDocs"
          :generating="quiz.generating"
          :progress="quiz.progress"
          :course-label="settings.courseLabel"
          @generate="generate"
          @stop="stopGenerate"
        />

        <section v-if="quiz.quizzes.length" class="history card pad">
          <h3>历史练习</h3>
          <div class="history-list">
            <div
              v-for="item in quiz.quizzes"
              :key="item.id"
              class="history-item"
              :class="{ active: item.id === quiz.activeId }"
              @click="openQuiz(item.id)"
            >
              <div class="h-main">
                <span class="h-title truncate">{{ item.title }}</span>
                <span class="h-meta">
                  {{ item.questions.length }} 题 · {{ totalPoints(item) }} 分
                  <template v-if="bestOf(item)"> · 最佳 {{ bestOf(item) }}</template>
                </span>
                <span class="h-date">{{ formatDateTime(item.createdAt) }}</span>
              </div>
              <button class="mini" title="删除" @click.stop="removeQuiz(item)">
                <Icon name="trash" :size="13" />
              </button>
            </div>
          </div>
        </section>
      </aside>

      <section class="main-col">
        <template v-if="activeQuiz">
          <div ref="printTarget" class="quiz-sheet">
            <header class="quiz-head card pad">
              <div class="head-text">
                <span class="eyebrow">{{ activeQuiz.courseName }} · {{ formatDateTime(activeQuiz.createdAt) }}</span>
                <h2>{{ activeQuiz.title }}</h2>
                <p class="muted small">
                  {{ activeQuiz.questions.length }} 题 · 总分 {{ totalPoints(activeQuiz) }} 分
                  <template v-if="bestScore"> · 最佳 {{ bestScore.totalScore }}/{{ bestScore.maxTotal }}</template>
                </p>
              </div>
              <div class="actions quiz-actions no-print">
                <button class="btn sm" @click="exportMarkdown">
                  <Icon name="download" :size="14" /> 导出
                </button>
                <button class="btn sm" @click="printQuiz">
                  <Icon name="print" :size="14" /> 打印
                </button>
              </div>
            </header>

            <ul v-if="activeQuiz.warnings?.length" class="warnings no-print">
              <li v-for="(warning, index) in activeQuiz.warnings" :key="index">{{ warning }}</li>
            </ul>

            <GradeReport
              v-if="attempt"
              class="no-print"
              :quiz="activeQuiz"
              :attempt="attempt"
              @export="exportMarkdown"
              @print="printQuiz"
              @redo="redo"
            />

            <div class="questions">
              <QuestionCard
                v-for="(question, index) in activeQuiz.questions"
                :key="question.id"
                v-model="answers[question.id]"
                :question="question"
                :index="index"
                :disabled="Boolean(attempt)"
                :result="attempt?.results?.[question.id] || null"
                :revealed="Boolean(revealed[question.id])"
                @reveal="revealed[question.id] = !revealed[question.id]"
              />
            </div>
          </div>

          <div v-if="!attempt" class="submit-bar no-print">
            <span class="progress-text">
              已作答 {{ answeredCount }} / {{ activeQuiz.questions.length }}
              <span v-if="quiz.grading" class="muted">
                · 批改中 {{ quiz.gradingProgress.done }}/{{ quiz.gradingProgress.total }}
              </span>
            </span>
            <button class="btn primary" :disabled="quiz.grading || quiz.generating" @click="submit">
              <span v-if="quiz.grading" class="spinner" style="width: 13px; height: 13px"></span>
              <template v-else><Icon name="check" :size="15" /> 提交批改</template>
            </button>
          </div>
        </template>

        <EmptyState
          v-else
          icon="quiz"
          title="左侧配置一套练习卷"
          desc="选择题型、数量和难度，AI 会依据你上传的资料出题。作答后客观题本地判分，计算题与证明题由 AI 按步骤评分。"
        >
          <RouterLink v-if="!readyDocs.length" to="/library" class="btn primary">
            <Icon name="library" :size="15" /> 先上传资料
          </RouterLink>
        </EmptyState>
      </section>
    </div>
  </div>
</template>

<style scoped>
.quiz-layout {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.config-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 16px;
}

.history h3 {
  font-size: var(--fs-base);
  margin-bottom: 8px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  border: 1px solid transparent;
}
.history-item:hover {
  background: var(--surface-2);
}
.history-item.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 24%, transparent);
}

.h-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.h-title {
  font-size: 12.5px;
  font-weight: 600;
}
.h-meta {
  font-size: 11px;
  color: var(--text-mute);
}
.h-date {
  font-size: 10.5px;
  color: var(--text-mute);
  opacity: 0.8;
}

.mini {
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-mute);
  border: 1px solid var(--border);
  background: var(--surface);
}
.mini:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.main-col {
  min-width: 0;
}

.quiz-sheet {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quiz-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.head-text {
  min-width: 0;
}
.eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.5px;
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
}
.quiz-head h2 {
  font-size: var(--fs-xl);
  margin: 3px 0 3px;
  line-height: 1.35;
}
.quiz-head .actions {
  margin-left: auto;
  display: flex;
  gap: 7px;
  flex: none;
}

.warnings {
  margin: 0;
  padding-left: 18px;
  font-size: var(--fs-xs);
  color: var(--warn);
  line-height: 1.6;
}

.questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.submit-bar {
  position: sticky;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
}
.progress-text {
  font-size: var(--fs-sm);
  color: var(--text-soft);
}
.submit-bar .btn {
  margin-left: auto;
}

@media (max-width: 1000px) {
  .quiz-layout {
    grid-template-columns: 1fr;
  }
  .config-col {
    position: static;
  }
  .history-list {
    max-height: 200px;
  }
}
</style>
