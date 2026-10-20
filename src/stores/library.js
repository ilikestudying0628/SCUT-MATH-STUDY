import { defineStore } from 'pinia'
import * as db from '../core/db.js'
import { parseFile, parsePastedText } from '../core/parsers/index.js'
import { chunkSections } from '../core/chunker.js'
import { buildIndex } from '../core/bm25.js'
import { stripExtension } from '../core/parsers/common.js'
import { toPlain } from '../core/text.js'
import { useSettingsStore } from './settings.js'

let indexCache = { revision: -1, index: null }

const DEFAULT_CHUNK = { maxChars: 800, overlap: 100 }

export const useLibraryStore = defineStore('library', {
  state: () => ({
    docs: [],
    chunks: [],
    loaded: false,
    loading: false,
    jobs: {},
    error: '',
    filterCourse: 'all',
    search: '',
    revision: 0,
  }),

  getters: {
    readyDocs: (state) => state.docs.filter((d) => d.status === 'ready'),
    docById: (state) => new Map(state.docs.map((d) => [d.id, d])),
    totalChars: (state) => state.docs.reduce((sum, d) => sum + (d.charCount || 0), 0),
    chunkCount: (state) => state.chunks.length,
    busyCount: (state) => Object.keys(state.jobs || {}).length,
    coursesInUse: (state) => {
      const set = new Set(state.docs.map((d) => d.course).filter(Boolean))
      return [...set]
    },
    filteredDocs: (state) => {
      const keyword = state.search.trim().toLowerCase()
      return state.docs.filter((doc) => {
        if (state.filterCourse !== 'all' && doc.course !== state.filterCourse) return false
        if (!keyword) return true
        return (
          String(doc.title || '').toLowerCase().includes(keyword) ||
          String(doc.fileName || '').toLowerCase().includes(keyword)
        )
      })
    },
  },

  actions: {
    async init(force = false) {
      if (this.loaded && !force) return
      this.loading = true
      try {
        this.docs = await db.listDocs()
        this.chunks = await db.getAllChunks()
        this.revision += 1
        this.loaded = true
        this.error = ''
      } catch (error) {
        this.error = error?.message || '读取本地资料库失败'
      } finally {
        this.loading = false
      }
    },

    async refreshChunks() {
      this.chunks = await db.getAllChunks()
      this.revision += 1
    },

    /** 检索索引按 revision 缓存，资料没变就不重建 */
    getIndex() {
      if (!indexCache.index || indexCache.revision !== this.revision) {
        indexCache = {
          revision: this.revision,
          index: buildIndex(this.chunks.map((c) => ({ id: c.id, text: c.text, title: c.heading }))),
        }
      }
      return indexCache.index
    },

    _makeDoc(overrides = {}) {
      const now = Date.now()
      return {
        id: overrides.id,
        title: '未命名资料',
        fileName: '',
        mime: '',
        size: 0,
        course: 'math-analysis',
        status: 'parsing',
        charCount: 0,
        chunkCount: 0,
        warnings: [],
        error: '',
        meta: {},
        createdAt: now,
        updatedAt: now,
        ...overrides,
      }
    },

    async _applyParsed(doc, parsed) {
      const settings = useSettingsStore()
      const chunkList = chunkSections(
        (parsed.sections || []).map((section) => ({
          text: section.text,
          page: section.page ?? null,
          heading: section.heading || '',
        })),
        {
          maxChars: Number(settings.chunkSize) || DEFAULT_CHUNK.maxChars,
          overlap: Math.round((Number(settings.chunkSize) || DEFAULT_CHUNK.maxChars) / 8),
        },
      )

      if (!chunkList.length) {
        throw new Error('没有切出可用的文本块，可能内容为空。')
      }

      this.jobs[doc.id] = { stage: 'indexing', done: 0, total: chunkList.length }
      await db.putDocText(doc.id, parsed.text)
      await db.putChunks(doc.id, chunkList)

      Object.assign(doc, {
        status: 'ready',
        charCount: parsed.text.length,
        chunkCount: chunkList.length,
        warnings: parsed.warnings || [],
        meta: parsed.meta || {},
        error: '',
        updatedAt: Date.now(),
      })
      await db.putDoc(toPlain(doc))
      await this.refreshChunks()
      return doc
    },

    async addFile(file, options = {}) {
      const settings = useSettingsStore()
      const id = db.newId('doc')
      this.docs.unshift(
        this._makeDoc({
          id,
          title: stripExtension(file.name) || file.name || '未命名资料',
          fileName: file.name || '',
          mime: file.type || '',
          size: file.size || 0,
          course: options.course || settings.course,
        }),
      )
      // 取回响应式代理，后续对它的修改才会更新界面
      const doc = this.docs[0]
      await db.putDoc(toPlain(doc))
      this.jobs[id] = { stage: 'parsing', done: 0, total: 0 }

      try {
        const parsed = await parseFile(file, {
          onProgress: (done, total) => {
            this.jobs[id] = { stage: 'parsing', done, total }
          },
        })
        await db.putFileBlob(id, file, { name: file.name, type: file.type })
        await this._applyParsed(doc, parsed)
        return doc
      } catch (error) {
        doc.status = 'error'
        doc.error = error?.message || '解析失败'
        doc.updatedAt = Date.now()
        await db.putDoc(toPlain(doc))
        throw error
      } finally {
        delete this.jobs[id]
      }
    },

    async addText({ title, text, course }) {
      const settings = useSettingsStore()
      const id = db.newId('doc')
      const parsed = parsePastedText(text, title)
      this.docs.unshift(
        this._makeDoc({
          id,
          title: title?.trim() || `粘贴文本 ${new Date().toLocaleString('zh-CN')}`,
          fileName: '',
          mime: 'text/plain',
          size: parsed.text.length,
          course: course || settings.course,
          meta: { kind: 'pasted' },
        }),
      )
      const doc = this.docs[0]
      await db.putDoc(toPlain(doc))
      try {
        await this._applyParsed(doc, parsed)
        return doc
      } catch (error) {
        doc.status = 'error'
        doc.error = error?.message || '解析失败'
        doc.updatedAt = Date.now()
        await db.putDoc(toPlain(doc))
        throw error
      }
    },

    async updateText(docId, text) {
      const doc = this.docs.find((d) => d.id === docId)
      if (!doc) throw new Error('资料不存在')
      const cleaned = String(text ?? '')
      if (!cleaned.trim()) throw new Error('内容不能为空')

      const chunkList = chunkSections([{ text: cleaned, heading: doc.title }], {
        maxChars: 800,
        overlap: 100,
      })
      await db.putDocText(docId, cleaned)
      await db.putChunks(docId, chunkList)
      Object.assign(doc, {
        charCount: cleaned.length,
        chunkCount: chunkList.length,
        status: 'ready',
        error: '',
        updatedAt: Date.now(),
      })
      await db.putDoc(toPlain(doc))
      await this.refreshChunks()
      return doc
    },

    async readDocText(docId) {
      return db.getDocText(docId)
    },

    async getChunksOf(docId) {
      return db.getChunksByDoc(docId)
    },

    async getFile(docId) {
      return db.getFileBlob(docId)
    },

    async setCourse(docId, course) {
      const doc = this.docs.find((d) => d.id === docId)
      if (!doc) return
      doc.course = course
      doc.updatedAt = Date.now()
      await db.putDoc(toPlain(doc))
    },

    async remove(docId) {
      await db.deleteDocCascade(docId)
      this.docs = this.docs.filter((d) => d.id !== docId)
      await this.refreshChunks()
    },

    async reload() {
      await this.init(true)
    },
  },
})
