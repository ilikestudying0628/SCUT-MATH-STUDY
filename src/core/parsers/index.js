import { extensionOf, hasReadableText } from './common.js'
import { parsePdf } from './pdf.js'
import { parseDocx } from './docx.js'
import { parsePptx } from './pptx.js'
import { parsePastedText, parseTextFile } from './text.js'
import { cleanText } from '../text.js'

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'md', 'markdown', 'tex', 'csv']

export const MAX_FILE_BYTES = 60 * 1024 * 1024
const MAX_TEXT_CHARS = 2_000_000

export class ParseError extends Error {
  constructor(message, { code = 'parse_failed' } = {}) {
    super(message)
    this.name = 'ParseError'
    this.code = code
  }
}

function friendlyMessage(error, ext) {
  const raw = String(error?.message || error || '')
  if (/password/i.test(raw) || /encrypted/i.test(raw)) {
    return '这个 PDF 有密码保护，请先解除加密再上传。'
  }
  if (/invalid pdf|invalid header|broken/i.test(raw)) {
    return 'PDF 文件结构损坏，无法读取；可以尝试用其他工具另存一份。'
  }
  if (/format/i.test(raw)) {
    return `无法识别这个 .${ext} 文件（可能扩展名与实际格式不符）。`
  }
  return `解析失败：${raw.slice(0, 160) || '未知原因'}`
}

/**
 * 统一入口：按扩展名选择解析器（解析器按需动态加载）。
 * @param {File} file
 * @param {{onProgress?: (done: number, total: number) => void}} [options]
 */
export async function parseFile(file, options = {}) {
  if (!file) throw new ParseError('没有选择文件。')
  const ext = extensionOf(file.name)
  const size = Number(file.size) || 0
  if (size > MAX_FILE_BYTES) {
    throw new ParseError('文件超过 60MB，请拆分后再上传。', { code: 'too_large' })
  }

  let result
  try {
    switch (ext) {
      case 'pdf':
        result = await parsePdf(file, options)
        break
      case 'docx':
        result = await parseDocx(file)
        break
      case 'pptx':
        result = await parsePptx(file)
        break
      case 'txt':
      case 'md':
      case 'markdown':
      case 'tex':
      case 'csv':
      case 'json':
      case 'log':
        result = await parseTextFile(file)
        break
      default:
        throw new ParseError(
          `暂不支持 .${ext || '未知'} 格式。请上传 PDF / DOCX / PPTX / TXT / MD，或直接用「粘贴文本」。`,
          { code: 'unsupported' },
        )
    }
  } catch (error) {
    if (error instanceof ParseError) throw error
    throw new ParseError(friendlyMessage(error, ext), { code: 'parse_failed' })
  }

  const warnings = []
  let text = cleanText(result.text)
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS)
    warnings.push(`文本超过 ${MAX_TEXT_CHARS / 10000} 万字，只保留前 ${MAX_TEXT_CHARS / 10000} 万字。`)
  }

  if (!hasReadableText(text)) {
    const hint =
      ext === 'pdf'
        ? '这可能是扫描版 PDF（图片），没有文字层。可以用「粘贴文本」手动录入，或换一份电子版资料。'
        : '文件里没有可提取的文字。'
    throw new ParseError(hint, { code: 'empty_text' })
  }

  if (ext === 'pdf' && result.meta?.pages) {
    const perPage = text.length / Math.max(1, result.meta.parsedPages || result.meta.pages)
    if (perPage < 60) {
      warnings.push('每页提取到的文字很少，可能是扫描件或公式图片，建议核对后再用。')
    }
    if (result.meta.truncatedPages) {
      warnings.push(`文档共 ${result.meta.pages} 页，只解析了前 ${result.meta.parsedPages} 页。`)
    }
  }

  return {
    text,
    sections: result.sections,
    meta: { ...result.meta, ext, size, chars: text.length },
    warnings,
  }
}

export { parsePastedText }
