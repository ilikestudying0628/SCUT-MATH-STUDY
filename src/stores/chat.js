import { defineStore } from 'pinia'
import * as db from '../core/db.js'
import { toPlain } from '../core/text.js'
import { describeError, isAbortError } from '../api/errors.js'
import { streamChat } from '../api/deepseek.js'
import * as mock from '../api/mock.js'
import { buildTutorMessages, buildTutorSystem } from '../core/prompts/tutor.js'
import { buildQuery, retrieveChunks } from '../core/retrieval.js'
import { trimHistory } from '../core/tokenBudget.js'
import { useSettingsStore } from './settings.js'
import { useLibraryStore } from './library.js'

export const useChatStore = defineStore('chat', {
  state: () => ({
    chats: [],
    currentId: null,
    messages: [],
    loaded: false,
    streaming: false,
    error: null,
    scope: 'all',
    scopeDocIds: [],
    draft: '',
    abort: null,
    lastUsage: null,
  }),

  getters: {
    currentChat: (state) => state.chats.find((c) => c.id === state.currentId) || null,
    hasMessages: (state) => state.messages.length > 0,
    scopeLabel: (state) => {
      if (state.scope === 'none') return '不使用资料'
      if (state.scope === 'docs' && state.scopeDocIds.length) return `指定 ${state.scopeDocIds.length} 份资料`
      return '全部资料'
    },
  },

  actions: {
    async init() {
      if (this.loaded) return
      this.chats = await db.listChats()
      this.loaded = true
      if (!this.currentId && this.chats.length) {
        await this.selectChat(this.chats[0].id)
      }
    },

    async newChat() {
      this.currentId = null
      this.messages = []
      this.scope = 'all'
      this.scopeDocIds = []
      this.error = null
      this.draft = ''
    },

    async ensureChat(firstText) {
      const settings = useSettingsStore()
      if (this.currentId) {
        const existing = this.chats.find((c) => c.id === this.currentId)
        if (existing) return existing
      }
      const chat = {
        id: db.newId('chat'),
        title: String(firstText || '新对话').trim().slice(0, 24) || '新对话',
        course: settings.course,
        scope: this.scope,
        docIds: [...this.scopeDocIds],
        model: settings.model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.chats.unshift(chat)
      this.currentId = chat.id
      await db.putChat(toPlain(chat))
      return this.chats[0]
    },

    async selectChat(id) {
      if (this.streaming) return
      const chat = this.chats.find((c) => c.id === id)
      if (!chat) return
      this.currentId = id
      this.messages = await db.getMessages(id)
      this.scope = chat.scope || 'all'
      this.scopeDocIds = Array.isArray(chat.docIds) ? chat.docIds : []
      this.error = null
    },

    async renameChat(id, title) {
      const chat = this.chats.find((c) => c.id === id)
      if (!chat) return
      chat.title = String(title || '').trim().slice(0, 40) || '未命名对话'
      chat.updatedAt = Date.now()
      await db.putChat(toPlain(chat))
    },

    async deleteChat(id) {
      await db.deleteChatCascade(id)
      this.chats = this.chats.filter((c) => c.id !== id)
      if (this.currentId === id) await this.newChat()
    },

    async setScope(scope, docIds) {
      this.scope = scope
      if (docIds) this.scopeDocIds = [...docIds]
      const chat = this.chats.find((c) => c.id === this.currentId)
      if (chat) {
        chat.scope = this.scope
        chat.docIds = [...this.scopeDocIds]
        chat.updatedAt = Date.now()
        await db.putChat(toPlain(chat))
      }
    },

    stop() {
      this.abort?.abort()
    },

    async send(rawText) {
      const text = String(rawText ?? this.draft ?? '').trim()
      if (!text || this.streaming) return

      const settings = useSettingsStore()
      if (!settings.canCallApi) {
        this.error = {
          title: '还没有可用的 API Key',
          message: '到「设置」填入 DeepSeek API Key，或打开演示模式体验流程。',
          hint: '',
          retryable: false,
        }
        return
      }

      const chat = await this.ensureChat(text)
      const userMessage = {
        id: db.newId('msg'),
        chatId: chat.id,
        role: 'user',
        content: text,
        status: 'done',
        createdAt: Date.now(),
      }
      this.messages.push(userMessage)
      await db.putMessage(userMessage)

      chat.updatedAt = Date.now()
      if (!chat.title || chat.title === '新对话') chat.title = text.slice(0, 24)
      await db.putChat(toPlain(chat))
      this.draft = ''
      this.error = null
      await this._run(chat, text)
    },

    async _run(chat, question) {
      const settings = useSettingsStore()
      const library = useLibraryStore()

      const scopeIds =
        this.scope === 'none' ? [] : this.scope === 'docs' ? [...this.scopeDocIds] : null
      let retrieval = { citations: [], contextText: '', candidateCount: 0, emptyReason: '' }

      if (this.scope !== 'none' && library.chunks.length) {
        retrieval = retrieveChunks({
          query: buildQuery({ question, courseName: settings.courseLabel }),
          chunks: library.chunks,
          docs: library.docs,
          docIds: Array.isArray(scopeIds) && scopeIds.length ? scopeIds : null,
          topK: settings.topK,
          maxChars: settings.contextChars,
          index: library.getIndex(),
        })
      }

      const system = buildTutorSystem({
        courseName: settings.courseLabel,
        courseHint: settings.courseHint,
        contextText: retrieval.contextText,
      })

      const priorMessages = this.messages
        .slice(0, -1)
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map((m) => ({ role: m.role, content: m.content }))

      const payload = buildTutorMessages({
        system,
        history: trimHistory(priorMessages, 2400),
        question,
      })

      const assistant = {
        id: db.newId('msg'),
        chatId: chat.id,
        role: 'assistant',
        content: '',
        reasoning: '',
        citations: retrieval.citations,
        retrieval: {
          candidateCount: retrieval.candidateCount,
          droppedCount: retrieval.droppedCount || 0,
          emptyReason: retrieval.emptyReason || '',
        },
        usage: null,
        status: 'streaming',
        error: null,
        createdAt: Date.now(),
      }
      this.messages.push(assistant)
      const live = this.messages[this.messages.length - 1]

      const controller = new AbortController()
      this.abort = controller
      this.streaming = true

      try {
        const runner = settings.mockMode ? mock.streamChat : streamChat
        const result = await runner({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
          messages: payload,
          temperature: settings.temperature,
          signal: controller.signal,
          onDelta: (_delta, full) => {
            live.content = full
          },
          onReasoning: (_delta, full) => {
            live.reasoning = full
          },
        })
        live.content = result.content || live.content
        live.reasoning = result.reasoning || live.reasoning
        live.usage = result.usage || null
        live.status = live.content ? 'done' : 'stopped'
        this.lastUsage = result.usage || null
      } catch (error) {
        if (isAbortError(error)) {
          live.status = live.content ? 'done' : 'stopped'
        } else {
          const info = describeError(error)
          live.status = 'error'
          live.error = info
          this.error = info
        }
      } finally {
        this.streaming = false
        this.abort = null
        await db.putMessage(toPlain(live))
        chat.updatedAt = Date.now()
        await db.putChat(toPlain(chat))
      }
    },

    async regenerate() {
      if (this.streaming) return
      const chat = this.currentChat
      if (!chat) return

      let lastUserIndex = -1
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i].role === 'user') {
          lastUserIndex = i
          break
        }
      }
      if (lastUserIndex < 0) return

      const trailing = this.messages.slice(lastUserIndex + 1)
      for (const message of trailing) {
        if (message.id) await db.deleteMessage(message.id)
      }
      this.messages.splice(lastUserIndex + 1)
      this.error = null
      await this._run(chat, this.messages[lastUserIndex].content)
    },

    async clearMessages() {
      const chat = this.currentChat
      if (!chat) return
      for (const message of this.messages) {
        if (message.id) await db.deleteMessage(message.id)
      }
      this.messages = []
      this.error = null
      chat.updatedAt = Date.now()
      await db.putChat(toPlain(chat))
    },
  },
})
