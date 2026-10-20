import { buildIndex, search } from './bm25.js'
import { tokenize } from './tokenizer.js'

const MAX_CITATION_CHARS = 1800

function docTitleOf(doc) {
  return doc?.title || doc?.fileName || '未命名资料'
}

function tokenSet(text) {
  return new Set(tokenize(text))
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/** 组合检索 query：问题 + 课程 + 侧重点 */
export function buildQuery({ question, courseName = '', focus = '' }) {
  return [question, courseName, focus].filter(Boolean).join(' ').trim()
}

/**
 * 依据资料检索与问题最相关的片段，并生成带编号的上下文。
 * @param {object} params
 * @param {string} params.query
 * @param {Array} params.chunks    {id, docId, index, text, heading, page}
 * @param {Array} params.docs      {id, title}
 * @param {string[]|null} [params.docIds] 限定资料范围；null/空数组表示全部
 * @param {number} [params.topK]
 * @param {number} [params.maxChars]
 * @param {number} [params.perDocLimit]
 * @param {object|null} [params.index] 预构建索引（复用可提速）
 * @param {boolean} [params.withNeighbors]
 */
export function retrieveChunks(params) {
  const {
    query,
    chunks = [],
    docs = [],
    docIds = null,
    topK = 8,
    maxChars = 12000,
    perDocLimit = 3,
    index: providedIndex = null,
    withNeighbors = true,
  } = params || {}

  const docTitles = new Map(docs.map((d) => [d.id, docTitleOf(d)]))
  const scope = Array.isArray(docIds) && docIds.length ? new Set(docIds) : null
  const pool = chunks.filter((c) => c && c.text && (!scope || scope.has(c.docId)))

  const result = {
    citations: [],
    contextText: '',
    usedChars: 0,
    usedTokens: 0,
    candidateCount: 0,
    droppedCount: 0,
    emptyReason: '',
  }

  if (!pool.length) {
    result.emptyReason = 'scope-empty'
    return result
  }

  const tokens = tokenize(query || '')
  if (!tokens.length) {
    result.emptyReason = 'empty-query'
    return result
  }

  const index =
    providedIndex ||
    buildIndex(pool.map((c) => ({ id: c.id, text: c.text, title: c.heading })))

  const byId = new Map(pool.map((c) => [c.id, c]))
  const scored = search(index, tokens, {
    limit: Math.max(80, topK * 10),
    filter: (id) => byId.has(id),
  })
  result.candidateCount = scored.length

  if (!scored.length) {
    result.emptyReason = 'no-match'
    return result
  }

  const picked = []
  const pickedIds = new Set()
  const perDoc = new Map()
  const pickedTokenSets = []

  for (const hit of scored) {
    if (picked.length >= topK) break
    const chunk = byId.get(hit.id)
    if (!chunk || pickedIds.has(chunk.id)) continue
    const used = perDoc.get(chunk.docId) || 0
    if (used >= perDocLimit) continue
    const ts = tokenSet(chunk.text)
    if (pickedTokenSets.some((prev) => jaccard(prev, ts) > 0.62)) continue
    picked.push(chunk)
    pickedIds.add(chunk.id)
    pickedTokenSets.push(ts)
    perDoc.set(chunk.docId, used + 1)
  }

  // 相邻块扩展：检索块正好切在句子中间时补上下文
  if (withNeighbors) {
    const extra = []
    const byKey = new Map(pool.map((c) => [`${c.docId}:${c.index}`, c]))
    for (const chunk of picked) {
      for (const delta of [-1, 1]) {
        const neighbor = byKey.get(`${chunk.docId}:${chunk.index + delta}`)
        if (!neighbor || pickedIds.has(neighbor.id)) continue
        if (picked.length + extra.length >= topK + 3) break
        extra.push(neighbor)
        pickedIds.add(neighbor.id)
      }
    }
    for (const chunk of extra) {
      const current = tokenSet(chunk.text)
      if (pickedTokenSets.some((prev) => jaccard(prev, current) > 0.8)) continue
      picked.push(chunk)
      pickedTokenSets.push(current)
    }
  }

  // 按资料 + 顺序排列，引用编号稳定、阅读连贯
  picked.sort((a, b) => {
    if (a.docId !== b.docId) return String(a.docId).localeCompare(String(b.docId))
    return a.index - b.index
  })

  const citations = []
  let usedChars = 0
  for (const chunk of picked) {
    const text = chunk.text.length > MAX_CITATION_CHARS
      ? `${chunk.text.slice(0, MAX_CITATION_CHARS)}…`
      : chunk.text
    const n = citations.length + 1
    const header = `【资料${n}】《${docTitles.get(chunk.docId) || '未命名资料'}》${
      chunk.page != null ? ` 第 ${chunk.page} 页` : ''
    }${chunk.heading ? ` · ${chunk.heading}` : ''}`
    const block = `${header}\n${text}`
    if (citations.length && usedChars + block.length > maxChars) break
    citations.push({
      n,
      docId: chunk.docId,
      docTitle: docTitles.get(chunk.docId) || '未命名资料',
      page: chunk.page ?? null,
      heading: chunk.heading || '',
      chunkId: chunk.id,
      text,
    })
    usedChars += block.length
  }

  result.citations = citations
  result.contextText = citations
    .map(
      (c) =>
        `【资料${c.n}】《${c.docTitle}》${c.page != null ? ` 第 ${c.page} 页` : ''}${
          c.heading ? ` · ${c.heading}` : ''
        }\n${c.text}`,
    )
    .join('\n\n')
  result.usedChars = usedChars
  result.usedTokens = Math.ceil(usedChars * 0.85)
  result.droppedCount = Math.max(0, picked.length - citations.length)
  return result
}

/**
 * 出题场景：尽量覆盖整份资料，而不是只命中某个关键词。
 * 按每份资料的块数均匀抽样。
 */
export function spreadChunks(params) {
  const { chunks = [], docs = [], docIds = null, maxChars = 16000, minPerDoc = 2 } = params || {}
  const scope = Array.isArray(docIds) && docIds.length ? new Set(docIds) : null
  const pool = chunks.filter((c) => c && c.text && (!scope || scope.has(c.docId)))
  const docTitles = new Map(docs.map((d) => [d.id, docTitleOf(d)]))

  const groups = new Map()
  for (const c of pool) {
    if (!groups.has(c.docId)) groups.set(c.docId, [])
    groups.get(c.docId).push(c)
  }

  const selected = []
  let used = 0
  const docCount = Math.max(1, groups.size)
  const budgetPerDoc = Math.floor(maxChars / docCount)

  for (const [docId, list] of groups) {
    const sorted = [...list].sort((a, b) => a.index - b.index)
    const take = Math.max(minPerDoc, Math.ceil(sorted.length * 0.35))
    const step = Math.max(1, Math.floor(sorted.length / take))
    let docUsed = 0
    for (let i = 0; i < sorted.length; i += step) {
      const chunk = sorted[i]
      if (docUsed + chunk.text.length > budgetPerDoc && docUsed > 0) break
      selected.push(chunk)
      docUsed += chunk.text.length
      used += chunk.text.length
    }
    if (used >= maxChars) break
  }

  selected.sort((a, b) => {
    if (a.docId !== b.docId) return String(a.docId).localeCompare(String(b.docId))
    return a.index - b.index
  })

  const citations = []
  let chars = 0
  for (const chunk of selected) {
    const blockLen = chunk.text.length + 80
    if (chars + blockLen > maxChars && citations.length) break
    const n = citations.length + 1
    citations.push({
      n,
      docId: chunk.docId,
      docTitle: docTitles.get(chunk.docId) || '未命名资料',
      page: chunk.page ?? null,
      heading: chunk.heading || '',
      chunkId: chunk.id,
      text: chunk.text,
    })
    chars += blockLen
  }

  return {
    citations,
    contextText: citations
      .map(
        (c) =>
          `【资料${c.n}】《${c.docTitle}》${c.page != null ? ` 第 ${c.page} 页` : ''}${
            c.heading ? ` · ${c.heading}` : ''
          }\n${c.text}`,
      )
      .join('\n\n'),
    usedChars: chars,
  }
}
