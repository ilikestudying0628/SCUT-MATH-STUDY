import katex from 'katex'

const MAX_INLINE_MATH = 600

function renderKatex(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
    })
  } catch (error) {
    const safe = String(tex)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<code class="math-error" title="${String(error?.message || '').replace(/"/g, '&quot;')}">${safe}</code>`
  }
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
  // 纯数字交给 KaTeX 渲染；货币写法已由「结尾 $ 后紧跟数字」的规则排除
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
  if (srcSlice(state, pos, pos + 2) !== '$$') return false
  if (state.sCount[startLine] - state.blkIndent >= 4) return false

  const first = srcSlice(state, pos + 2, firstLineEnd)
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
    const line = srcSlice(state, pos, lineEnd)
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

function srcSlice(state, from, to) {
  return state.src.slice(from, to)
}

function renderInline(tokens, idx) {
  const token = tokens[idx]
  return renderKatex(token.content, Boolean(token.display))
}

function renderBlock(tokens, idx) {
  return `<div class="math-block">${renderKatex(tokens[idx].content, true)}</div>\n`
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

export { renderKatex }
