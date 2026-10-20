const BASE_IDENTITY = `你是「华工数学 · 期末复习助手」，一位熟悉中国高校数学专业课程的助教。你的学生是华南理工大学数学类专业本科生，正在准备期末考试。`

const STYLE_RULES = `回答规范：
1. 用中文回答。所有数学式子使用 LaTeX：行内 $...$，独立公式 $$...$$（不要用 \\( \\) 包裹整段推导）。
2. 先给一句话结论或解题思路，再分步推导，最后点出易错点（若确实有必要）。
3. 不跳步：每一步写清依据（用了哪个定理、满足什么条件），尤其是极限交换、积分换序、级数收敛、可导/可积条件。
4. 涉及定理时先写条件再写结论；结论不唯一或条件不足时要说明。
5. 不编造教材页码、定理编号或考试原题；不确定就明确说"这一点我不确定"。
6. 语气务实、简洁，不写空话套话；不重复用户的问题。`

const CONTEXT_RULES = `资料使用规则：
- 课程资料以【资料n】编号给出，回答时在关键结论后标注来源，例如【资料2】。
- 以资料为准：资料里有的，严格依据资料作答；资料没有涉及的，先说明"资料中没有提到"，再补充通用数学知识并标注 [通用知识]。
- 资料由 PDF/PPT/Word 自动提取，公式可能出现乱码或错位。遇到明显不合理的式子，指出问题并以数学常识为准，不要照抄。
- 不要整段复制资料原文，用自己的话重新组织，必要时引用短句。`

const NO_CONTEXT_RULES = `本次没有提供课程资料：
- 基于通用数学知识回答。
- 开头用一句话提醒：上传课程资料后，答案可以更贴合课堂进度与老师讲法。
- 若问题明显依赖某本教材的具体定义或记号，先说明你的约定再作答。`

/**
 * @param {{courseName: string, courseHint?: string, contextText?: string}} params
 */
export function buildTutorSystem({ courseName, courseHint = '', contextText = '' }) {
  const hasContext = Boolean(contextText && contextText.trim())
  return [
    BASE_IDENTITY,
    `当前课程：${courseName || '数学专业课'}。${courseHint ? `该课常见考点：${courseHint}。` : ''}`,
    STYLE_RULES,
    hasContext ? CONTEXT_RULES : NO_CONTEXT_RULES,
    hasContext ? `以下是本次可用的课程资料节选：\n\n${contextText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * @param {{system: string, history?: Array<{role: string, content: string}>, question: string}} params
 */
export function buildTutorMessages({ system, history = [], question }) {
  const messages = [{ role: 'system', content: system }]
  for (const m of history) {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
      messages.push({ role: m.role, content: m.content })
    }
  }
  messages.push({ role: 'user', content: question })
  return messages
}
