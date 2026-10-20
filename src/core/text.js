/** 文本清洗与通用小工具 */

/** 统一换行、去掉行尾空白、把 3 个以上连续空行压成 2 个 */
export function cleanText(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t\u00a0]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 按空行切段 */
export function splitBlocks(text) {
  return cleanText(text)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
}

export function truncate(text, max = 120, tail = '…') {
  const s = String(text ?? '')
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + tail
}

/** 把 Vue 响应式对象转成可写入 IndexedDB 的普通对象 */
export function toPlain(value) {
  if (value == null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

/** FNV-1a 32 位哈希，用于去重键（非加密用途） */
export function hashString(input) {
  let h = 0x811c9dc5
  const s = String(input ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function formatDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.round(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.round(hour / 24)
  if (day < 30) return `${day} 天前`
  return formatDateTime(ts).slice(0, 10)
}

/** 从一段文本里判断是不是中文为主，用于消息语言提示等 */
export function cjkRatio(text) {
  const s = String(text ?? '')
  if (!s.length) return 0
  const cjk = (s.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length
  return cjk / s.length
}
