import { describe, expect, it } from 'vitest'
import {
  cleanPdfPages,
  isHeadingLine,
  isPageNumber,
  splitByHeadings,
  stripRunningHeaders,
} from '../src/core/parsers/pdfCleanup.js'

function makePages() {
  return [
    {
      page: 1,
      lines: [
        '数学分析讲义',
        '第一章 极限',
        '1.1 数列极限',
        '定义 1.1 设 {a_n} 是数列，',
        '若存在常数 A，使得对任意 ε>0，',
        '存在 N，当 n>N 时 |a_n-A|<ε，',
        '则称数列收敛于 A。',
        '- 2 -',
      ],
    },
    {
      page: 2,
      lines: [
        '数学分析讲义',
        '第二章 级数',
        '正项级数',
        '若部分和数列有上界，',
        '则级数收敛。',
        '- 3 -',
      ],
    },
    {
      page: 3,
      lines: [
        '数学分析讲义',
        '第三章 幂级数',
        '收敛半径 R 由根值判别法给出。',
        '3',
      ],
    },
  ]
}

describe('pdf 文本后处理', () => {
  it('识别页码与标题', () => {
    expect(isPageNumber('- 2 -')).toBe(true)
    expect(isPageNumber('第 3 页')).toBe(true)
    expect(isPageNumber('定义 1.1 设 {a_n} 是数列')).toBe(false)

    expect(isHeadingLine('第二章 级数')).toBe(true)
    expect(isHeadingLine('一、极限的定义')).toBe(true)
    expect(isHeadingLine('2.1 幂级数')).toBe(true)
    expect(isHeadingLine('则称数列收敛于 A。')).toBe(false)
  })

  it('去掉每页重复的页眉', () => {
    const cleaned = stripRunningHeaders(makePages())
    expect(cleaned.every((page) => !page.lines.includes('数学分析讲义'))).toBe(true)
    expect(cleaned[0].lines).toContain('第一章 极限')
  })

  it('只出现两页的短行不会被误删', () => {
    const pages = makePages()
    pages[2].lines = pages[2].lines.filter((line) => line !== '数学分析讲义')
    const cleaned = stripRunningHeaders(pages)
    expect(cleaned[0].lines).toContain('数学分析讲义')
  })

  it('把被 PDF 硬换行切断的句子接起来，并保留标题与页码', () => {
    const sections = cleanPdfPages(makePages())
    expect(sections.length).toBeGreaterThanOrEqual(3)

    const first = sections[0]
    expect(first.heading).toBe('1.1 数列极限')
    expect(first.text).toContain('若存在常数 A，使得对任意 ε>0，存在 N')
    expect(first.text).not.toContain('- 2 -')

    const second = sections.find((section) => section.heading === '第二章 级数')
    expect(second).toBeTruthy()
    expect(second.text).toContain('正项级数若部分和数列有上界，则级数收敛。')

    expect(sections.some((section) => section.heading === '第三章 幂级数')).toBe(true)
  })

  it('纯文本也能按标题切节', () => {
    const sections = splitByHeadings('第一章 极限\n极限的定义。\n第二章 级数\n级数收敛。')
    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({ heading: '第一章 极限' })
    expect(sections[1].text).toContain('级数收敛')
  })
})
