<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { TYPE_LABELS } from '../core/quizSchema.js'

const props = defineProps({
  quiz: { type: Object, required: true },
  attempt: { type: Object, required: true },
})

const emit = defineEmits(['export', 'print', 'redo'])

const percent = computed(() => {
  const max = Number(props.attempt?.maxTotal) || 0
  if (!max) return 0
  return Math.round(((Number(props.attempt.totalScore) || 0) / max) * 100)
})

const level = computed(() => {
  if (percent.value >= 85) return '掌握得很稳，保持手感'
  if (percent.value >= 70) return '基础不错，补齐薄弱点'
  if (percent.value >= 60) return '在及格线附近，重点补错题'
  return '需要回到定义与定理条件，逐题重做'
})

const rows = computed(() =>
  (props.quiz?.questions || []).map((question, index) => ({
    ...question,
    index: index + 1,
    result: props.attempt?.results?.[question.id] || null,
  })),
)

function ratioClass(result) {
  if (!result) return ''
  const ratio = result.max ? result.score / result.max : 0
  if (ratio >= 0.85) return 'great'
  if (ratio >= 0.6) return 'pass'
  return 'fail'
}
</script>

<template>
  <section class="report card pad">
    <div class="report-grid">
      <div class="ring" :style="{ '--pct': percent }">
        <div class="ring-inner">
          <strong>{{ attempt.totalScore }}</strong>
          <span>{{ attempt.maxTotal }} 分</span>
        </div>
      </div>

      <div class="summary">
        <h2>{{ percent }} 分 · {{ level }}</h2>
        <p class="muted small">
          共 {{ quiz.questions.length }} 题，
          {{
            quiz.questions.filter(
              (q) => (attempt.results?.[q.id]?.score || 0) >= (attempt.results?.[q.id]?.max || q.points) * 0.6,
            ).length
          }}
          题达到 60% 以上。低于 60% 的题已自动进入错题本。
        </p>
        <div class="actions">
          <button class="btn sm" @click="emit('export')">
            <Icon name="download" :size="14" /> 导出 Markdown
          </button>
          <button class="btn sm" @click="emit('print')">
            <Icon name="print" :size="14" /> 打印 / 存 PDF
          </button>
          <button class="btn sm ghost" @click="emit('redo')">
            <Icon name="refresh" :size="14" /> 重做这套题
          </button>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>题号</th>
            <th>题型</th>
            <th>得分</th>
            <th>批改</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.index }}</td>
            <td>{{ TYPE_LABELS[row.type] || row.type }}</td>
            <td class="num" :class="ratioClass(row.result)">
              {{ row.result?.score ?? 0 }} / {{ row.points }}
            </td>
            <td class="note">
              {{ row.result?.grade?.advice || row.result?.note || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.report {
  margin-bottom: 16px;
}

.report-grid {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}

.ring {
  --pct: 0;
  width: 104px;
  height: 104px;
  flex: none;
  border-radius: 50%;
  background: conic-gradient(var(--accent) calc(var(--pct) * 1%), var(--surface-3) 0);
  display: grid;
  place-items: center;
  position: relative;
}
.ring::after {
  content: '';
  position: absolute;
  inset: 9px;
  border-radius: 50%;
  background: var(--surface);
}
.ring-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}
.ring-inner strong {
  font-family: var(--font-serif);
  font-size: 26px;
}
.ring-inner span {
  font-size: 11px;
  color: var(--text-mute);
}

.summary {
  flex: 1;
  min-width: 220px;
}
.summary h2 {
  font-size: var(--fs-xl);
  margin-bottom: 4px;
}
.summary .actions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.table-wrap {
  margin-top: 14px;
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.table th,
.table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.table th {
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--text-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.table .num {
  font-family: var(--font-mono);
  white-space: nowrap;
  font-weight: 600;
}
.table .num.great {
  color: var(--ok);
}
.table .num.pass {
  color: var(--warn);
}
.table .num.fail {
  color: var(--danger);
}
.table .note {
  color: var(--text-mute);
  font-size: var(--fs-xs);
  line-height: 1.55;
}
</style>
