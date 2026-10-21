import { cleanPdfPages } from './pdfCleanup.js'

let pdfjsPromise = null

export async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })()
  }
  return pdfjsPromise
}

function isCjk(ch) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(ch || '')
}

/** 把 pdf.js 的 textContent 还原成行：先按 y 聚行，再按 x 排序拼接 */
export function itemsToLines(items = []) {
  const parts = []
  for (const item of items) {
    const str = item?.str
    if (!str || !str.trim()) continue
    const transform = item.transform || []
    parts.push({
      str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      w: Number(item.width) || 0,
      h: Number(item.height) || 10,
    })
  }
  if (!parts.length) return []

  parts.sort((a, b) => b.y - a.y || a.x - b.x)

  const rows = []
  let current = null
  for (const part of parts) {
    const tolerance = Math.max(2, part.h * 0.45)
    if (!current || Math.abs(current.y - part.y) > tolerance) {
      current = { y: part.y, parts: [] }
      rows.push(current)
    }
    current.parts.push(part)
  }

  const lines = []
  for (const row of rows) {
    row.parts.sort((a, b) => a.x - b.x)
    let line = ''
    let prevEnd = null
    let prevPart = null
    for (const part of row.parts) {
      if (prevEnd != null) {
        const gap = part.x - prevEnd
        const threshold = Math.max(1.1, (prevPart?.h || part.h) * 0.22)
        const needSpace =
          gap > threshold && !isCjk(line.slice(-1)) && !isCjk(part.str[0]) && !line.endsWith(' ')
        if (needSpace) line += ' '
      }
      line += part.str
      prevEnd = part.x + part.w
      prevPart = part
    }
    const trimmed = line.trim()
    if (trimmed) lines.push(trimmed)
  }
  return lines
}

export function itemsToText(items = []) {
  return itemsToLines(items).join('\n')
}

/**
 * 统计「字形缺失」的迹象：
 * 数学字体缺 Unicode 映射时，pdf.js 只能拿到空白项，但它的宽度很大（对应整段公式）。
 */
export function countGlyphGaps(items = []) {
  let gaps = 0
  for (const item of items) {
    const text = String(item?.str ?? '')
    if (text.trim()) continue
    if ((Number(item?.width) || 0) > 80) gaps += 1
  }
  return gaps
}

/**
 * @param {File|Blob} file
 * @param {{onProgress?: (page: number, total: number) => void, maxPages?: number}} [options]
 */
export async function parsePdf(file, options = {}) {
  const { onProgress, maxPages = 600 } = options
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())

  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const doc = await task.promise

  const total = doc.numPages
  const limit = Math.min(total, maxPages)
  const pages = []
  let gapCount = 0

  try {
    for (let pageNo = 1; pageNo <= limit; pageNo++) {
      const page = await doc.getPage(pageNo)
      const content = await page.getTextContent()
      gapCount += countGlyphGaps(content.items)
      pages.push({ page: pageNo, lines: itemsToLines(content.items) })
      page.cleanup?.()
      onProgress?.(pageNo, limit)
    }
  } finally {
    try {
      await doc.destroy()
    } catch {
      /* noop */
    }
  }

  const sections = cleanPdfPages(pages)
  const text = sections
    .map((section) => `${section.heading ? `## ${section.heading}\n` : ''}${section.text}`)
    .join('\n\n')

  return {
    text,
    sections,
    meta: {
      kind: 'pdf',
      pages: total,
      parsedPages: limit,
      truncatedPages: total > limit,
      charsPerPage: total ? Math.round(text.length / limit) : 0,
      gapCount,
    },
  }
}
