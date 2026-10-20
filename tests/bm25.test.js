import { describe, expect, it } from 'vitest'
import { buildIndex, search } from '../src/core/bm25.js'
import { tokenize } from '../src/core/tokenizer.js'

const docs = [
  { id: 'a', text: '极限的定义与连续性的判别，ε-δ 语言。' },
  { id: 'b', text: '中值定理：Rolle 定理与 Lagrange 中值定理的条件。' },
  { id: 'c', text: '级数敛散性，比较判别法与比值判别法，p 级数。' },
]

describe('bm25', () => {
  it('命中文档排在前面', () => {
    const index = buildIndex(docs)
    const hits = search(index, tokenize('中值定理'))
    expect(hits[0].id).toBe('b')
    expect(hits[0].score).toBeGreaterThan(0)
  })

  it('标题权重生效', () => {
    const index = buildIndex([
      { id: 'x', text: '这一节讲很多内容但与主题无关。' },
      { id: 'y', text: '这一节也讲很多内容。', title: '中值定理' },
    ])
    const hits = search(index, tokenize('中值定理'))
    expect(hits[0].id).toBe('y')
  })

  it('空查询与空索引返回空数组', () => {
    expect(search(buildIndex(docs), [])).toEqual([])
    expect(search(buildIndex([]), tokenize('极限'))).toEqual([])
  })

  it('limit 生效', () => {
    const index = buildIndex(docs)
    const hits = search(index, tokenize('定理 判别法 定义'), { limit: 1 })
    expect(hits).toHaveLength(1)
  })

  it('filter 只返回允许的文档', () => {
    const index = buildIndex(docs)
    const hits = search(index, tokenize('定理'), { filter: (id) => id !== 'b' })
    expect(hits.every((hit) => hit.id !== 'b')).toBe(true)
  })
})
