import { DIFFICULTY_LABELS, TYPE_LABELS } from './quizSchema.js'
import { formatDateTime } from './text.js'

export function totalPoints(quiz) {
  return (quiz?.questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0)
}

export function quizToMarkdown(quiz, options = {}) {
  const { withAnswers = true } = options
  const lines = []
  lines.push(`# ${quiz.title || '期末复习练习卷'}`)
  lines.push('')
  lines.push(
    `> 课程：${quiz.courseName || '数学专业课'} · 共 ${quiz.questions.length} 题 · 总分 ${totalPoints(quiz)} 分${
      quiz.createdAt ? ` · ${formatDateTime(quiz.createdAt)}` : ''
    }`,
  )
  lines.push('')

  quiz.questions.forEach((q, index) => {
    lines.push(`## ${index + 1}. ${TYPE_LABELS[q.type] || q.type}（${q.points} 分）`)
    if (q.difficulty) lines.push(`*难度：${DIFFICULTY_LABELS[q.difficulty] || q.difficulty}*`)
    lines.push('')
    lines.push(q.stem)
    lines.push('')
    if (q.options?.length) {
      for (const opt of q.options) lines.push(`${opt.key}. ${opt.text}`)
      lines.push('')
    }
    if (withAnswers) {
      lines.push(`**答案**：${q.answer}`)
      lines.push('')
      if (q.explanation) {
        lines.push(`**解析**：${q.explanation}`)
        lines.push('')
      }
      if (q.knowledge?.length) {
        lines.push(`**知识点**：${q.knowledge.join('、')}`)
        lines.push('')
      }
    }
  })

  lines.push('---')
  lines.push('由「华工数学 · 期末复习助手」生成，复习用请以老师课件为准。')
  return lines.join('\n')
}

export function chatToMarkdown({ chat, messages }) {
  const lines = [`# ${chat?.title || '复习对话'}`, '']
  if (chat?.createdAt) {
    lines.push(`> 创建于 ${formatDateTime(chat.createdAt)}`)
    lines.push('')
  }
  for (const m of messages || []) {
    const who = m.role === 'user' ? '我' : '助手'
    lines.push(`## ${who}`, '', m.content || '', '')
    if (m.citations?.length) {
      lines.push('**参考资料来源**：', '')
      for (const c of m.citations) {
        lines.push(`- 【资料${c.n}】《${c.docTitle}》${c.page != null ? ` 第 ${c.page} 页` : ''}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}

export function wrongbookToMarkdown(items) {
  const lines = ['# 错题本', '']
  ;(items || []).forEach((item, index) => {
    const q = item.question || {}
    lines.push(`## ${index + 1}. ${TYPE_LABELS[q.type] || q.type || '题目'}（最近得分 ${item.lastScore ?? 0}/${item.maxScore ?? q.points ?? 0}）`)
    lines.push('')
    lines.push(q.stem || '')
    lines.push('')
    if (q.options?.length) {
      for (const opt of q.options) lines.push(`${opt.key}. ${opt.text}`)
      lines.push('')
    }
    lines.push(`**我的作答**：${item.lastAnswer || '（空）'}`)
    lines.push('')
    lines.push(`**参考答案**：${q.answer || ''}`)
    lines.push('')
    if (q.explanation) {
      lines.push(`**解析**：${q.explanation}`)
      lines.push('')
    }
    if (item.grade?.advice) {
      lines.push(`**建议**：${item.grade.advice}`)
      lines.push('')
    }
  })
  return lines.join('\n')
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(filename, blob)
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function printElement(element) {
  if (!element) {
    window.print()
    return
  }
  element.classList.add('printable')
  window.print()
  setTimeout(() => element.classList.remove('printable'), 800)
}

export function safeFilename(input, fallback = 'export') {
  const cleaned = String(input || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || fallback
}
