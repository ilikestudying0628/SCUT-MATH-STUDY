import { describe, expect, it } from 'vitest'
import { isObjectiveType, judgeObjective } from '../src/core/judge.js'

describe('judgeObjective', () => {
  it('单选题比较选项字母', () => {
    const question = { type: 'single', answer: 'B', points: 5 }
    expect(judgeObjective(question, 'b').score).toBe(5)
    expect(judgeObjective(question, '(B)').score).toBe(5)
    expect(judgeObjective(question, 'C').score).toBe(0)
    expect(judgeObjective(question, '').correct).toBe(false)
  })

  it('多选题必须完全一致，顺序无关', () => {
    const question = { type: 'multiple', answer: 'A、C', points: 6 }
    expect(judgeObjective(question, 'CA').score).toBe(6)
    expect(judgeObjective(question, 'A').score).toBe(0)
  })

  it('判断题归一化对/错', () => {
    const question = { type: 'judge', answer: '正确', points: 4 }
    expect(judgeObjective(question, '对').score).toBe(4)
    expect(judgeObjective(question, '√').score).toBe(4)
    expect(judgeObjective(question, '错误').score).toBe(0)
  })

  it('填空题支持多种等价写法', () => {
    const question = { type: 'fill', answer: '1/2 | 0.5', points: 5 }
    expect(judgeObjective(question, '0.5').score).toBe(5)
    expect(judgeObjective(question, '1/2').score).toBe(5)
    expect(judgeObjective(question, '2').score).toBe(0)
  })

  it('主观题交给 AI', () => {
    expect(isObjectiveType('proof')).toBe(false)
    const result = judgeObjective({ type: 'proof', answer: '证明略', points: 15 }, '我的证明')
    expect(result.score).toBe(0)
    expect(result.note).toContain('AI')
  })
})
