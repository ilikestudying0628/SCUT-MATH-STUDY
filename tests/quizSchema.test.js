import { describe, expect, it } from 'vitest'
import {
  extractJson,
  normalizeQuestion,
  parseGradePayload,
  parseQuizPayload,
} from '../src/core/quizSchema.js'

const validQuiz = {
  title: '中值定理小测',
  questions: [
    {
      type: 'single',
      stem: 'Rolle 定理中，下列哪个条件不是必需的？',
      options: [
        { key: 'A', text: '闭区间连续' },
        { key: 'B', text: '开区间可导' },
        { key: 'C', text: '端点函数值相等' },
        { key: 'D', text: '导函数连续' },
      ],
      answer: 'D',
      explanation: '导函数不需要连续。',
      points: 5,
      difficulty: 'easy',
      knowledge: ['Rolle 定理'],
      source: '【资料1】',
    },
    {
      type: 'calculation',
      stem: '计算 $\\int_0^1 x\\,dx$。',
      answer: '$1/2$',
      explanation: '直接用牛顿-莱布尼茨公式。',
      points: 10,
      difficulty: 'medium',
      knowledge: ['定积分'],
      source: '【资料1】',
    },
  ],
}

describe('quizSchema', () => {
  it('解析带代码围栏的 JSON', () => {
    const text = `好的，下面是题目：\n\`\`\`json\n${JSON.stringify(validQuiz)}\n\`\`\`\n希望有帮助。`
    const result = parseQuizPayload(text)
    expect(result.ok).toBe(true)
    expect(result.quiz.questions).toHaveLength(2)
    expect(result.quiz.questions[0].id).toBe('q1')
    expect(result.dropped).toBe(0)
  })

  it('中文题型别名会归一化', () => {
    const result = parseQuizPayload(
      JSON.stringify({
        questions: [
          { type: '计算题', stem: '求极限', answer: '1', points: 8 },
          { type: '判断题', stem: '连续必有极限', answer: '正确', points: 4 },
        ],
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.quiz.questions[0].type).toBe('calculation')
    expect(result.quiz.questions[1].type).toBe('judge')
  })

  it('选项为字符串数组时自动补 A/B/C/D', () => {
    const normalized = normalizeQuestion({
      type: 'single',
      stem: '选一个',
      options: ['甲', '乙', '丙', '丁'],
      answer: 'A',
    })
    expect(normalized.options[0]).toEqual({ key: 'A', text: '甲' })
    expect(normalized.options[3].key).toBe('D')
  })

  it('字段不完整的题被丢弃，但保留其余有效题', () => {
    const result = parseQuizPayload(
      JSON.stringify({
        questions: [
          { type: 'single', stem: '', answer: 'A', points: 5 },
          { type: 'calculation', stem: '求 $1+1$', answer: '2', points: 5 },
        ],
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.quiz.questions).toHaveLength(1)
    expect(result.dropped).toBe(1)
  })

  it('全部无效时返回失败原因', () => {
    const result = parseQuizPayload(JSON.stringify({ questions: [{ type: 'single' }] }))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('题目字段不完整')
  })

  it('非 JSON 输出返回解析错误', () => {
    const result = parseQuizPayload('我无法完成这个请求。')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('JSON')
  })

  it('extractJson 能去掉前后说明文字', () => {
    const result = extractJson('说明文字 { "a": 1 } 结尾文字')
    expect(result.ok).toBe(true)
    expect(result.value.a).toBe(1)
  })

  it('批改结果缺字段也能兜底', () => {
    const result = parseGradePayload('{"score": 7, "advice": "步骤再写细一点"}', 10)
    expect(result.ok).toBe(true)
    expect(result.grade.score).toBe(7)
    expect(result.grade.hitPoints).toEqual([])
    expect(result.grade.maxScore).toBe(10)
  })

  it('分数超过满分时被截断', () => {
    const result = parseGradePayload('{"score": 99, "maxScore": 10}', 10)
    expect(result.grade.score).toBe(10)
  })
})
