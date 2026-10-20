import { tokenize } from './tokenizer.js'

export const BM25_K1 = 1.2
export const BM25_B = 0.75

/**
 * 构建内存倒排索引。资料量在数千块量级时 < 50ms，无需 Worker。
 * @param {Array<{id: string, text: string, title?: string}>} items
 */
export function buildIndex(items) {
  const postings = new Map()
  const lens = new Map()
  const itemsById = new Map()
  let totalLen = 0

  for (const item of items || []) {
    if (!item || !item.id) continue
    const title = item.title ? String(item.title) : ''
    // 标题多计两次，等价于标题命中加权
    const tokens = [...tokenize(item.text || ''), ...tokenize(title), ...tokenize(title)]
    const tf = new Map()
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)

    lens.set(item.id, tokens.length)
    itemsById.set(item.id, item)
    totalLen += tokens.length

    for (const [term, count] of tf) {
      let posting = postings.get(term)
      if (!posting) {
        posting = new Map()
        postings.set(term, posting)
      }
      posting.set(item.id, count)
    }
  }

  const N = itemsById.size
  return {
    N,
    avgdl: N ? totalLen / N : 0,
    postings,
    lens,
    itemsById,
    get(term) {
      return postings.get(term)
    },
    df(term) {
      return postings.get(term)?.size || 0
    },
  }
}

/**
 * @param {ReturnType<typeof buildIndex>} index
 * @param {string[]} queryTokens
 * @param {{limit?: number, filter?: (id: string) => boolean}} [options]
 * @returns {Array<{id: string, score: number, matched: number}>}
 */
export function search(index, queryTokens, options = {}) {
  const limit = options.limit ?? 30
  const filter = options.filter
  if (!index || !index.N || !queryTokens || !queryTokens.length) return []

  const scores = new Map()
  const matched = new Map()
  const seen = new Set()

  for (const term of queryTokens) {
    if (seen.has(term)) continue
    seen.add(term)
    const posting = index.postings.get(term)
    if (!posting) continue
    const df = posting.size
    const idf = Math.log(1 + (index.N - df + 0.5) / (df + 0.5))
    for (const [id, tf] of posting) {
      if (filter && !filter(id)) continue
      const dl = index.lens.get(id) || 1
      const norm = BM25_K1 * (1 - BM25_B + (BM25_B * dl) / (index.avgdl || 1))
      const score = (idf * tf * (BM25_K1 + 1)) / (tf + norm)
      scores.set(id, (scores.get(id) || 0) + score)
      matched.set(id, (matched.get(id) || 0) + 1)
    }
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score, matched: matched.get(id) || 0 }))
    .sort((a, b) => b.score - a.score || b.matched - a.matched)
    .slice(0, Math.max(1, limit))
}
