const JUDGE_TRUE = ['正确', '对', '是', '真', '√', 't', 'true', 'yes', 'y', '1']
const JUDGE_FALSE = ['错误', '错', '否', '假', '×', 'x', 'f', 'false', 'no', 'n', '0']

export function isObjectiveType(type) {
  return ['single', 'multiple', 'judge', 'fill'].includes(type)
}

export function normalizeJudgement(value) {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s。．.、，,；;：:]/g, '')
  if (!s) return ''
  if (JUDGE_TRUE.includes(s)) return '正确'
  if (JUDGE_FALSE.includes(s)) return '错误'
  if (/^正确|^对/.test(s)) return '正确'
  if (/^错误|^错/.test(s)) return '错误'
  return s
}

function choiceLetters(value) {
  const letters = String(value ?? '')
    .toUpperCase()
    .match(/[A-H]/g)
  return letters ? [...new Set(letters)].sort().join('') : ''
}

function normalizeFill(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，,。．.；;：:、'"“”‘’()（）[\]{}]/g, '')
    .replace(/\$/g, '')
    .replace(/\\left|\\right|\\,|\\;|\\!/g, '')
}

/**
 * 客观题本地判分（不调用 API，节省额度也更确定）
 * @returns {{score: number, max: number, correct: boolean, note: string}}
 */
export function judgeObjective(question, studentAnswer) {
  const max = Number(question?.points) || 5
  const raw = String(studentAnswer ?? '').trim()
  if (!raw) return { score: 0, max, correct: false, note: '未作答' }

  let correct = false
  let note = ''

  switch (question.type) {
    case 'single': {
      const expected = choiceLetters(question.answer)
      const got = choiceLetters(raw)
      correct = Boolean(expected) && got === expected
      note = correct ? '选项正确' : `正确选项为 ${expected || '未提供'}`
      break
    }
    case 'multiple': {
      const expected = choiceLetters(question.answer)
      const got = choiceLetters(raw)
      correct = Boolean(expected) && got === expected
      note = correct ? '选项完全正确' : `正确选项为 ${expected || '未提供'}`
      break
    }
    case 'judge': {
      const expected = normalizeJudgement(question.answer)
      const got = normalizeJudgement(raw)
      correct = Boolean(expected) && got === expected
      note = correct ? '判断正确' : `正确答案是「${expected}」`
      break
    }
    case 'fill': {
      const got = normalizeFill(raw)
      const expectedList = String(question.answer ?? '')
        .split(/[|；;]|或/)
        .map((s) => normalizeFill(s))
        .filter(Boolean)
      correct = expectedList.includes(got)
      note = correct ? '填空正确' : '与参考答案不一致'
      if (!correct) {
        // 数值答案容错：1/2 与 0.5 等
        const numbers = expectedList
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n))
        const gotNumber = Number(got)
        if (Number.isFinite(gotNumber) && numbers.some((n) => Math.abs(n - gotNumber) < 1e-9)) {
          correct = true
          note = '数值等价'
        }
      }
      break
    }
    default:
      return { score: 0, max, correct: false, note: '主观题需要 AI 批改' }
  }

  return { score: correct ? max : 0, max, correct, note }
}
