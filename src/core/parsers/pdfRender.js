import { loadPdfjs } from './pdf.js'

/**
 * 把 PDF 页面渲染成 JPEG/PNG data URL，交给视觉模型做「公式级」识别。
 * 文本层缺公式（Type3 字体、无 ToUnicode）时，这是唯一可靠的补救方式。
 *
 * @param {Blob|File} file
 * @param {{maxPages?: number, scale?: number, quality?: number, mime?: string, onProgress?: (done: number, total: number) => void}} [options]
 * @returns {Promise<Array<{page: number, dataUrl: string, width: number, height: number}>>}
 */
export async function renderPdfPageImages(file, options = {}) {
  const { maxPages = 30, scale = 1.8, quality = 0.82, mime = 'image/jpeg', onProgress } = options
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  const total = Math.min(doc.numPages, maxPages)
  const images = []

  try {
    for (let pageNo = 1; pageNo <= total; pageNo++) {
      const page = await doc.getPage(pageNo)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const context = canvas.getContext('2d', { alpha: false })
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise
      images.push({
        page: pageNo,
        dataUrl: canvas.toDataURL(mime, quality),
        width: canvas.width,
        height: canvas.height,
      })
      page.cleanup?.()
      onProgress?.(pageNo, total)
    }
  } finally {
    try {
      await doc.destroy()
    } catch {
      /* noop */
    }
  }

  return images
}

/** 单张图片文件 → data URL（用于截图/拍照上传） */
export async function readImageAsDataUrl(file, { maxWidth = 2000, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxWidth / Math.max(1, bitmap.width))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  const context = canvas.getContext('2d', { alpha: false })
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height }
}
