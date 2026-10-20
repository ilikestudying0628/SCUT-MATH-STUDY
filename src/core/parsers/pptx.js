import { cleanText } from '../text.js'
import { decodeXmlEntities } from './common.js'

function slideNumber(path) {
  const match = path.match(/slide(\d+)\.xml$/)
  return match ? Number(match[1]) : 0
}

function slideParagraphs(xml) {
  const paragraphs = []
  const rawParagraphs = xml.split(/<\/a:p>/)
  for (const raw of rawParagraphs) {
    const texts = [...raw.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1]),
    )
    if (!texts.length) continue
    const line = texts.join(' ').replace(/\s+/g, ' ').trim()
    if (line) paragraphs.push(line)
  }
  return paragraphs
}

export async function parsePptx(file) {
  const JSZipModule = await import('jszip')
  const JSZip = JSZipModule.default || JSZipModule
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b))

  if (!slideFiles.length) {
    throw new Error('这个 PPTX 里没有找到幻灯片（可能是 .ppt 旧格式或文件已损坏）。')
  }

  const sections = []
  for (const name of slideFiles.slice(0, 300)) {
    const entry = zip.file(name)
    if (!entry) continue
    const xml = await entry.async('string')
    const paragraphs = slideParagraphs(xml)
    if (!paragraphs.length) continue
    const no = slideNumber(name)
    const heading = paragraphs.length > 1 ? paragraphs[0] : `幻灯片 ${no}`
    sections.push({
      page: no,
      heading: heading.slice(0, 120),
      text: cleanText(paragraphs.join('\n')),
    })
  }

  if (!sections.length) {
    throw new Error('这份 PPTX 的幻灯片里没有可提取的文字（可能全是图片）。')
  }

  const text = sections
    .map((s) => `## ${s.heading}\n${s.text}`)
    .join('\n\n')

  return {
    text: cleanText(text),
    sections,
    meta: { kind: 'pptx', slides: sections.length },
  }
}
