export const SUMMARY_KINDS = {
  outline: {
    label: '知识框架',
    task: `把资料整理成「知识框架」：按章节/主题分层，每层用一句话概括核心内容，标出各知识点之间的依赖关系（例如"要先掌握 X 才能理解 Y"）。`,
  },
  formulas: {
    label: '公式速查',
    task: `整理「公式速查表」：用 Markdown 表格列出资料中的关键公式与适用条件，列名为：公式 | 名称 | 适用条件 | 易错点。公式用 LaTeX。`,
  },
  pitfalls: {
    label: '易错点清单',
    task: `整理「易错点清单」：结合资料内容列出期末最容易丢分的地方，每条写清错误表现、正确做法、对应资料编号。`,
  },
  sprint: {
    label: '考前冲刺 30 条',
    task: `整理「考前冲刺清单」：给出 30 条可以在一周内逐条打勾的复习要点，每条一句话，按重要程度排序，尽量覆盖资料中的定义、定理条件与典型题型。`,
  },
}

/**
 * @param {{kind: string, courseName: string, contextText: string}} params
 */
export function buildSummaryMessages({ kind, courseName, contextText }) {
  const meta = SUMMARY_KINDS[kind] || SUMMARY_KINDS.outline
  const system = `[TASK:SUMMARY]
你是数学专业的期末复习教练，学生是华南理工大学数学类本科生，课程是「${courseName || '数学专业课'}」。

任务：${meta.task}

要求：
1. 只依据给出的课程资料整理，标注来源【资料n】；资料没覆盖的重要考点可以补充，但标 [通用知识]。
2. 输出 Markdown：用标题分层、必要时用表格与列表；数学式子用 LaTeX（行内 $...$，独立 $$...$$）。
3. 语言精炼，不写"本资料主要讲了"这类空话；直接给出可复习的内容。
4. 不要编造教材页码或定理编号。`

  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `===== 课程资料开始 =====\n${contextText || '（没有资料，请基于该课程通用核心内容整理，并提示我上传资料）'}\n===== 课程资料结束 =====\n\n请输出 Markdown 正文。`,
    },
  ]
}
