/**
 * 解析质量检测：判断一份 PDF 是否「文字层缺公式」。
 * 典型症状：句子在「的」「求」「设」「在」处断掉，或每页字数少得异常。
 */

const DANGLING_END = /(的|求|设|是|有|在|则|且|使|为|与|和|对|从|到|得|若|当)$/

/**
 * @param {string} text
 * @param {{pages?: number, charsPerPage?: number}} [meta]
 */
export function detectFormulaGaps(text, meta = {}) {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  const pages = Number(meta.pages) || null
  const chars = String(text ?? '').length
  const charsPerPage = pages ? Math.round(chars / pages) : Number(meta.charsPerPage) || null
  const gapCount = Number(meta.gapCount) || 0

  const suspicious = lines.filter((line) => line.length <= 48 && DANGLING_END.test(line))
  const ratio = lines.length ? suspicious.length / lines.length : 0
  const lowDensity = charsPerPage != null ? charsPerPage < 260 : false

  // 证据一：pdf.js 拿到了大宽度的空白项（数学字形缺 ToUnicode）
  const manyGlyphGaps = gapCount >= Math.max(2, Math.ceil((pages || 1) * 2))
  // 证据二：断句 + 页面字数异常少
  const brokenSentences = lowDensity && ratio > 0.12
  const needsRecognition = Boolean(manyGlyphGaps || brokenSentences || ratio > 0.35)

  return {
    needsRecognition,
    ratio: Math.round(ratio * 100) / 100,
    suspiciousCount: suspicious.length,
    charsPerPage,
    gapCount,
    samples: suspicious.slice(0, 3),
  }
}

/** 给用户看的一句话解释 */
export function describeQuality(quality) {
  if (!quality?.needsRecognition) return ''
  return '这份资料的文字层里缺少公式（PDF 数学字体没有 Unicode 映射），句子会在公式处断掉。建议用「AI 识别公式」重新转录。'
}
