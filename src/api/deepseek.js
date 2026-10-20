import { errorFromNetwork, errorFromResponse, isAbortError, ApiError } from './errors.js'

export const DEFAULT_BASE_URL = 'https://api.deepseek.com'

export const MODELS = [
  {
    id: 'deepseek-chat',
    label: 'deepseek-chat（通用对话，快）',
    note: '适合答疑、出题、批改',
  },
  {
    id: 'deepseek-reasoner',
    label: 'deepseek-reasoner（带思考过程）',
    note: '适合难题推导，速度较慢',
  },
]

export const DEFAULT_MODEL = 'deepseek-chat'

export function normalizeBaseUrl(input) {
  let s = String(input || DEFAULT_BASE_URL).trim()
  if (!s) s = DEFAULT_BASE_URL
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  s = s.replace(/\/+$/, '')
  s = s.replace(/\/chat\/completions$/i, '')
  return s
}

function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${String(apiKey || '').trim()}`,
  }
}

function buildBody({ model, messages, temperature, maxTokens, jsonMode, stream }) {
  const body = {
    model: model || DEFAULT_MODEL,
    messages,
    stream: Boolean(stream),
    temperature: typeof temperature === 'number' ? temperature : 0.7,
    max_tokens: Math.min(Math.max(Number(maxTokens) || 4096, 256), 8192),
  }
  if (stream) body.stream_options = { include_usage: true }
  if (jsonMode) body.response_format = { type: 'json_object' }
  return body
}

async function readErrorBody(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/** 逐帧解析 SSE（跨 chunk 半帧、\r\n、[DONE] 都要能处理） */
async function consumeStream(response, { onDelta, onReasoning, onUsage, signal }) {
  if (!response.body) {
    throw new ApiError('响应没有可读数据流。', { title: '流式响应异常' })
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let content = ''
  let reasoning = ''
  let usage = null
  let finishReason = ''
  let done = false

  const emitDelta = (text) => {
    if (!text) return
    content += text
    onDelta?.(text, content)
  }
  const emitReasoning = (text) => {
    if (!text) return
    reasoning += text
    onReasoning?.(text, reasoning)
  }

  const handleFrame = (frame) => {
    const lines = frame.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload) continue
      if (payload === '[DONE]') {
        done = true
        return
      }
      let parsed
      try {
        parsed = JSON.parse(payload)
      } catch {
        continue
      }
      if (parsed?.error) {
        throw new ApiError(String(parsed.error.message || '流式响应返回错误'), {
          code: String(parsed.error.code || ''),
          title: '生成失败',
          status: 400,
        })
      }
      if (parsed?.usage) usage = parsed.usage
      const choice = parsed?.choices?.[0]
      if (!choice) continue
      if (choice.finish_reason) finishReason = choice.finish_reason
      emitReasoning(choice.delta?.reasoning_content)
      emitDelta(choice.delta?.content)
    }
  }

  try {
    while (!done) {
      if (signal?.aborted) {
        const abortError = new Error('Aborted')
        abortError.name = 'AbortError'
        throw abortError
      }
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break
      buffer += decoder.decode(value, { stream: true })
      let sepIndex = buffer.search(/\r?\n\r?\n/)
      while (sepIndex >= 0) {
        const frame = buffer.slice(0, sepIndex)
        const sepLength = buffer.slice(sepIndex).match(/^\r?\n\r?\n/)?.[0]?.length || 2
        buffer = buffer.slice(sepIndex + sepLength)
        handleFrame(frame)
        if (done) break
        sepIndex = buffer.search(/\r?\n\r?\n/)
      }
    }
    buffer += decoder.decode()
    if (!done && buffer.trim()) handleFrame(buffer)
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* noop */
    }
  }

  if (usage) onUsage?.(usage)
  return { content, reasoning, usage, finishReason }
}

/**
 * 流式对话。
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} [params.baseUrl]
 * @param {string} [params.model]
 * @param {Array} params.messages
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @param {boolean} [params.jsonMode]
 * @param {AbortSignal} [params.signal]
 * @param {(delta: string, full: string) => void} [params.onDelta]
 * @param {(delta: string, full: string) => void} [params.onReasoning]
 * @param {(usage: object) => void} [params.onUsage]
 */
export async function streamChat(params) {
  const { apiKey, baseUrl, model, messages, temperature, maxTokens, jsonMode, signal } = params
  if (!String(apiKey || '').trim()) {
    throw new ApiError('还没有填写 DeepSeek API Key。', {
      code: 'missing_key',
      title: '缺少 API Key',
      hint: '打开「设置」填入 Key，或先开启演示模式。',
    })
  }

  let response
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(
        buildBody({ model, messages, temperature, maxTokens, jsonMode, stream: true }),
      ),
      signal,
    })
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error
    throw errorFromNetwork(error)
  }

  if (!response.ok) {
    throw errorFromResponse(response.status, await readErrorBody(response))
  }

  try {
    return await consumeStream(response, {
      onDelta: params.onDelta,
      onReasoning: params.onReasoning,
      onUsage: params.onUsage,
      signal,
    })
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error
    if (error instanceof ApiError) throw error
    throw errorFromNetwork(error)
  }
}

function delay(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener?.(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * 一次性（非流式）请求，用于出题、批改、总结等需要完整 JSON / Markdown 的场景。
 * 429 / 5xx 会自动重试一次。
 */
export async function chatOnce(params) {
  const { apiKey, baseUrl, model, messages, temperature, maxTokens, jsonMode, signal } = params
  if (!String(apiKey || '').trim()) {
    throw new ApiError('还没有填写 DeepSeek API Key。', {
      code: 'missing_key',
      title: '缺少 API Key',
      hint: '打开「设置」填入 Key，或先开启演示模式。',
    })
  }

  const maxAttempts = 2
  let response = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(
          buildBody({ model, messages, temperature, maxTokens, jsonMode, stream: false }),
        ),
        signal,
      })
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error
      const networkError = errorFromNetwork(error)
      if (attempt < maxAttempts && networkError.retryable) {
        await delay(1200, signal)
        continue
      }
      throw networkError
    }

    if (!response.ok) {
      const apiError = errorFromResponse(response.status, await readErrorBody(response))
      if (attempt < maxAttempts && apiError.retryable && !signal?.aborted) {
        await delay(1500, signal)
        continue
      }
      throw apiError
    }
    break
  }

  try {
    const data = await response.json()
    const choice = data?.choices?.[0]
    return {
      text: choice?.message?.content ?? '',
      reasoning: choice?.message?.reasoning_content ?? '',
      usage: data?.usage ?? null,
      finishReason: choice?.finish_reason ?? '',
      raw: data,
    }
  } catch (error) {
    throw new ApiError('响应解析失败，可能被代理截断。', {
      code: 'bad_response',
      title: '响应解析失败',
      detail: String(error?.message || ''),
    })
  }
}

/** 测试连接：GET /models */
export async function testConnection({ apiKey, baseUrl, signal }) {
  if (!String(apiKey || '').trim()) {
    throw new ApiError('请先填写 API Key。', {
      code: 'missing_key',
      title: '缺少 API Key',
    })
  }
  const startedAt = performance.now()
  let response
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${String(apiKey).trim()}` },
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw errorFromNetwork(error)
  }
  if (!response.ok) {
    throw errorFromResponse(response.status, await readErrorBody(response))
  }
  const data = await response.json().catch(() => ({}))
  const models = (data?.data || []).map((m) => m?.id).filter(Boolean)
  return {
    models,
    latencyMs: Math.round(performance.now() - startedAt),
    baseUrl: normalizeBaseUrl(baseUrl),
  }
}
