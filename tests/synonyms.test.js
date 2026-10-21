import { describe, expect, it } from 'vitest'
import { expandQueryText, matchAliasGroups } from '../src/core/synonyms.js'

describe('数学术语同义扩展', () => {
  it('口语问法能扩展出资料里的术语', () => {
    const terms = expandQueryText('这个级数到底收不收敛')
    expect(terms).toContain('敛散性')
    expect(terms).toContain('判别法')
    expect(terms).toContain('级数')
  })

  it('留数、特征值等术语能匹配到对应组', () => {
    expect(matchAliasGroups('留数怎么算').length).toBeGreaterThan(0)
    expect(matchAliasGroups('矩阵的特征值').length).toBeGreaterThan(0)
  })

  it('没有命中任何术语时返回空数组', () => {
    expect(expandQueryText('今天天气怎么样')).toEqual([])
    expect(expandQueryText('')).toEqual([])
  })

  it('可以排除已经出现过的词', () => {
    const terms = expandQueryText('级数收敛', { exclude: ['级数'] })
    expect(terms).not.toContain('级数')
    expect(terms).toContain('敛散性')
  })
})
