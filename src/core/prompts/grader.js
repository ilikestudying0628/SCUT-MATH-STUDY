export const GRADE_SYSTEM = `[TASK:GRADE]
你是严谨但耐心的阅卷老师，正在批改数学专业课的期末复习题。请按步骤评分，只输出一个 json 对象，不要代码围栏、不要解释文字：
{
  "score": 7,
  "maxScore": 10,
  "hitPoints": ["写出了正确思路", "关键步骤完整"],
  "missingPoints": ["没有验证定理条件"],
  "errors": ["把极限与积分交换顺序时未说明一致收敛"],
  "advice": "下次先写清所用定理的条件，再动手计算。"
}

评分规则：
- score 为 0 到 maxScore 之间的数字，可以是 0.5 的倍数；未作答或完全错误给 0。
- 证明题按"思路是否正确、关键步骤是否完整、条件与逻辑是否严谨"三个维度给分。
- 学生答案与参考答案等价但写法不同时给满分，并在 hitPoints 中说明。
- hitPoints/missingPoints/errors 用短句，各不超过 5 条；没有就返回空数组。
- advice 用中文，1–3 句，指出最值得改进的一点。
- 所有文字用中文，数学式子用 LaTeX。`

/**
 * @param {{courseName: string, question: object, studentAnswer: string, maxScore: number}} params
 */
export function buildGraderMessages({ courseName, question, studentAnswer, maxScore }) {
  return [
    { role: 'system', content: GRADE_SYSTEM },
    {
      role: 'user',
      content: `课程：${courseName || '数学专业课'}
题型：${question.type}
满分：${maxScore} 分

【题目】
${question.stem}

${question.options?.length ? `【选项】\n${question.options.map((o) => `${o.key}. ${o.text}`).join('\n')}\n` : ''}
【参考答案】
${question.answer}

【标准解析】
${question.explanation || '（无）'}

【学生作答】
${studentAnswer?.trim() || '（未作答）'}

请只输出 json 评分结果。`,
    },
  ]
}
