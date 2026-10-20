/**
 * 中英混合分词：优先 Intl.Segmenter（中文按词切分），
 * 并对 CJK 片段补充二元组，缓解分词边界造成的漏召回。
 * 不依赖任何第三方词典，全部在浏览器本地完成。
 */

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/
const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff]+/g

const STOPWORDS = new Set(
  [
    // 中文
    '的', '了', '和', '是', '在', '有', '就', '不', '也', '都', '而', '及', '与', '或', '被', '把',
    '这', '那', '其', '之', '中', '上', '下', '对', '从', '到', '为', '以', '于', '并', '且', '等',
    '我', '你', '他', '她', '它', '我们', '你们', '他们', '它们', '自己', '这个', '那个', '这些', '那些',
    '一个', '一种', '一些', '一下', '什么', '怎么', '如何', '为什么', '哪', '哪些', '哪个',
    '可以', '需要', '应该', '能够', '可能', '还是', '就是', '如果', '因为', '所以', '但是', '不过',
    '然后', '而且', '并且', '以及', '关于', '通过', '进行', '请', '帮', '帮我', '给', '让',
    '吗', '呢', '吧', '啊', '呀', '哦', '嗯', '么', '着', '过', '地', '得',
    '题', '问题', '题目', '一道', '一些', '怎样',
    // 英文
    'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'as', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'and', 'or', 'not', 'no', 'but', 'if', 'then', 'else', 'so',
    'this', 'that', 'these', 'those', 'it', 'its', 'we', 'you', 'i', 'they', 'he', 'she',
    'can', 'will', 'would', 'should', 'could', 'may', 'might', 'do', 'does', 'did', 'has', 'have',
    'had', 'from', 'into', 'about', 'which', 'what', 'how', 'why', 'when', 'where', 'there',
  ].map((w) => w.toLowerCase()),
)

let segmenterCache = null

function getSegmenter() {
  if (segmenterCache !== null) return segmenterCache
  try {
    segmenterCache =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('zh-Hans', { granularity: 'word' })
        : false
  } catch {
    segmenterCache = false
  }
  return segmenterCache
}

/** 仅供测试：强制走无 Segmenter 的退化路径 */
export function __setSegmenterForTest(value) {
  segmenterCache = value
}

export function normalizeToken(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^[\s"'`“”‘’()（）[\]【】{}<>,.;:!?、。，；：！？…—\-_/\\|~^*+=]+/, '')
    .replace(/[\s"'`“”‘’()（）[\]【】{}<>,.;:!?、。，；：！？…—\-_/\\|~^*+=]+$/, '')
    .trim()
}

function pushCjkTokens(out, run) {
  if (!run) return
  const length = [...run].length
  if (length === 1) {
    if (!STOPWORDS.has(run)) out.push(run)
    return
  }
  if (!STOPWORDS.has(run)) out.push(run)
  if (length === 2) return // 二元组本身就是这个词，不必重复
  // 二元组补充：让「全纯函数」「中值定理」这类复合词成为可检索单元
  for (let i = 0; i < run.length - 1; i++) {
    const bigram = run.slice(i, i + 2)
    if (!STOPWORDS.has(bigram)) out.push(bigram)
  }
}

function pushLatinTokens(out, raw) {
  const token = normalizeToken(raw)
  if (!token || STOPWORDS.has(token)) return
  if (/^\d+(\.\d+)?$/.test(token)) {
    out.push(token)
    return
  }
  if (token.length < 2) return
  out.push(token)
}

/**
 * @param {string} text
 * @param {{ bigrams?: boolean }} [options]
 * @returns {string[]} 词元数组（保留重复，BM25 需要词频）
 */
export function tokenize(text, options = {}) {
  const { bigrams = true } = options
  const src = String(text ?? '')
  if (!src.trim()) return []

  const out = []
  const seg = getSegmenter()

  if (seg) {
    // Segmenter 会把「可积」「中值」这类未登录词拆成单字，
    // 这里把连续的单字重新拼成一段，再补二元组。
    let pendingCjk = ''
    const flushPending = () => {
      if (pendingCjk) {
        pushCjkTokens(out, pendingCjk)
        pendingCjk = ''
      }
    }

    for (const part of seg.segment(src)) {
      const piece = String(part?.segment ?? '')
      if (!part || part.isWordLike === false) {
        flushPending()
        // 非词片段里可能夹着数字或拉丁字母，兜底扫一遍
        const pieces = piece.match(/[A-Za-z0-9_]+|\d+(?:\.\d+)?/g)
        if (pieces) pieces.forEach((p) => pushLatinTokens(out, p))
        continue
      }
      if (CJK.test(piece)) {
        const norm = piece.normalize('NFKC')
        if ([...norm].length === 1) {
          pendingCjk += norm
          continue
        }
        flushPending()
        if (bigrams) pushCjkTokens(out, norm)
        else if (!STOPWORDS.has(norm)) out.push(norm)
      } else {
        flushPending()
        pushLatinTokens(out, piece)
      }
    }
    flushPending()
    return out
  }

  // 退化路径：按字符类切分，CJK 连续段直接做二元组
  const chunks = src.match(/[A-Za-z0-9_]+(?:\.[0-9]+)?|[\u3400-\u9fff\uf900-\ufaff]+|\S/g) || []
  for (const chunk of chunks) {
    if (CJK.test(chunk)) {
      const runs = chunk.match(CJK_RUN) || []
      for (const run of runs) {
        if (bigrams) pushCjkTokens(out, run)
        else if (!STOPWORDS.has(run)) out.push(run)
      }
    } else if (/[A-Za-z0-9]/.test(chunk)) {
      pushLatinTokens(out, chunk)
    }
  }
  return out
}

export function isStopword(word) {
  return STOPWORDS.has(normalizeToken(word))
}
