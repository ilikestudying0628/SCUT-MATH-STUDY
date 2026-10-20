import { defineStore } from 'pinia'
import * as db from '../core/db.js'
import { hashString, toPlain } from '../core/text.js'
import { describeError } from '../api/errors.js'
import { useSettingsStore } from './settings.js'

export const useWrongbookStore = defineStore('wrongbook', {
  state: () => ({
    items: [],
    loaded: false,
    error: '',
  }),

  getters: {
    activeItems: (state) => state.items.filter((item) => !item.mastered),
    masteredItems: (state) => state.items.filter((item) => item.mastered),
    total: (state) => state.items.length,
    byCourse: (state) => {
      const map = new Map()
      for (const item of state.activeItems) {
        const key = item.courseName || '未分课程'
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(item)
      }
      return [...map.entries()]
    },
  },

  actions: {
    async init(force = false) {
      if (this.loaded && !force) return
      try {
        this.items = await db.listWrongbook()
        this.loaded = true
      } catch (error) {
        this.error = error?.message || '读取错题本失败'
      }
    },

    /** 同题干去重，重复做错只累加次数与最近得分 */
    async add({ question, quizId, courseName, answer, score, max, grade }) {
      const key = `${question.type}|${hashString(question.stem)}`
      const existing = this.items.find((item) => item.key === key)
      const now = Date.now()

      if (existing) {
        existing.attempts = (existing.attempts || 1) + 1
        existing.lastScore = score
        existing.maxScore = max
        existing.lastAnswer = answer
        existing.lastWrongAt = now
        existing.mastered = false
        existing.grade = grade || existing.grade
        existing.history = [...(existing.history || []), { at: now, score, max }].slice(-20)
        await db.putWrongItem(toPlain(existing))
        return existing
      }

      const item = {
        id: db.newId('wrong'),
        key,
        question: toPlain(question),
        quizId: quizId || '',
        courseName: courseName || '',
        lastAnswer: answer || '',
        lastScore: score,
        maxScore: max,
        grade: grade || null,
        attempts: 1,
        mastered: false,
        createdAt: now,
        lastWrongAt: now,
        history: [{ at: now, score, max }],
      }
      await db.putWrongItem(toPlain(item))
      this.items.unshift(item)
      return item
    },

    async remove(id) {
      await db.deleteWrongItem(id)
      this.items = this.items.filter((item) => item.id !== id)
    },

    async toggleMastered(id) {
      const item = this.items.find((row) => row.id === id)
      if (!item) return
      item.mastered = !item.mastered
      await db.putWrongItem(toPlain(item))
    },

    async clear() {
      for (const item of [...this.items]) {
        await db.deleteWrongItem(item.id)
      }
      this.items = []
    },
  },
})
