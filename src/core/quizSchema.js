import { z } from 'zod'

export const QUESTION_TYPES = ['single', 'multiple', 'judge', 'fill', 'calculation', 'proof']

export const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  calculation: '计算题',
  proof: '证明题',
}

export const TYPE_SHORT = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  fill: '填空',
  calculation: '计算',
  proof: '证明',
}

export const DIFFICULTY_LABELS = {
  easy: '基础',
  medium: '中等',
  hard: '拔高',
}

const DEFAULT_POINTS = {
  single: 5,
  multiple: 6,
  judge: 4,
  fill: 5,
  calculation: 15,
  proof: 15,
}

const TYPE_ALIASES = {
  单选: 'single',
  单选题: 'single',
  单项选择: 'single',
  选择: 'single',
  选择题: 'single',
  single_choice: 'single',
  multiple: 'multiple',
  多选: 'multiple',
  多选题: 'multiple',
  多项选择: 'multiple',
  多项选择题: 'multiple',
  judge: 'judge',
  判断: 'judge',
  判断题: 'judge',
  true_false: 'judge',
  fill: 'fill',
  填空: 'fill',
  填空题: 'fill',
  calculation: 'calculation',
  计算: 'calculation',
  计算题: 'calculation',
  解答题: 'calculation',
  解答: 'calculation',
  proof: 'proof',
  证明: 'proof',
  证明题: 'proof',
}

const DIFFICULTY_ALIASES = {
  基础: 'easy',
  简单: 'easy',
  容易: 'easy',
  easy: 'easy',
  中等: 'medium',
  中档: 'medium',
  medium: 'medium',
  拔高: 'hard',
  较难: 'hard',
  困难: 'hard',
  hard: 'hard',
}

function normalizeType(raw) {
  const key = String(raw ?? '').trim()
  if (QUESTION_TYPES.includes(key)) return key
  return TYPE_ALIASES[key] || TYPE_ALIASES[key.toLowerCase()] || 'calculation'
}

function normalizeDifficulty(raw) {
  const key = String(raw ?? '').trim()
  if (DIFFICULTY_LABELS[key]) return key
  return DIFFICULTY_ALIASES[key] || DIFFICULTY_ALIASES[key.toLowerCase()] || 'medium'
}

function toStringArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[、,，;；]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function toNumber(raw, fallback) {
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function normalizeOptions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((opt, i) => {
        if (opt == null) return null
        if (typeof opt === 'string') {
          const text = opt.trim()
          return text ? { key: String.fromCharCode(65 + i), text } : null
        }
        const key = String(opt.key ?? opt.label ?? opt.value ?? String.fromCharCode(65 + i)).trim()
        const text = String(opt.text ?? opt.content ?? opt.value ?? '').trim()
        return text ? { key: key.slice(0, 4), text } : null
      })
      .filter(Boolean)
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .map(([key, text]) => ({ key, text: String(text ?? '').trim() }))
      .filter((o) => o.text)
  }
  return []
}

function normalizeAnswer(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? '').trim()).filter(Boolean).join('、')
  if (raw == null) return ''
  return String(raw).trim()
}

const optionSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
})

export const questionSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  stem: z.string().trim().min(1),
  options: z.array(optionSchema),
  answer: z.string().trim().min(1),
  explanation: z.string(),
  points: z.number().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  knowledge: z.array(z.string()),
  source: z.string(),
})

export const quizSchema = z.object({
  title: z.string(),
  questions: z.array(questionSchema).min(1),
  createdAt: z.number().optional(),
})

export function normalizeQuestion(raw, index = 0) {
  const type = normalizeType(raw?.type)
  const options = normalizeOptions(raw?.options)
  const points = toNumber(raw?.points, DEFAULT_POINTS[type] || 10)
  return {
    id: `q${index + 1}`,
    type,
    stem: String(raw?.stem ?? raw?.question ?? raw?.title ?? '').trim(),
    options: type === 'single' || type === 'multiple' ? options : [],
    answer: normalizeAnswer(raw?.answer ?? raw?.correctAnswer ?? raw?.solution),
    explanation: String(raw?.explanation ?? raw?.analysis ?? raw?.解析 ?? '').trim(),
    points: Math.min(Math.max(Math.round(points * 2) / 2, 1), 100),
    difficulty: normalizeDifficulty(raw?.difficulty),
    knowledge: toStringArray(raw?.knowledge ?? raw?.knowledgePoints ?? raw?.知识点),
    source: String(raw?.source ?? '').trim(),
  }
}

/** 从可能带说明文字/代码围栏的模型输出里取出 JSON */
export function extractJson(text) {
  let s = String(text ?? '').trim()
  if (!s) return { ok: false, error: '模型返回为空' }
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first < 0 || last <= first) return { ok: false, error: '返回内容里没有 JSON 对象' }
  const candidate = s.slice(first, last + 1)
  try {
    return { ok: true, value: JSON.parse(candidate), text: candidate }
  } catch (error) {
    try {
      const fixed = candidate.replace(/,\s*([}\]])/g, '$1')
      return { ok: true, value: JSON.parse(fixed), text: fixed }
    } catch {
      return { ok: false, error: `JSON 解析失败：${error.message}`, text: candidate }
    }
  }
}

function formatIssues(result) {
  return (result.error?.issues || [])
    .slice(0, 4)
    .map((issue) => `${(issue.path || []).join('.') || 'root'}：${issue.message}`)
    .join('；')
}

/**
 * 解析模型出题结果；允许部分题目不合法（丢弃并在 dropped 里计数），
 * 只要还有至少一道有效题就算成功。
 */
export function parseQuizPayload(text) {
  const extracted = extractJson(text)
  if (!extracted.ok) return { ok: false, error: extracted.error, raw: extracted.text || text }

  const payload = extracted.value
  const rawQuestions = Array.isArray(payload?.questions)
    ? payload.questions
    : Array.isArray(payload)
      ? payload
      : []

  if (!rawQuestions.length) {
    return { ok: false, error: 'JSON 里没有 questions 数组', raw: extracted.text }
  }

  const questions = []
  const issues = []
  rawQuestions.forEach((raw, i) => {
    if (questions.length >= 30) return
    const normalized = normalizeQuestion(raw, questions.length)
    const result = questionSchema.safeParse(normalized)
    if (result.success) {
      questions.push({ ...result.data, id: `q${questions.length + 1}` })
    } else {
      issues.push(`第 ${i + 1} 题：${formatIssues(result)}`)
    }
  })

  if (!questions.length) {
    return {
      ok: false,
      error: `题目字段不完整（${issues.slice(0, 3).join('；')}）`,
      raw: extracted.text,
    }
  }

  const title = String(payload?.title ?? '').trim() || '期末复习练习卷'
  return {
    ok: true,
    quiz: { title, questions, createdAt: Date.now() },
    dropped: issues.length,
    issues,
    raw: extracted.text,
  }
}

export const gradeSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(0).optional(),
  hitPoints: z.array(z.string()),
  missingPoints: z.array(z.string()),
  errors: z.array(z.string()),
  advice: z.string(),
})

export function normalizeGrade(raw, maxScore) {
  const score = Math.min(Math.max(toNumber(raw?.score, 0), 0), maxScore)
  return {
    score: Math.round(score * 2) / 2,
    maxScore: toNumber(raw?.maxScore, maxScore),
    hitPoints: toStringArray(raw?.hitPoints ?? raw?.hits ?? raw?.得分点),
    missingPoints: toStringArray(raw?.missingPoints ?? raw?.missing ?? raw?.遗漏点),
    errors: toStringArray(raw?.errors ?? raw?.mistakes ?? raw?.错误点),
    advice: String(raw?.advice ?? raw?.suggestion ?? raw?.建议 ?? '').trim(),
  }
}

/** 解析批改结果，任何字段缺失都尽量兜底，避免整套题卡住 */
export function parseGradePayload(text, maxScore = 10) {
  const extracted = extractJson(text)
  if (!extracted.ok) {
    return { ok: false, error: extracted.error, raw: extracted.text || text }
  }
  const normalized = normalizeGrade(extracted.value, maxScore)
  const result = gradeSchema.safeParse(normalized)
  if (!result.success) {
    return { ok: false, error: formatIssues(result), raw: extracted.text }
  }
  return { ok: true, grade: result.data, raw: extracted.text }
}
