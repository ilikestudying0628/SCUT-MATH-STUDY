let pdfjsPromise = null

async function loadPdfjs() {
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
export function itemsToText(items = []) {
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
  if (!parts.length) return ''

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
  return lines.join('\n')
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
  const sections = []

  try {
    for (let pageNo = 1; pageNo <= limit; pageNo++) {
      const page = await doc.getPage(pageNo)
      const content = await page.getTextContent()
      sections.push({ page: pageNo, text: itemsToText(content.items), heading: '' })
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

  const text = sections
    .map((s) => s.text)
    .filter(Boolean)
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
    },
  }
}
