import { defineStore } from 'pinia'
import * as db from '../core/db.js'
import { toPlain } from '../core/text.js'
import { describeError, isAbortError } from '../api/errors.js'
import { chatOnce } from '../api/deepseek.js'
import * as mock from '../api/mock.js'
import { buildQuizRepairMessages, buildQuizSystem, buildQuizUser } from '../core/prompts/quiz.js'
import { buildGraderMessages } from '../core/prompts/grader.js'
import { parseGradePayload, parseQuizPayload } from '../core/quizSchema.js'
import { spreadChunks } from '../core/retrieval.js'
import { isObjectiveType, judgeObjective } from '../core/judge.js'
import { useSettingsStore } from './settings.js'
import { useLibraryStore } from './library.js'
import { useWrongbookStore } from './wrongbook.js'

const MAX_BATCH = 6

function roundScore(value) {
  return Math.round(Number(value || 0) * 2) / 2
}

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    quizzes: [],
    activeId: null,
    loaded: false,
    generating: false,
    progress: { done: 0, total: 0, label: '' },
    error: null,
    grading: false,
    gradingProgress: { done: 0, total: 0 },
    abort: null,
    lastAttemptId: null,
  }),

  getters: {
    activeQuiz: (state) => state.quizzes.find((q) => q.id === state.activeId) || null,
    quizCount: (state) => state.quizzes.length,
    totalQuestions: (state) => state.quizzes.reduce((sum, q) => sum + (q.questions?.length || 0), 0),
  },

  actions: {
    async init(force = false) {
      if (this.loaded && !force) return
      this.quizzes = await db.listQuizzes()
      this.loaded = true
      if (!this.activeId && this.quizzes.length) this.activeId = this.quizzes[0].id
    },

    setActive(id) {
      this.activeId = id
    },

    stop() {
      this.abort?.abort()
    },

    async _requestQuiz(messages, signal) {
      const settings = useSettingsStore()
      const runner = settings.mockMode ? mock.chatOnce : chatOnce
      const response = await runner({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        messages,
        temperature: 0.8,
        maxTokens: 8000,
        jsonMode: true,
        signal,
      })
      return parseQuizPayload(response.text)
    },

    /**
     * @param {{types: string[], count: number, difficulty: string, focus: string, docIds: string[]}} config
     */
    async generate(config) {
      if (this.generating) return null
      const settings = useSettingsStore()
      const library = useLibraryStore()

      if (!settings.canCallApi) {
        this.error = {
          title: '还没有可用的 API Key',
          message: '到「设置」填入 DeepSeek API Key，或打开演示模式。',
          hint: '',
        }
        return null
      }
      if (!library.chunks.length && library.docs.length === 0) {
        this.error = {
          title: '资料库是空的',
          message: '先到「资料库」上传讲义、课件或习题，AI 才能据此出题。',
          hint: '也可以直接粘贴一段文本作为资料。',
        }
        return null
      }

      const types = config.types?.length ? config.types : ['single', 'calculation']
      const total = Math.max(1, Math.min(20, Number(config.count) || 5))
      const docIds = Array.isArray(config.docIds) && config.docIds.length ? config.docIds : null

      const context = spreadChunks({
        chunks: library.chunks,
        docs: library.docs,
        docIds,
        maxChars: Math.max(16000, Number(settings.contextChars) || 12000),
      })

      const batches = []
      let remaining = total
      while (remaining > 0) {
        const take = Math.min(MAX_BATCH, remaining)
        batches.push(take)
        remaining -= take
      }

      const controller = new AbortController()
      this.abort = controller
      this.generating = true
      this.error = null
      this.progress = { done: 0, total: batches.length, label: '准备出题…' }
      const collected = []
      const warnings = []
      let quizTitle = ''

      try {
        for (let index = 0; index < batches.length; index++) {
          if (controller.signal.aborted) break
          const count = batches[index]
          this.progress = {
            done: index,
            total: batches.length,
            label: `正在出第 ${index + 1}/${batches.length} 批（${count} 题）`,
          }

          const messages = [
            {
              role: 'system',
              content: buildQuizSystem({
                courseName: settings.courseLabel,
                difficulty: config.difficulty,
                pointTotal: Math.round((100 / batches.length) * 10) / 10,
              }),
            },
            {
              role: 'user',
              content: buildQuizUser({
                contextText: context.contextText,
                count,
                types,
                focus: config.focus || '',
                withAnswers: config.withAnswers !== false,
              }),
            },
          ]

          let parsed
          try {
            parsed = await this._requestQuiz(messages, controller.signal)
          } catch (error) {
            if (isAbortError(error)) throw error
            parsed = { ok: false, error: describeError(error).message }
          }

          if (!parsed.ok) {
            // 修复重试一次：把坏输出一起丢回去，要求只出 JSON
            const repairMessages = [
              ...messages,
              { role: 'assistant', content: String(parsed.raw || '').slice(0, 2000) },
              ...buildQuizRepairMessages({ badText: parsed.raw, error: parsed.error }),
            ]
            try {
              parsed = await this._requestQuiz(repairMessages, controller.signal)
            } catch (error) {
              if (isAbortError(error)) throw error
              parsed = { ok: false, error: describeError(error).message }
            }
          }

          if (parsed.ok) {
            collected.push(...parsed.quiz.questions)
            if (!quizTitle && parsed.quiz.title) quizTitle = parsed.quiz.title
            if (parsed.dropped) warnings.push(`有 ${parsed.dropped} 道题字段不完整，已跳过。`)
          } else {
            warnings.push(`第 ${index + 1} 批出题失败：${parsed.error}`)
          }
        }

        if (!collected.length) {
          throw new Error(warnings[0] || '出题失败，请稍后重试。')
        }

        const questions = collected.slice(0, total).map((question, index) => ({
          ...question,
          id: `q${index + 1}`,
        }))

        const quiz = {
          id: db.newId('quiz'),
          title:
            quizTitle ||
            `${settings.courseLabel} · ${new Date().toLocaleDateString('zh-CN')} 练习卷`,
          course: settings.course,
          courseName: settings.courseLabel,
          createdAt: Date.now(),
          config: { ...config, docIds: docIds || [] },
          questions,
          attempts: [],
          warnings,
          citations: context.citations,
        }

        await db.putQuiz(toPlain(quiz))
        this.quizzes.unshift(quiz)
        this.activeId = quiz.id
        this.progress = { done: batches.length, total: batches.length, label: '完成' }
        return quiz
      } catch (error) {
        if (isAbortError(error)) {
          this.error = { title: '已停止', message: '已取消本次出题。', hint: '' }
        } else {
          this.error = describeError(error)
        }
        return null
      } finally {
        this.generating = false
        this.abort = null
      }
    },

    /**
     * 作答并批改。客观题本地判分，主观题调用 AI 评分。
     * @param {string} quizId
     * @param {Record<string, string>} answers
     */
    async grade(quizId, answers) {
      const quiz = this.quizzes.find((q) => q.id === quizId)
      if (!quiz) return null
      const settings = useSettingsStore()
      const wrongbook = useWrongbookStore()
      const objective = quiz.questions.filter((q) => isObjectiveType(q.type))
      const subjective = quiz.questions.filter((q) => !isObjectiveType(q.type))

      const controller = new AbortController()
      this.abort = controller
      this.grading = true
      this.gradingProgress = { done: objective.length, total: quiz.questions.length }
      const results = {}
      const runner = settings.mockMode ? mock.chatOnce : chatOnce

      try {
        for (const question of quiz.questions) {
          const raw = String(answers?.[question.id] ?? '')
          if (isObjectiveType(question.type)) {
            const judged = judgeObjective(question, raw)
            results[question.id] = {
              score: judged.score,
              max: question.points,
              note: judged.note,
              source: 'local',
            }
            continue
          }

          if (!raw.trim()) {
            results[question.id] = {
              score: 0,
              max: question.points,
              note: '未作答',
              source: 'local',
              advice: '先写出你想到的第一步，也能拿到步骤分。',
            }
            continue
          }

          try {
            const response = await runner({
              apiKey: settings.apiKey,
              baseUrl: settings.baseUrl,
              model: settings.model,
              messages: buildGraderMessages({
                courseName: quiz.courseName,
                question,
                studentAnswer: raw,
                maxScore: question.points,
              }),
              temperature: 0.2,
              maxTokens: 2000,
              jsonMode: true,
              signal: controller.signal,
            })
            const parsed = parseGradePayload(response.text, question.points)
            if (!parsed.ok) throw new Error(parsed.error)
            results[question.id] = {
              score: parsed.grade.score,
              max: question.points,
              note: '',
              source: 'ai',
              grade: parsed.grade,
            }
          } catch (error) {
            if (isAbortError(error)) throw error
            results[question.id] = {
              score: 0,
              max: question.points,
              note: `AI 批改失败：${describeError(error).message}`,
              source: 'error',
            }
          }
        }

        let totalScore = 0
        let maxTotal = 0
        for (const question of quiz.questions) {
          const result = results[question.id]
          totalScore += Number(result?.score) || 0
          maxTotal += Number(question.points) || 0
        }

        const attempt = {
          id: db.newId('attempt'),
          createdAt: Date.now(),
          answers: { ...answers },
          results,
          totalScore: roundScore(totalScore),
          maxTotal: roundScore(maxTotal),
        }

        quiz.attempts = [attempt, ...(quiz.attempts || [])].slice(0, 20)
        await db.putQuiz(toPlain(quiz))
        this.lastAttemptId = attempt.id

        // 做错的题（低于 60% 得分）进错题本
        for (const question of quiz.questions) {
          const result = results[question.id]
          if (!result) continue
          const ratio = result.max ? result.score / result.max : 1
          if (ratio < 0.6) {
            await wrongbook.add({
              question,
              quizId: quiz.id,
              courseName: quiz.courseName,
              answer: answers?.[question.id] || '',
              score: result.score,
              max: result.max,
              grade: result.grade || null,
            })
          }
        }

        this.gradingProgress = { done: quiz.questions.length, total: quiz.questions.length }
        return attempt
      } catch (error) {
        if (isAbortError(error)) {
          this.error = { title: '已停止', message: '已取消批改。', hint: '' }
        } else {
          this.error = describeError(error)
        }
        return null
      } finally {
        this.grading = false
        this.abort = null
      }
    },

    async remove(quizId) {
      await db.deleteQuiz(quizId)
      this.quizzes = this.quizzes.filter((q) => q.id !== quizId)
      if (this.activeId === quizId) this.activeId = this.quizzes[0]?.id || null
    },

    async reload() {
      await this.init(true)
    },
  },
})
