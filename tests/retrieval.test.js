import { describe, expect, it } from 'vitest'
import { buildQuery, retrieveChunks, spreadChunks } from '../src/core/retrieval.js'

const docs = [
  { id: 'd1', title: '数学分析讲义' },
  { id: 'd2', title: '高等代数笔记' },
]

const chunks = [
  {
    id: 'd1:0',
    docId: 'd1',
    index: 0,
    heading: '极限',
    page: 1,
    text: '极限的 ε-δ 定义：对任意 ε>0，存在 δ>0，使 0<|x-x0|<δ 时 |f(x)-A|<ε。',
  },
  {
    id: 'd1:1',
    docId: 'd1',
    index: 1,
    heading: '中值定理',
    page: 2,
    text: 'Rolle 中值定理要求函数在闭区间连续、开区间可导，且端点函数值相等。',
  },
  {
    id: 'd2:0',
    docId: 'd2',
    index: 0,
    heading: '矩阵',
    page: 3,
    text: '矩阵的秩等于行向量组的极大线性无关组所含向量的个数。',
  },
]

describe('retrieval', () => {
  it('检索结果带连续引用编号与来源信息', () => {
    const result = retrieveChunks({ query: '中值定理的条件', chunks, docs, topK: 4 })
    expect(result.citations.length).toBeGreaterThan(0)
    expect(result.citations[0].n).toBe(1)
    expect(result.citations[0].docTitle).toBe('数学分析讲义')
    expect(result.contextText).toContain('【资料1】')
    expect(result.contextText).toContain('Rolle')
  })

  it('限定资料范围后不会引用其他资料', () => {
    const result = retrieveChunks({
      query: '矩阵的秩',
      chunks,
      docs,
      docIds: ['d2'],
    })
    expect(result.citations.every((cite) => cite.docId === 'd2')).toBe(true)
  })

  it('空查询与无命中给出原因', () => {
    expect(retrieveChunks({ query: '', chunks, docs }).emptyReason).toBe('empty-query')
    expect(retrieveChunks({ query: '拓扑学', chunks, docs }).emptyReason).toBe('no-match')
    expect(retrieveChunks({ query: '极限', chunks: [], docs }).emptyReason).toBe('scope-empty')
  })

  it('预算很小时仍保留至少一段并报告被丢弃的数量', () => {
    const result = retrieveChunks({
      query: '极限 中值定理 矩阵',
      chunks,
      docs,
      topK: 6,
      perDocLimit: 3,
      maxChars: 120,
    })
    expect(result.citations.length).toBe(1)
  })

  it('单篇资料默认最多引用 3 段', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `d1:${i}`,
      docId: 'd1',
      index: i,
      heading: '极限',
      page: i + 1,
      text: `极限的第 ${i} 段讨论：函数在一点的极限与左右极限的关系。`,
    }))
    const result = retrieveChunks({
      query: '极限与左右极限',
      chunks: many,
      docs,
      topK: 8,
      perDocLimit: 3,
      maxChars: 20000,
    })
    expect(result.citations.length).toBeLessThanOrEqual(3 + 3)
  })

  it('buildQuery 组合问题与课程', () => {
    expect(buildQuery({ question: '中值定理', courseName: '数学分析' })).toBe('中值定理 数学分析')
  })

  it('出题上下文能覆盖多份资料', () => {
    const result = spreadChunks({ chunks, docs, maxChars: 20000 })
    const docIds = new Set(result.citations.map((cite) => cite.docId))
    expect(docIds.size).toBe(2)
    expect(result.contextText.length).toBeGreaterThan(0)
  })

  it('口语问法能通过术语扩展召回资料', () => {
    const seriesChunks = [
      {
        id: 'd1:0',
        docId: 'd1',
        index: 0,
        heading: '级数',
        page: 1,
        text: '比值判别法用于判定正项级数的敛散性：需要计算相邻两项之比的极限。',
      },
    ]
    const result = retrieveChunks({
      query: '这个东西到底是发散还是收敛',
      chunks: seriesChunks,
      docs,
      topK: 4,
      withNeighbors: false,
    })
    expect(result.citations.length).toBeGreaterThan(0)
    expect(result.contextText).toContain('比值判别法')
  })
})
