import { defineStore } from 'pinia'
import * as db from '../core/db.js'
import { parseFile, parsePastedText } from '../core/parsers/index.js'
import { chunkSections } from '../core/chunker.js'
import { buildIndex } from '../core/bm25.js'
import { stripExtension } from '../core/parsers/common.js'
import { detectFormulaGaps } from '../core/parsers/quality.js'
import { readImageAsDataUrl, renderPdfPageImages } from '../core/parsers/pdfRender.js'
import { transcribeImages } from '../api/vision.js'
import * as mock from '../api/mock.js'
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
    abort: null,
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
        // 旧数据没有 quality 字段：按「每页字数」补一个弱信号，提醒可以 AI 识别
        let changed = false
        for (const doc of this.docs) {
          if (doc.quality || !/pdf/i.test(doc.fileName || '') || !doc.meta?.pages) continue
          const charsPerPage = Math.round((doc.charCount || 0) / Math.max(1, doc.meta.pages))
          if (charsPerPage < 260) {
            doc.quality = { needsRecognition: true, charsPerPage, reason: 'low-density' }
            changed = true
          }
        }
        if (changed) {
          await Promise.all(
            this.docs
              .filter((doc) => doc.quality?.reason === 'low-density')
              .map((doc) => db.putDoc(toPlain(doc))),
          )
        }
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
      const quality = detectFormulaGaps(parsed.text, parsed.meta || {})
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

      // 图片资料没有文本层：先入库，等用户点「AI 识别」
      if (!chunkList.length && parsed.meta?.needsRecognition) {
        Object.assign(doc, {
          status: 'ready',
          charCount: 0,
          chunkCount: 0,
          warnings: parsed.warnings || [],
          quality: { ...quality, needsRecognition: true },
          meta: parsed.meta || {},
          error: '',
          updatedAt: Date.now(),
        })
        await db.putDoc(toPlain(doc))
        await this.refreshChunks()
        return doc
      }

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
        warnings: [
          ...(parsed.warnings || []),
          ...(quality.needsRecognition
            ? ['文字层里缺少公式（数学字体没有 Unicode 映射），建议点「AI 识别」重新转录。']
            : []),
        ],
        quality,
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

    /**
     * 用视觉模型把 PDF 页面（或图片）转录成带 LaTeX 的 Markdown。
     * 用于文字层缺公式的 PDF 与拍照/截图资料。
     */
    async recognizeDoc(docId) {
      const settings = useSettingsStore()
      const doc = this.docs.find((d) => d.id === docId)
      if (!doc) throw new Error('资料不存在')
      if (!settings.canCallApi) {
        throw new Error('AI 识别需要 DeepSeek API Key（也可以先打开演示模式体验流程）。')
      }
      const stored = await db.getFileBlob(docId)
      if (!stored?.blob) throw new Error('找不到原始文件，无法渲染页面；可以改用「粘贴文本」。')

      const controller = new AbortController()
      this.abort = controller
      try {
        let images = []
        const isPdf = /pdf/i.test(doc.mime || '') || /\.pdf$/i.test(doc.fileName || '')
        if (isPdf) {
          images = await renderPdfPageImages(stored.blob, {
            maxPages: 20,
            onProgress: (done, total) => {
              this.jobs[docId] = { stage: 'render', done, total, label: '渲染页面' }
            },
          })
        } else if (
          /^image\//.test(doc.mime || '') ||
          /\.(png|jpe?g|webp|bmp)$/i.test(doc.fileName || '')
        ) {
          const image = await readImageAsDataUrl(stored.blob)
          images = [{ page: 1, ...image }]
        } else {
          throw new Error('只有 PDF 和图片支持 AI 识别，其他格式可以直接编辑文本。')
        }

        this.jobs[docId] = {
          stage: 'ocr',
          done: 0,
          total: images.length,
          label: '识别公式',
        }
        const runner = settings.mockMode ? mock.transcribeImages : transcribeImages
        const pages = await runner({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
          images,
          signal: controller.signal,
          hint: doc.fileName || '',
          onProgress: (done, total) => {
            this.jobs[docId] = { stage: 'ocr', done, total, label: '识别公式' }
          },
        })

        if (!pages.length) {
          throw new Error('没有识别出文字，可能是空白页或图片过于模糊。')
        }

        // 模型有时会自带「## 第 n 页」标题，去掉避免和我们的分页标题重复
        const cleanedPages = pages.map((p) => ({
          page: p.page,
          text: String(p.text || '')
            .replace(/^\s*#{1,4}\s*(?:第\s*)?\d+\s*页[^\n]*\n+/, '')
            .trim(),
        }))

        const text = cleanedPages.map((p) => `## 第 ${p.page} 页\n\n${p.text}`).join('\n\n')
        const chunkList = chunkSections(
          cleanedPages.map((p) => ({ page: p.page, heading: `第 ${p.page} 页`, text: p.text })),
          { maxChars: 800, overlap: 100 },
        )
        await db.putDocText(docId, text)
        await db.putChunks(docId, chunkList)

        Object.assign(doc, {
          status: 'ready',
          charCount: text.length,
          chunkCount: chunkList.length,
          warnings: [],
          quality: { needsRecognition: false, recognized: true },
          meta: { ...(doc.meta || {}), recognizedAt: Date.now(), recognizedPages: pages.length },
          error: '',
          updatedAt: Date.now(),
        })
        await db.putDoc(toPlain(doc))
        await this.refreshChunks()
        return doc
      } finally {
        this.abort = null
        delete this.jobs[docId]
      }
    },

    stopRecognize() {
      this.abort?.abort()
    },

    async reload() {
      await this.init(true)
    },
  },
})
