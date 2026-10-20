/** 解析器共用的小工具 */

export function stripExtension(name = '') {
  return String(name).replace(/\.[^.]+$/, '')
}

export function extensionOf(name = '') {
  const m = String(name).match(/\.([^.]+)$/)
  return m ? m[1].toLowerCase() : ''
}

/** 解码 XML/HTML 实体 */
export function decodeXmlEntities(input) {
  return String(input ?? '').replace(
    /&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,
    (match, entity) => {
      switch (entity) {
        case 'lt':
          return '<'
        case 'gt':
          return '>'
        case 'amp':
          return '&'
        case 'quot':
          return '"'
        case 'apos':
          return "'"
        default: {
          const code = entity[1] === 'x' || entity[1] === 'X'
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10)
          return Number.isFinite(code) ? String.fromCodePoint(code) : match
        }
      }
    },
  )
}

/**
 * 文本文件解码：优先 UTF-8（严格模式），失败再尝试 GBK（中文 Windows 常见）。
 * @param {ArrayBuffer} buffer
 */
export function decodeTextBuffer(buffer) {
  const bytes = new Uint8Array(buffer)
  // BOM 处理
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('gbk').decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  }
}

/** 空文本判断：去掉空白和常见占位后是否还有内容 */
export function hasReadableText(text) {
  return String(text ?? '').replace(/[\s\u200b\ufeff]/g, '').length > 0
}
