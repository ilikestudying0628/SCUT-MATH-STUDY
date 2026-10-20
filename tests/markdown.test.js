import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/core/markdown/index.js'

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
    expect(html).toContain('katex')
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
})
