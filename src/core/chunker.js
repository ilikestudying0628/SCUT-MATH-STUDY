import { cleanText, splitBlocks } from './text.js'

const SENTENCE_END = /[。！？；;.!?]\s?/

function splitLongBlock(block, maxChars) {
  if (block.length <= maxChars) return [block]
  const parts = []
  let rest = block
  while (rest.length > maxChars) {
    const windowText = rest.slice(0, maxChars)
    const m = windowText.match(/[\s\S]*[。！？；;.!?]\s?/)
    let cut = -1
    if (m && m[0].length > maxChars * 0.5) {
      cut = m[0].length
    } else {
      const nl = windowText.lastIndexOf('\n')
      cut = nl > maxChars * 0.5 ? nl + 1 : maxChars
    }
    if (cut <= 0) cut = maxChars
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut)
  }
  if (rest.trim()) parts.push(rest.trim())
  return parts
}

function overlapTail(text, overlap) {
  if (overlap <= 0) return ''
  const tail = text.slice(Math.max(0, text.length - overlap))
  // 尽量从一个完整句子/空白之后开始，保持可读
  const m = tail.match(/^[\s\S]*?[。！？；;.!?\n]\s*/)
  if (m && m[0].length > 0 && m[0].length < tail.length) return m[0].trim()
  return tail.trim()
}

/**
 * 把「按页/按标题切好的段落组」切成检索块。
 * @param {Array<{text: string, page?: number|null, heading?: string}>} sections
 * @param {{maxChars?: number, overlap?: number, minChars?: number}} [options]
 * @returns {Array<{index: number, text: string, page: number|null, heading: string}>}
 */
export function chunkSections(sections, options = {}) {
  const maxChars = Math.max(120, Number(options.maxChars) || 800)
  const overlap = Math.max(0, Math.min(Number(options.overlap) || 0, Math.floor(maxChars / 3)))
  const minChars = Math.max(0, Number(options.minChars) || 80)

  const out = []

  for (const section of sections || []) {
    const text = cleanText(section?.text)
    if (!text) continue

    const page = section?.page ?? null
    const heading = String(section?.heading ?? '').trim()
    const blocks = splitBlocks(text).flatMap((b) => splitLongBlock(b, maxChars))

    let buf = ''
    const local = []
    for (const block of blocks) {
      if (!buf) {
        buf = block
        continue
      }
      if (buf.length + 1 + block.length <= maxChars) {
        buf += '\n' + block
        continue
      }
      local.push(buf)
      const tail = overlapTail(buf, overlap)
      buf = tail && tail.length + 1 + block.length <= maxChars ? `${tail}\n${block}` : block
    }
    if (buf.trim()) local.push(buf)

    for (const piece of local) {
      const prev = out[out.length - 1]
      if (
        prev &&
        piece.length < minChars &&
        prev.page === page &&
        prev.heading === heading &&
        prev.text.length + 1 + piece.length <= maxChars
      ) {
        prev.text = `${prev.text}\n${piece}`
        continue
      }
      out.push({ index: out.length, text: piece, page, heading })
    }
  }

  return out.map((c, i) => ({ ...c, index: i }))
}

/** 纯文本（TXT/MD/粘贴）分块 */
export function chunkPlainText(text, options = {}) {
  return chunkSections([{ text }], options)
}

export { SENTENCE_END }
