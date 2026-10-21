import katex from 'katex'

const MAX_INLINE_MATH = 600

/** 行内公式里出现这些结构时，改用 displaystyle 渲染，避免被压成小号 */
const NEEDS_DISPLAY_STYLE =
  /\\(frac|dfrac|tfrac|binom|sum|prod|coprod|int|iint|iiint|oint|bigcup|bigcap|lim|limsup|liminf)(?![a-zA-Z])|\\begin\{(aligned|alignedat|gathered|split|cases|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|smallmatrix)\}/

const FULL_WIDTH_FIX = [
  [/，/g, ','],
  [/；/g, ';'],
  [/：/g, ':'],
  [/（/g, '('],
  [/）/g, ')'],
  [/[−–—]/g, '-'],
  [/×/g, '\\times '],
  [/÷/g, '\\div '],
]

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function needsDisplayStyle(tex) {
  return NEEDS_DISPLAY_STYLE.test(String(tex ?? ''))
}

/** 依次尝试的候选写法：先修常见的“模型爱写、KaTeX 不认”的写法 */
export function buildLatexCandidates(tex, displayMode) {
  const base = String(tex ?? '').trim()
  if (!base) return []
  const styled =
    !displayMode && needsDisplayStyle(base) && !/^\\displaystyle\b/.test(base)
      ? `\\displaystyle ${base}`
      : base

  const list = [styled]

  if (/\\label\{|\\tag\*?\{/.test(base)) {
    list.push(
      styled.replace(/\\label\{[^}]*\}/g, '').replace(/\\tag\*?\{[^}]*\}/g, ''),
    )
  }

  if (/\\begin\{(eqnarray\*?|equation\*?|displaymath)\}/.test(base)) {
    list.push(
      styled
        .replace(/\\begin\{(eqnarray\*?|equation\*?|displaymath)\}/g, '\\begin{aligned}')
        .replace(/\\end\{(eqnarray\*?|equation\*?|displaymath)\}/g, '\\end{aligned}'),
    )
  }

  if (/[，；：（）−–—×÷]/.test(base)) {
    let fixed = styled
    for (const [pattern, replacement] of FULL_WIDTH_FIX) fixed = fixed.replace(pattern, replacement)
    list.push(fixed)
  }

  list.push(base)
  if (!displayMode) list.push(`\\displaystyle ${base}`)
  return [...new Set(list.filter(Boolean))]
}

function tryRender(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust: false,
      output: 'html',
    })
  } catch {
    return null
  }
}

export function renderKatex(tex, displayMode = false) {
  const candidates = buildLatexCandidates(tex, displayMode)
  for (const candidate of candidates) {
    const html = tryRender(candidate, displayMode)
    if (html) return html
  }
  // 实在渲染不了：退回等宽源码，避免页面上出现刺眼的红色 KaTeX 报错
  return `<code class="math-fallback" title="这段公式无法解析">${escapeHtml(tex)}</code>`
}

function findDollarClose(src, from) {
  let i = from
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\n') return -1
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '$') {
      // 货币写法（如 $5 到 $10）不当作公式
      if (src[i + 1] && /\d/.test(src[i + 1])) {
        i += 1
        continue
      }
      return i
    }
    i += 1
  }
  return -1
}

function inlineMath(state, silent) {
  const src = state.src
  const start = state.pos
  const ch = src[start]

  if (ch === '\\' && (src[start + 1] === '(' || src[start + 1] === '[')) {
    const display = src[start + 1] === '['
    const closer = display ? '\\]' : '\\)'
    const end = src.indexOf(closer, start + 2)
    if (end < 0) return false
    const content = src.slice(start + 2, end)
    if (!content.trim() || content.includes('\n') || content.length > MAX_INLINE_MATH) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = content.trim()
      token.markup = closer
      token.display = display
    }
    state.pos = end + closer.length
    return true
  }

  if (ch !== '$') return false

  const isDisplay = src[start + 1] === '$'
  const openLen = isDisplay ? 2 : 1
  const next = src[start + openLen]
  if (!next || /\s/.test(next)) return false

  let end = -1
  if (isDisplay) {
    end = src.indexOf('$$', start + openLen)
    if (end < 0) return false
    const content = src.slice(start + openLen, end)
    if (!content.trim() || content.includes('\n') || content.length > MAX_INLINE_MATH) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = content.trim()
      token.markup = '$$'
      token.display = true
    }
    state.pos = end + 2
    return true
  }

  end = findDollarClose(src, start + 1)
  if (end < 0) return false
  const content = src.slice(start + 1, end)
  if (!content.trim() || content.length > MAX_INLINE_MATH) return false
  if (content.trim() !== content) return false
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = content
    token.markup = '$'
    token.display = false
  }
  state.pos = end + 1
  return true
}

function blockMath(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  const firstLineEnd = state.eMarks[startLine]
  if (state.src.slice(pos, pos + 2) !== '$$') return false
  if (state.sCount[startLine] - state.blkIndent >= 4) return false

  const first = state.src.slice(pos + 2, firstLineEnd)
  const sameLineClose = first.indexOf('$$')
  if (sameLineClose >= 0) {
    if (silent) return true
    state.line = startLine + 1
    const token = state.push('math_block', 'math', 0)
    token.content = first.slice(0, sameLineClose).trim()
    token.markup = '$$'
    token.map = [startLine, state.line]
    return true
  }

  let content = first
  let nextLine = startLine + 1
  while (nextLine < endLine) {
    pos = state.bMarks[nextLine] + state.tShift[nextLine]
    const lineEnd = state.eMarks[nextLine]
    const line = state.src.slice(pos, lineEnd)
    const closeIdx = line.indexOf('$$')
    if (closeIdx >= 0) {
      content += `\n${line.slice(0, closeIdx)}`
      if (silent) return true
      state.line = nextLine + 1
      const token = state.push('math_block', 'math', 0)
      token.content = content.trim()
      token.markup = '$$'
      token.map = [startLine, nextLine + 1]
      return true
    }
    content += `\n${line}`
    nextLine += 1
  }
  return false
}

function renderInline(tokens, idx) {
  const token = tokens[idx]
  return renderKatex(token.content, Boolean(token.display))
}

function renderBlock(tokens, idx) {
  const content = tokens[idx].content
  // \tag 与 equation 环境会把编号贴在右侧，需要给容器留出空间
  const hasTag = /\\tag\b/.test(content) || /\\begin\{equation\}/.test(content)
  return `<div class="math-block${hasTag ? ' has-tag' : ''}">${renderKatex(content, true)}</div>\n`
}

/** markdown-it 数学插件：$…$ / $$…$$ / \(…\) / \[…\] */
export function mathPlugin(md) {
  md.inline.ruler.before('escape', 'math_inline', inlineMath)
  md.block.ruler.before('fence', 'math_block', blockMath, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  md.renderer.rules.math_inline = renderInline
  md.renderer.rules.math_block = renderBlock
}
