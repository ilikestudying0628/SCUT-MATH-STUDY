import { TYPE_LABELS } from '../quizSchema.js'

const DIFFICULTY_TEXT = {
  easy: '基础（概念辨析、直接套用定义与基本定理）',
  medium: '中等（需要两三步推理，或综合两个知识点）',
  hard: '拔高（多步推导、构造反例、或接近期末压轴题）',
}

/**
 * 出题系统提示词。使用 JSON 模式，因此提示里必须出现 "json" 字样。
 * @param {{courseName: string, difficulty: string, pointTotal: number}} params
 */
export function buildQuizSystem({ courseName, difficulty = 'medium', pointTotal = 100 }) {
  return `[TASK:QUIZ]
你是华南理工大学数学学院的期末命题老师，为本科生出一套期末复习练习卷。
课程：${courseName}。难度定位：${DIFFICULTY_TEXT[difficulty] || DIFFICULTY_TEXT.medium}。

只输出一个 json 对象，不要 Markdown 代码围栏，不要任何解释文字，结构必须是：
{
  "title": "练习卷标题",
  "questions": [
    {
      "type": "single | multiple | judge | fill | calculation | proof",
      "stem": "题干（可含 LaTeX）",
      "options": [{"key": "A", "text": "选项内容"}],
      "answer": "标准答案",
      "explanation": "解析：思路、关键步骤、易错点",
      "points": 10,
      "difficulty": "easy | medium | hard",
      "knowledge": ["知识点1", "知识点2"],
      "source": "【资料2】 或 通用知识"
    }
  ]
}

出题要求：
1. 题目必须有依据：优先使用给定资料里的定义、定理、例题、习题的同类变形；每题的 source 写出对应资料编号，资料未覆盖时写"通用知识"。
2. type 与题目形式严格对应：single/multiple 必须有 options（single 恰好 4 个选项、只有 1 个正确；multiple 4 个选项、可多个正确，并在题干注明"多选"）；judge 的 answer 写"正确"或"错误"；fill 的 answer 写填空内容；calculation 的 answer 写完整计算过程与最终结果；proof 的 answer 写完整严谨证明。
3. 计算题要能算出具体结果；证明题的条件与结论必须自洽；不要出无解或条件缺失的题。
4. 各题 points 之和约为 ${pointTotal}；每题 5–20 分。
5. 不重复同一考法，由易到难排列；题干不要泄露答案。
6. 数学式子用 LaTeX（行内 $...$，独立 $$...$$）。`
}

/**
 * @param {{contextText: string, count: number, types: string[], focus: string, withAnswers: boolean}} params
 */
export function buildQuizUser({ contextText, count, types, focus = '', withAnswers = true }) {
  const typeText = types.map((t) => TYPE_LABELS[t] || t).join('、')
  return `请根据下面的课程资料，出 ${count} 道题，题型：${typeText}。${
    focus ? `\n侧重点：${focus}。` : ''
  }\n${
    withAnswers ? '每道题都要给出标准答案与解析。' : '答案字段仍需填写（用于批改），但卷面不要额外说明。'
  }\n\n===== 课程资料开始 =====\n${contextText || '（本次没有上传资料，请基于该课程的通用核心内容出题）'}\n===== 课程资料结束 =====

再次强调：只输出 json。`
}

export function buildQuizRepairMessages({ badText, error }) {
  return [
    {
      role: 'user',
      content: `上一次的输出不是合法 json，错误：${error}。请重新输出，只输出 json 对象，结构不变，不要代码围栏、不要解释。\n上一次输出片段：\n${String(badText).slice(0, 1200)}`,
    },
  ]
}
