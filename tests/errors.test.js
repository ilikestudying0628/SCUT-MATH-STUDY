import { describe, expect, it } from 'vitest'
import {
  ApiError,
  describeError,
  errorFromNetwork,
  errorFromResponse,
  isAbortError,
  parseErrorBody,
} from '../src/api/errors.js'

describe('错误映射', () => {
  it('401 提示检查 Key', () => {
    const error = errorFromResponse(401, '{"error":{"message":"invalid key"}}')
    expect(error).toBeInstanceOf(ApiError)
    expect(error.title).toBe('API Key 校验失败')
    expect(error.hint).toContain('设置')
    expect(error.detail).toBe('invalid key')
  })

  it('402 提示余额不足', () => {
    expect(errorFromResponse(402, '{"error":{"message":"insufficient balance"}}').title).toBe(
      '余额不足',
    )
  })

  it('429 标记为可重试', () => {
    const error = errorFromResponse(429, '')
    expect(error.retryable).toBe(true)
    expect(error.title).toBe('触发限流')
  })

  it('5xx 标记为可重试', () => {
    expect(errorFromResponse(503, '').retryable).toBe(true)
  })

  it('无法解析的响应体不会抛错', () => {
    expect(parseErrorBody('not json').message).toContain('not json')
    expect(parseErrorBody('').message).toBe('')
  })

  it('网络异常与中断区分开', () => {
    const network = errorFromNetwork(new TypeError('Failed to fetch'))
    expect(network.code).toBe('network')
    expect(network.retryable).toBe(true)

    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(isAbortError(abort)).toBe(true)
    expect(errorFromNetwork(abort).code).toBe('aborted')
  })

  it('describeError 输出统一结构', () => {
    const info = describeError(errorFromResponse(401, ''))
    expect(info).toMatchObject({
      title: 'API Key 校验失败',
      retryable: false,
      status: 401,
    })
  })
})
