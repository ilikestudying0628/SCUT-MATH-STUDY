import { defineStore } from 'pinia'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  normalizeBaseUrl,
  testConnection as apiTestConnection,
} from '../api/deepseek.js'
import { testConnection as mockTestConnection } from '../api/mock.js'
import { describeError } from '../api/errors.js'
import { DEFAULT_COURSE, getCourse } from '../core/courses.js'

const SETTINGS_KEY = 'scut-math-study:settings'
const KEY_LOCAL = 'scut-math-study:api-key'
const KEY_SESSION = 'scut-math-study:api-key-session'

const DEFAULTS = {
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  temperature: 0.7,
  topK: 8,
  contextChars: 12000,
  theme: 'auto',
  fontSize: 15,
  mockMode: false,
  course: DEFAULT_COURSE,
  customCourse: '',
  style: 'balanced',
  chunkSize: 800,
}

function readStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    ...DEFAULTS,
    apiKey: '',
    keyPersist: 'local',
    loaded: false,
    connection: { status: 'idle', message: '', models: [], latencyMs: 0 },
  }),

  getters: {
    hasKey: (state) => Boolean(state.apiKey.trim()),
    isMock: (state) => Boolean(state.mockMode),
    /** 没填 Key 也没有开演示模式时，所有调用入口都应该拦下来 */
    canCallApi: (state) => Boolean(state.mockMode || state.apiKey.trim()),
    courseMeta: (state) => getCourse(state.course),
    courseLabel: (state) =>
      state.course === 'custom'
        ? state.customCourse.trim() || '专业课'
        : getCourse(state.course).name,
    courseHint: (state) =>
      state.course === 'custom' ? '自定义课程' : getCourse(state.course).hint,
    keyMasked: (state) => {
      const key = state.apiKey.trim()
      if (!key) return ''
      if (key.length <= 8) return `${key.slice(0, 2)}••••`
      return `${key.slice(0, 4)}••••${key.slice(-4)}`
    },
    resolvedTheme: (state) => resolveTheme(state.theme),
    canRetry: (state) => state.connection.status === 'error',
  },

  actions: {
    load() {
      if (this.loaded) return
      const stored = readStoredSettings()
      for (const key of Object.keys(DEFAULTS)) {
        if (stored[key] !== undefined) this[key] = stored[key]
      }
      if (stored.keyPersist) this.keyPersist = stored.keyPersist
      try {
        const sessionKey = sessionStorage.getItem(KEY_SESSION)
        const localKey = localStorage.getItem(KEY_LOCAL)
        this.apiKey = sessionKey || localKey || ''
        if (sessionKey) this.keyPersist = 'session'
      } catch {
        this.apiKey = ''
      }
      this.loaded = true
      // 旧版本默认模型名（deepseek-chat / reasoner）已停产，自动迁移到当前默认模型
      if (['deepseek-chat', 'deepseek-reasoner'].includes(this.model)) {
        this.model = DEFAULT_MODEL
        this.save()
      }
      this.applyAppearance()
    },

    snapshot() {
      const snapshot = {}
      for (const key of Object.keys(DEFAULTS)) snapshot[key] = this[key]
      snapshot.keyPersist = this.keyPersist
      snapshot.apiKey = ''
      return snapshot
    },

    save() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.snapshot()))
      } catch {
        /* 存储被禁用时忽略，设置仍在内存里生效 */
      }
      this.baseUrl = normalizeBaseUrl(this.baseUrl)
      this.applyAppearance()
    },

    setApiKey(raw) {
      const value = String(raw ?? '').trim()
      this.apiKey = value
      this.persistKey()
      if (value) this.connection = { ...this.connection, status: 'idle', message: 'Key 已更新，建议点一次「测试连接」。' }
    },

    persistKey() {
      try {
        localStorage.removeItem(KEY_LOCAL)
        sessionStorage.removeItem(KEY_SESSION)
        if (!this.apiKey) return
        if (this.keyPersist === 'session') sessionStorage.setItem(KEY_SESSION, this.apiKey)
        else localStorage.setItem(KEY_LOCAL, this.apiKey)
      } catch {
        /* 隐私模式下可能不可写 */
      }
    },

    setKeyPersist(mode) {
      this.keyPersist = mode === 'session' ? 'session' : 'local'
      this.persistKey()
      this.save()
    },

    clearApiKey() {
      this.apiKey = ''
      try {
        localStorage.removeItem(KEY_LOCAL)
        sessionStorage.removeItem(KEY_SESSION)
      } catch {
        /* noop */
      }
      this.connection = { status: 'idle', message: '已清除本机保存的 Key。', models: [], latencyMs: 0 }
    },

    applyAppearance() {
      if (typeof document === 'undefined') return
      document.documentElement.dataset.theme = resolveTheme(this.theme)
      document.documentElement.style.setProperty('--fs-base', `${Number(this.fontSize) || 15}px`)
    },

    async testConnection() {
      if (this.mockMode) {
        this.connection = { status: 'testing', message: '演示模式：模拟连接中…', models: [], latencyMs: 0 }
        const result = await mockTestConnection()
        this.connection = {
          status: 'ok',
          message: `演示模式可用（未连接真实 API），耗时 ${result.latencyMs}ms`,
          models: result.models,
          latencyMs: result.latencyMs,
        }
        return true
      }
      if (!this.hasKey) {
        this.connection = { status: 'error', message: '请先填写 API Key。', models: [], latencyMs: 0 }
        return false
      }
      this.connection = { status: 'testing', message: '正在连接 DeepSeek…', models: [], latencyMs: 0 }
      try {
        const result = await apiTestConnection({ apiKey: this.apiKey, baseUrl: this.baseUrl })
        this.connection = {
          status: 'ok',
          message: `连接成功，耗时 ${result.latencyMs}ms`,
          models: result.models,
          latencyMs: result.latencyMs,
        }
        return true
      } catch (error) {
        const info = describeError(error)
        this.connection = {
          status: 'error',
          message: [info.message, info.hint].filter(Boolean).join(' '),
          models: [],
          latencyMs: 0,
        }
        return false
      }
    },

    resetPreference() {
      this.temperature = DEFAULTS.temperature
      this.topK = DEFAULTS.topK
      this.contextChars = DEFAULTS.contextChars
      this.chunkSize = DEFAULTS.chunkSize
      this.style = DEFAULTS.style
      this.save()
    },
  },
})
