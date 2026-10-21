/**
 * PDF 文本后处理：
 * 1. 去掉每页重复的页眉页脚与页码；
 * 2. 把被 PDF 硬换行切断的句子重新接起来；
 * 3. 识别「第 X 章」「一、」「1.2」这类标题，作为分块 heading，
 *    这样引用里才会出现「第 3 章 · 留数定理」而不是一片空白。
 */

const PAGE_NO_RE = /^[\s\-—–·•第页]*\d{1,4}\s*(?:\/\s*\d{1,4})?[\s\-—–·•页]*$/

const HEADING_PATTERNS = [
  /^第\s*[一二三四五六七八九十百千\d]+\s*[章节讲篇部]/,
  /^[一二三四五六七八九十]+\s*[、.．]/,
  /^[（(]\s*[一二三四五六七八九十\d]+\s*[)）]\s*\S/,
  /^§\s*\d/,
  /^(Chapter|Section|Part|Appendix)\s+\d/i,
  /^\d+(?:\.\d+){0,3}\s*[、.．]?\s*\S/,
]

const LIST_ITEM_RE = /^([（(]?\d{1,2}[)）.、．]|[•·▪◦*\-–—]|[一二三四五六七八九十]+[、.．])/
const SENTENCE_END_RE = /[。！？；：.!?;:]$/

export function isPageNumber(line) {
  const text = String(line ?? '').trim()
  if (!text) return false
  return PAGE_NO_RE.test(text)
}

export function isHeadingLine(line) {
  const text = String(line ?? '').trim()
  if (!text || text.length > 36) return false
  if (SENTENCE_END_RE.test(text)) return false
  return HEADING_PATTERNS.some((pattern) => pattern.test(text))
}

export function isListItem(line) {
  return LIST_ITEM_RE.test(String(line ?? '').trim())
}

function headerKey(line) {
  return String(line)
    .replace(/\d+/g, '#')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 去掉在多数页面重复出现的短行（页眉、页脚、课程名水印等） */
export function stripRunningHeaders(pages, threshold = 0.6) {
  const total = pages.length
  if (total < 3) return pages
  const counts = new Map()
  for (const page of pages) {
    const seen = new Set()
    for (const line of page.lines) {
      const trimmed = String(line ?? '').trim()
      if (!trimmed || trimmed.length > 60) continue
      const key = headerKey(trimmed)
      if (!key || seen.has(key)) continue
      seen.add(key)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }

  const limit = Math.max(3, Math.ceil(total * threshold))
  const repeated = new Set(
    [...counts.entries()].filter(([, count]) => count >= limit).map(([key]) => key),
  )
  if (!repeated.size) return pages

  return pages.map((page) => ({
    ...page,
    lines: page.lines.filter((line) => {
      const trimmed = String(line ?? '').trim()
      return trimmed && !repeated.has(headerKey(trimmed))
    }),
  }))
}

function joinLine(prev, next) {
  if (!prev) return next
  const last = prev.slice(-1)
  const first = next[0] || ''
  const cjk = /[\u3400-\u9fff\uf900-\ufaff]/
  if (cjk.test(last) || cjk.test(first)) return `${prev}${next}`
  if (/[A-Za-z0-9]$/.test(prev) && /^[A-Za-z0-9]/.test(next)) return `${prev} ${next}`
  // 连字符断词：exam- ple -> example
  if (/-$/.test(prev) && /^[A-Za-z]/.test(next)) return `${prev.slice(0, -1)}${next}`
  return `${prev}${next}`
}

/**
 * @param {Array<{page: number, lines: string[]}>} pages
 * @returns {Array<{page: number, heading: string, text: string}>}
 */
export function cleanPdfPages(pages) {
  const filtered = stripRunningHeaders(pages || [])
  const sections = []

  for (const page of filtered) {
    const pageNo = page.page ?? null
    let heading = ''
    let buffer = ''

    const flush = () => {
      const text = buffer.trim()
      if (text) sections.push({ page: pageNo, heading, text })
      buffer = ''
    }

    for (const rawLine of page.lines) {
      const line = String(rawLine ?? '')
        .replace(/\u00ad/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
      if (!line) {
        flush()
        continue
      }
      if (isPageNumber(line)) continue

      if (isHeadingLine(line)) {
        flush()
        heading = line.replace(/\s+/g, ' ')
        continue
      }

      if (!buffer) {
        buffer = line
        continue
      }
      const prevEndsSentence = SENTENCE_END_RE.test(buffer)
      if (prevEndsSentence || isListItem(line)) {
        buffer = `${buffer}\n${line}`
      } else {
        buffer = joinLine(buffer, line)
      }
    }
    flush()
  }

  return sections.filter((section) => section.text.trim())
}

/** 从纯文本里识别章节标题，供 TXT/MD 或粘贴文本使用 */
export function splitByHeadings(text) {
  const lines = String(text ?? '').split('\n')
  const sections = []
  let heading = ''
  let buffer = []

  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body) sections.push({ heading, text: body })
    buffer = []
  }

  for (const line of lines) {
    if (isHeadingLine(line) && line.trim().length <= 36) {
      flush()
      heading = line.trim()
      continue
    }
    buffer.push(line)
  }
  flush()
  return sections
}
