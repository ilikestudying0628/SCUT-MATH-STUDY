import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat } from '../src/api/deepseek.js'
import { ApiError } from '../src/api/errors.js'

const hasStreams = typeof ReadableStream === 'function' && typeof TextEncoder === 'function'

function streamResponse(parts, options = {}) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part))
      controller.close()
    },
  })
  const status = options.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    text: async () => options.bodyText ?? '',
  }
}

const MESSAGES = [{ role: 'user', content: '证明中值定理' }]

describe.skipIf(!hasStreams)('deepseek 流式解析', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('处理跨 chunk 的半帧、思考过程与 usage', async () => {
    const parts = [
      'data: {"choices":[{"delta":{"reasoning_content":"先想"}}]}\n\ndata: {"cho',
      'ices":[{"delta":{"content":"你好"}}]}\n\ndata: {"choices":[{"delta":{"content":"，世界"}}],"usa',
      'ge":{"total_tokens":10}}\n\ndata: [DONE]\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(parts)))

    const deltas = []
    const reasonings = []
    let usage = null
    const result = await streamChat({
      apiKey: 'sk-test',
      messages: MESSAGES,
      onDelta: (delta) => deltas.push(delta),
      onReasoning: (delta) => reasonings.push(delta),
      onUsage: (value) => {
        usage = value
      },
    })

    expect(result.content).toBe('你好，世界')
    expect(result.reasoning).toBe('先想')
    expect(deltas.join('')).toBe('你好，世界')
    expect(reasonings.join('')).toBe('先想')
    expect(usage.total_tokens).toBe(10)
  })

  it('支持 \\r\\n 分隔的空行', async () => {
    const parts = [
      'data: {"choices":[{"delta":{"content":"甲"}}]}\r\n\r\n',
      'data: {"choices":[{"delta":{"content":"乙"},"finish_reason":"stop"}]}\r\n\r\n',
      'data: [DONE]\r\n\r\n',
    ]
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(parts)))
    const result = await streamChat({ apiKey: 'sk-test', messages: MESSAGES })
    expect(result.content).toBe('甲乙')
    expect(result.finishReason).toBe('stop')
  })

  it('401 映射成可读错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([], {
          status: 401,
          bodyText: JSON.stringify({ error: { message: 'bad key' } }),
        }),
      ),
    )
    await expect(streamChat({ apiKey: 'sk-bad', messages: MESSAGES })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      title: 'API Key 校验失败',
    })
  })

  it('缺少 Key 时直接拒绝且不发起请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(streamChat({ apiKey: '', messages: MESSAGES })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('流内的 error 帧会抛出 ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse(['data: {"error":{"message":"server overloaded"}}\n\n']),
      ),
    )
    await expect(streamChat({ apiKey: 'sk-test', messages: MESSAGES })).rejects.toMatchObject({
      name: 'ApiError',
      title: '生成失败',
    })
  })

  it('网络异常映射成连接失败', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(streamChat({ apiKey: 'sk-test', messages: MESSAGES })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'network',
      title: '无法连接 DeepSeek',
    })
  })
})
