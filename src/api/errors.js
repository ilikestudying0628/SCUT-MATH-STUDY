export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, code?: string, title?: string, hint?: string, retryable?: boolean, detail?: string}} [options]
   */
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code ?? ''
    this.title = options.title ?? '请求失败'
    this.hint = options.hint ?? ''
    this.retryable = Boolean(options.retryable)
    this.detail = options.detail ?? ''
  }
}

export function isApiError(error) {
  return error instanceof ApiError
}

export function parseErrorBody(bodyText) {
  if (!bodyText) return { message: '', code: '' }
  try {
    const parsed = JSON.parse(bodyText)
    const inner = parsed?.error ?? parsed
    return {
      message: String(inner?.message ?? '').trim(),
      code: String(inner?.code ?? inner?.type ?? '').trim(),
    }
  } catch {
    return { message: String(bodyText).slice(0, 300).trim(), code: '' }
  }
}

/**
 * @param {number} status
 * @param {string} bodyText
 * @returns {ApiError}
 */
export function errorFromResponse(status, bodyText) {
  const body = parseErrorBody(bodyText)
  const serverMsg = body.message
  const detail = serverMsg ? `（服务端信息：${serverMsg}）` : ''

  switch (status) {
    case 400:
      return new ApiError('请求格式有误，可能是资料过长或参数不合法。', {
        status,
        code: body.code || 'bad_request',
        title: '请求参数错误',
        hint: '试着减少资料范围、缩短问题，或在设置里调低上下文预算；如果是「AI 识别」，请把模型换成支持看图的 deepseek-flash。',
        detail: serverMsg,
      })
    case 401:
      return new ApiError('API Key 无效或已失效。', {
        status,
        code: body.code || 'invalid_api_key',
        title: 'API Key 校验失败',
        hint: '到「设置」里重新填写以 sk- 开头的 Key，并点「测试连接」。',
        detail: serverMsg,
      })
    case 402:
      return new ApiError('账户余额不足，无法继续调用。', {
        status,
        code: body.code || 'insufficient_balance',
        title: '余额不足',
        hint: '到 DeepSeek 开放平台充值后再试。',
        detail: serverMsg,
      })
    case 403:
      return new ApiError('当前 Key 没有权限访问该模型。', {
        status,
        code: body.code || 'forbidden',
        title: '无访问权限',
        hint: '换一个模型（如 deepseek-chat）或在平台检查 Key 权限。',
        detail: serverMsg,
      })
    case 422:
      return new ApiError('请求参数不合法。', {
        status,
        code: body.code || 'invalid_params',
        title: '参数错误',
        hint: '可能是上下文超长或参数类型不对，试着减少资料或降低温度设置。',
        detail: serverMsg,
      })
    case 429:
      return new ApiError('请求过于频繁，被服务端限流。', {
        status,
        code: body.code || 'rate_limit',
        title: '触发限流',
        hint: '等 10–30 秒再试；批量出题时不要连续点击。',
        retryable: true,
        detail: serverMsg,
      })
    case 500:
    case 502:
    case 503:
    case 504:
      return new ApiError('DeepSeek 服务端异常，请稍后重试。', {
        status,
        code: body.code || 'server_error',
        title: '服务端异常',
        hint: '稍等片刻后重试；如果持续失败，可到平台状态页确认。',
        retryable: true,
        detail: serverMsg,
      })
    default:
      return new ApiError(serverMsg || `请求失败（HTTP ${status}）。`, {
        status,
        code: body.code || 'http_error',
        title: `请求失败（${status}）`,
        hint: '检查网络、API 地址与 Key 是否正确。',
        detail: serverMsg,
      })
  }
}

export function errorFromNetwork(error) {
  if (error?.name === 'AbortError') {
    return new ApiError('你停止了本次生成。', {
      code: 'aborted',
      title: '已停止',
    })
  }
  return new ApiError('网络连接失败，或请求被浏览器/代理拦截。', {
    code: 'network',
    title: '无法连接 DeepSeek',
    hint: '检查网络与代理设置；也可在设置里把 API 地址改成你自己的反向代理地址。',
    retryable: true,
    detail: error?.message || '',
  })
}

export function describeError(error) {
  if (error instanceof ApiError) {
    return {
      title: error.title,
      message: error.message,
      hint: error.hint,
      retryable: error.retryable,
      detail: error.detail,
      code: error.code,
      status: error.status,
    }
  }
  return {
    title: '出错了',
    message: error?.message ? String(error.message) : String(error ?? '未知错误'),
    hint: '',
    retryable: false,
    detail: '',
    code: 'unknown',
    status: 0,
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'aborted'
}
