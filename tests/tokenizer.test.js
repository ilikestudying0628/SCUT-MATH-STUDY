import { describe, expect, it, afterAll } from 'vitest'
import { __setSegmenterForTest, tokenize } from '../src/core/tokenizer.js'

describe('tokenizer', () => {
  afterAll(() => __setSegmenterForTest(null))

  it('中文按词切分并补充二元组', () => {
    const tokens = tokenize('中值定理与拉格朗日中值定理')
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens).toContain('定理')
    expect(tokens).toContain('中值')
    expect(tokens.every((t) => t.trim().length > 0)).toBe(true)
  })

  it('英文与数字保留', () => {
    const tokens = tokenize('Rolle 定理 2.1 与 epsilon-delta')
    expect(tokens).toContain('rolle')
    expect(tokens).toContain('2.1')
    expect(tokens).toContain('epsilon')
    expect(tokens).toContain('delta')
  })

  it('停用词被过滤', () => {
    expect(tokenize('的 和 是 了', { bigrams: false })).toEqual([])
  })

  it('标点不会成为词元', () => {
    const tokens = tokenize('证明：若 f 连续，则 f 可积。')
    expect(tokens).toContain('连续')
    expect(tokens).toContain('可积')
    expect(tokens.some((t) => /[，。：；]/.test(t))).toBe(false)
  })

  it('没有 Segmenter 时退化为二元组', () => {
    __setSegmenterForTest(false)
    const tokens = tokenize('极限存在', { bigrams: true })
    expect(tokens).toContain('极限')
    expect(tokens).toContain('限存')
    expect(tokens).toContain('存在')
    __setSegmenterForTest(null)
  })

  it('空字符串返回空数组', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })
})
