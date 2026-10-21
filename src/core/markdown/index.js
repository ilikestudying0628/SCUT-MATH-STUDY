import MarkdownIt from 'markdown-it'
import { mathPlugin } from './math.js'

export const md = new MarkdownIt({
  html: false,
  xhtmlOut: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

md.use(mathPlugin)

// 【资料n】渲染成可点击的引用标签。
// 注意：`【` 不是 markdown-it 的 terminator 字符，text 规则会先把它吞掉，
// 因此在 core 阶段把 text token 拆开，比注册 inline 规则更可靠。
function splitCitations(state) {
  const pattern = /【资料\s*(\d{1,3})】/g
  for (const blockToken of state.tokens) {
    if (blockToken.type !== 'inline' || !Array.isArray(blockToken.children)) continue
    const nextChildren = []
    for (const child of blockToken.children) {
      if (child.type !== 'text' || !child.content.includes('【')) {
        nextChildren.push(child)
        continue
      }
      pattern.lastIndex = 0
      let lastIndex = 0
      let match
      let replaced = false
      while ((match = pattern.exec(child.content))) {
        replaced = true
        if (match.index > lastIndex) {
          const text = new state.Token('text', '', 0)
          text.content = child.content.slice(lastIndex, match.index)
          nextChildren.push(text)
        }
        const cite = new state.Token('citation', '', 0)
        cite.content = match[1]
        cite.markup = '【资料】'
        nextChildren.push(cite)
        lastIndex = match.index + match[0].length
      }
      if (!replaced) {
        nextChildren.push(child)
        continue
      }
      if (lastIndex < child.content.length) {
        const tail = new state.Token('text', '', 0)
        tail.content = child.content.slice(lastIndex)
        nextChildren.push(tail)
      }
    }
    blockToken.children = nextChildren
  }
}

md.core.ruler.after('inline', 'citations', splitCitations)

md.renderer.rules.citation = (tokens, idx) => {
  const n = String(tokens[idx].content || '').replace(/[^\d]/g, '')
  if (!n) return ''
  return `<button type="button" class="cite-chip" data-cite="${n}" title="查看资料 ${n} 原文">资料${n}</button>`
}

// 外链新窗口打开
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// 表格包一层横向滚动容器：窄屏不撑破气泡，宽表格也只在自己的区域里滚动
md.renderer.rules.table_open = () => '<div class="table-scroll"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

export function renderMarkdown(text) {
  if (!text) return ''
  try {
    return md.render(String(text))
  } catch {
    return `<pre class="md-fallback">${String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre>`
  }
}

export function renderMarkdownInline(text) {
  if (!text) return ''
  try {
    return md.renderInline(String(text))
  } catch {
    return ''
  }
}
