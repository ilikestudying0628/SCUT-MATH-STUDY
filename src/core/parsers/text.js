import { cleanText } from '../text.js'
import { decodeTextBuffer, stripExtension } from './common.js'

/** 按 Markdown 标题切节；没有标题就整篇一节 */
export function sectionsFromMarkdown(text) {
  const sections = []
  let heading = ''
  let buffer = []

  const flush = () => {
    const body = cleanText(buffer.join('\n'))
    if (body) sections.push({ heading, text: body })
    buffer = []
  }

  for (const line of String(text ?? '').split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (match) {
      flush()
      heading = match[2].trim().slice(0, 120)
      continue
    }
    buffer.push(line)
  }
  flush()

  if (!sections.length && text.trim()) {
    sections.push({ heading: '', text: cleanText(text) })
  }
  return sections
}

/**
 * TXT / MD / TeX / CSV 等纯文本文件
 * @param {File} file
 */
export async function parseTextFile(file) {
  const buffer = await file.arrayBuffer()
  const raw = decodeTextBuffer(buffer)
  const text = cleanText(raw)
  const name = file?.name || ''
  const isMarkdown = /\.(md|markdown)$/i.test(name)

  const sections = isMarkdown
    ? sectionsFromMarkdown(text)
    : [{ heading: stripExtension(name), text }]

  return {
    text,
    sections,
    meta: { kind: isMarkdown ? 'markdown' : 'text', bytes: buffer.byteLength },
  }
}

/** 用户直接粘贴的文本 */
export function parsePastedText(text, title = '') {
  const cleaned = cleanText(text)
  const sections = /^#{1,6}\s+/m.test(cleaned)
    ? sectionsFromMarkdown(cleaned)
    : [{ heading: title, text: cleaned }]
  return {
    text: cleaned,
    sections,
    meta: { kind: 'pasted' },
  }
}
