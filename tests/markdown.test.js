import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/core/markdown/index.js'
import {
  buildLatexCandidates,
  needsDisplayStyle,
  renderKatex,
} from '../src/core/markdown/math.js'

describe('markdown 渲染', () => {
  it('行内公式渲染为 KaTeX', () => {
    const html = renderMarkdown('由 $x^2 + y^2 = 1$ 可知这是单位圆。')
    expect(html).toContain('class="katex"')
    expect(html).toContain('单位圆')
  })

  it('块级公式使用 display 模式', () => {
    const html = renderMarkdown('$$\n\\int_0^1 x\\,dx = \\frac12\n$$')
    expect(html).toContain('math-block')
    expect(html).toContain('katex-display')
  })

  it('括号形式公式也能识别', () => {
    expect(renderMarkdown('行内 \\(a+b\\) 结束')).toContain('class="katex"')
    expect(renderMarkdown('\\[ a^2+b^2=c^2 \\]')).toContain('katex')
  })

  it('货币写法不会被当成公式', () => {
    const html = renderMarkdown('这件资料花了 $5 到 $10，很便宜。')
    expect(html).not.toContain('class="katex"')
  })

  it('转义后的美元符号保持原样', () => {
    const html = renderMarkdown('公式写作 \\$x\\$ 表示字面量。')
    expect(html).not.toContain('class="katex"')
  })

  it('坏公式降级为源码而不抛错', () => {
    const html = renderMarkdown('$\\frac{1}{$')
    expect(html).toContain('math-fallback')
    expect(html).not.toContain('katex-error')
  })

  it('引用标签渲染成可点击按钮', () => {
    const html = renderMarkdown('由定理 2.1 可得【资料12】。')
    expect(html).toContain('data-cite="12"')
    expect(html).toContain('cite-chip')
  })

  it('代码块中的公式不被渲染', () => {
    const html = renderMarkdown('```\n$x^2$\n```')
    expect(html).toContain('$x^2$')
    expect(html).not.toContain('class="katex"')
  })

  it('空内容返回空字符串', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('行内分式/求和自动改用 displaystyle，避免被压成小号', () => {
    expect(needsDisplayStyle('\\frac{1}{2}')).toBe(true)
    expect(needsDisplayStyle('\\sum_{n=1}^{\\infty} a_n')).toBe(true)
    expect(needsDisplayStyle('x^2+y^2')).toBe(false)
    const candidates = buildLatexCandidates('\\frac{1}{2}', false)
    expect(candidates[0].startsWith('\\displaystyle')).toBe(true)
    const html = renderKatex('\\frac{1}{2}', false)
    expect(html).toContain('katex')
    expect(html).toContain('mfrac')
  })

  it('unsupported 环境会改成 aligned 再渲染', () => {
    const html = renderMarkdown('$$\\begin{eqnarray} a &=& b \\\\ c &=& d \\end{eqnarray}$$')
    expect(html).toContain('katex')
    expect(html).not.toContain('math-fallback')
  })

  it('真正无法解析的公式降级为等宽源码而不是红色报错', () => {
    const html = renderMarkdown('$\\foo{x}$')
    expect(html).toContain('math-fallback')
    expect(html).not.toContain('katex-error')
  })

  it('表格包在横向滚动容器里', () => {
    const html = renderMarkdown('| 函数 | 导数 |\n| --- | --- |\n| $\\sin x$ | $\\cos x$ |')
    expect(html).toContain('table-scroll')
    expect(html).toContain('sin')
  })

  it('行间公式不再套一层滚动条', () => {
    const html = renderMarkdown('$$a^2+b^2=c^2$$')
    expect(html).toContain('math-block')
    expect(html).toContain('katex-display')
  })
})
