import { cleanText } from '../text.js'
import { decodeXmlEntities } from './common.js'

const PARAGRAPH_RE = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g
const RUN_TOKEN_RE =
  /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<m:t(?:\s[^>]*)?>([\s\S]*?)<\/m:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>|<w:lastRenderedPageBreak\s*\/>/g

function paragraphText(xml) {
  let out = ''
  let match
  RUN_TOKEN_RE.lastIndex = 0
  while ((match = RUN_TOKEN_RE.exec(xml))) {
    if (match[1] != null) out += decodeXmlEntities(match[1])
    else if (match[2] != null) out += decodeXmlEntities(match[2])
    else if (match[0].includes('tab')) out += '\t'
    else if (match[0].includes('br') || match[0].includes('cr')) out += '\n'
  }
  return out
}

function paragraphStyle(xml) {
  const match = xml.match(/<w:pStyle[^>]*w:val="([^"]+)"/)
  return match ? match[1] : ''
}

function isHeadingStyle(style) {
  if (!style) return false
  return (
    /^heading\s*[1-6]$/i.test(style) ||
    /^heading[1-6]$/i.test(style) ||
    /^title$/i.test(style) ||
    /^[1-6]$/.test(style) ||
    /标题\s*[1-6]/.test(style)
  )
}

export async function parseDocx(file) {
  const JSZipModule = await import('jszip')
  const JSZip = JSZipModule.default || JSZipModule
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  const entry = zip.file('word/document.xml')
  if (!entry) {
    throw new Error('这个 DOCX 里没有正文（可能是旧版 .doc 或文件已损坏）。')
  }
  const xml = await entry.async('string')

  const sections = []
  let heading = ''
  let buffer = []

  const flush = () => {
    const text = cleanText(buffer.join('\n'))
    if (text) sections.push({ heading, text })
    buffer = []
  }

  const paragraphs = xml.match(PARAGRAPH_RE) || []
  for (const paragraph of paragraphs) {
    const raw = paragraphText(paragraph)
    const text = raw.replace(/\u0000/g, '').trim()
    if (!text) continue
    const style = paragraphStyle(paragraph)
    if (isHeadingStyle(style)) {
      flush()
      heading = text.slice(0, 120)
      continue
    }
    buffer.push(raw.replace(/[ \t]+\n/g, '\n'))
  }
  flush()

  if (!sections.length) {
    // 兜底：直接抓所有 w:t
    const fallback = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((m) => decodeXmlEntities(m[1]))
      .join('')
    if (fallback.trim()) sections.push({ heading: '', text: cleanText(fallback) })
  }

  const text = sections.map((s) => `${s.heading ? `## ${s.heading}\n` : ''}${s.text}`).join('\n\n')
  return {
    text: cleanText(text),
    sections,
    meta: { kind: 'docx', paragraphs: paragraphs.length },
  }
}
