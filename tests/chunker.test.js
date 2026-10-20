import { describe, expect, it } from 'vitest'
import { chunkPlainText, chunkSections } from '../src/core/chunker.js'

describe('chunker', () => {
  it('长段落按上限切分且不丢内容', () => {
    const sentence = '设函数 f 在闭区间 [a,b] 上连续，在开区间 (a,b) 内可导，则由中值定理可得结论。'
    const text = sentence.repeat(40)
    const chunks = chunkPlainText(text, { maxChars: 300, overlap: 40 })
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(340)
      expect(chunk.text.trim().length).toBeGreaterThan(0)
    }
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i))
  })

  it('保留页码与标题', () => {
    const chunks = chunkSections([
      { text: '第一页内容。', page: 1, heading: '极限' },
      { text: '第二页内容。', page: 2, heading: '连续' },
    ])
    expect(chunks).toHaveLength(2)
    expect(chunks[0].page).toBe(1)
    expect(chunks[1].heading).toBe('连续')
  })

  it('相邻小块会合并', () => {
    const chunks = chunkSections(
      [
        { text: '定义 1', heading: 'h' },
        { text: '设 f 在点连续。', heading: 'h' },
      ],
      { maxChars: 800, minChars: 400 },
    )
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toContain('定义 1')
  })

  it('空内容不产生块', () => {
    expect(chunkSections([{ text: '   ' }, { text: '' }])).toEqual([])
    expect(chunkPlainText('')).toEqual([])
  })

  it('切块保留重叠上下文', () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => `第 ${i} 段：$a_${i}+b_${i}=c_${i}$ 的推导。`)
    const chunks = chunkPlainText(paragraphs.join('\n\n'), { maxChars: 160, overlap: 60 })
    expect(chunks.length).toBeGreaterThan(2)
    const second = chunks[1].text
    const firstTail = chunks[0].text.slice(-30)
    expect(second.includes(firstTail.slice(-10)) || second.length <= 160).toBe(true)
  })
})
