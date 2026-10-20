/**
 * 粗略 token 估算：中文 1 字 ≈ 1 token，其他字符 ≈ 3.5 字符/token。
 * 只用于本地上下文预算，不追求与真实 tokenizer 完全一致。
 */
export function estimateTokens(text) {
  const s = String(text ?? '')
  if (!s) return 0
  let cjk = 0
  for (const ch of s) {
    const code = ch.codePointAt(0)
    if (
      (code >= 0x3400 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x20000 && code <= 0x2ebef)
    ) {
      cjk++
    }
  }
  return Math.ceil(cjk + (s.length - cjk) / 3.5)
}

export function estimateMessages(messages) {
  return (messages || []).reduce(
    (sum, m) => sum + estimateTokens(m?.content) + estimateTokens(m?.reasoning) + 4,
    0,
  )
}

/**
 * 从最新往旧保留历史消息，超出预算就丢最旧的。
 * 至少保留最后一条用户消息，避免把本次提问裁掉。
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} maxTokens
 */
export function trimHistory(messages, maxTokens = 2400) {
  const list = (messages || []).filter((m) => m && m.content)
  if (!list.length) return []
  const kept = []
  let used = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    const cost = estimateTokens(m.content) + 4
    if (kept.length && used + cost > maxTokens) break
    kept.unshift({ role: m.role, content: m.content })
    used += cost
  }
  while (kept.length > 1 && kept[0].role === 'assistant') kept.shift()
  return kept
}
