import { truncate } from '../core/text.js'

function abortError() {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

function lastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i].content || ''
  }
  return ''
}

function systemText(messages) {
  return messages.find((m) => m.role === 'system')?.content || ''
}

function chatAnswer(messages) {
  const question = lastUserMessage(messages)
  const system = systemText(messages)
  const hasContext = /【资料1】/.test(system)
  const short = truncate(question.replace(/\s+/g, ' '), 36)

  return String.raw`> 演示模式：以下内容由本地脚本生成，用于在没有 API Key 时体验完整流程。

**思路**：针对「${short}」，先确认所涉概念的定义与前提条件，再按定理链条推下去。

1. 若题目问的是极限/连续性，先写清 $\lim_{x \to x_0} f(x)$ 的存在性，再用 $\varepsilon$-$\delta$ 语言或等价无穷小处理。
2. 关键一步：
$$ \lim_{x \to 0} \frac{\sin x}{x} = 1, \qquad \int_0^1 x^n\,\mathrm{d}x = \frac{1}{n+1} \ (n > -1). $$
3. 最后检查条件：函数在去心邻域有定义、分母不为零、级数收敛半径是否覆盖展开点。

${
  hasContext
    ? '资料中的定义与这条思路一致【资料1】；如果资料里的记号是 $\\varepsilon$-$N$ 写法，请以资料为准【资料2】。'
    : '本次没有使用课程资料：[通用知识] 以上结论来自标准教材。上传讲义后，答案会按你老师的记号与进度来写。'
}

**易错点**
- 忘记验证定理条件（如一致收敛、可导性）就直接交换极限与积分。
- 把充分条件当成必要条件。

> 这是演示内容。填入自己的 DeepSeek API Key 后即可获得真实回答。`
}

function demoQuiz(messages) {
  const system = systemText(messages)
  const difficulty = /hard|拔高/.test(system) ? 'hard' : /easy|基础/.test(system) ? 'easy' : 'medium'
  const payload = {
    title: '演示练习卷 · 数学分析（示例）',
    questions: [
      {
        type: 'single',
        stem: '设 $f(x)=\\dfrac{\\sin x}{x}\\ (x\\neq 0)$，则 $x\\to 0$ 时 $f(x)$ 的极限是：',
        options: [
          { key: 'A', text: '$0$' },
          { key: 'B', text: '$1$' },
          { key: 'C', text: '$+\\infty$' },
          { key: 'D', text: '不存在' },
        ],
        answer: 'B',
        explanation: '利用重要极限 $\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$，注意 $x=0$ 处的洞不影响极限。',
        points: 5,
        difficulty: 'easy',
        knowledge: ['重要极限', '极限定义'],
        source: '通用知识',
      },
      {
        type: 'calculation',
        stem: '计算 $\\displaystyle\\int_0^1 x\\ln(1+x)\\,\\mathrm{d}x$。',
        answer: '$\\displaystyle\\frac{1}{4}$。分部积分：$\\int x\\ln(1+x)dx=\\frac{x^2}{2}\\ln(1+x)-\\int\\frac{x^2}{2(1+x)}dx$，整理后代入上下限可得 $\\frac14$。',
        explanation: '先分部积分，再把 $\\frac{x^2}{1+x}=x-1+\\frac{1}{1+x}$ 拆开。',
        points: 15,
        difficulty,
        knowledge: ['分部积分', '定积分计算'],
        source: '通用知识',
      },
      {
        type: 'proof',
        stem: '设 $\\{a_n\\}$ 单调递增且有上界，证明 $\\{a_n\\}$ 收敛。',
        answer: '由确界原理，$A=\\sup\\{a_n\\}$ 存在。对任意 $\\varepsilon>0$，存在 $N$ 使 $a_N>A-\\varepsilon$；由单调递增，$n>N$ 时 $A-\\varepsilon<a_N\\le a_n\\le A$，故 $|a_n-A|<\\varepsilon$，即 $a_n\\to A$。',
        explanation: '关键是先用确界原理取出上确界，再用单调性夹住尾项。',
        points: 15,
        difficulty,
        knowledge: ['单调有界定理', '确界原理'],
        source: '通用知识',
      },
    ],
  }
  return JSON.stringify(payload)
}

function demoGrade(messages) {
  const user = lastUserMessage(messages)
  const empty = /（未作答）/.test(user)
  const score = empty ? 0 : 8
  return JSON.stringify({
    score,
    maxScore: 10,
    hitPoints: empty ? [] : ['思路方向正确', '写出了主要计算步骤'],
    missingPoints: empty ? ['没有作答'] : ['没有说明所用定理的条件'],
    errors: empty ? [] : ['中间一步符号写反了'],
    advice: empty
      ? '先写出你想到的第一步，哪怕是尝试性的，也能拿到步骤分。'
      : '把「为什么可以用这个定理」写在推导前面，期末按步骤给分更稳。',
  })
}

function demoSummary(messages) {
  const system = systemText(messages)
  const title = system.includes('公式速查')
    ? '公式速查（示例）'
    : system.includes('易错点')
      ? '易错点清单（示例）'
      : system.includes('30 条')
        ? '考前冲刺 30 条（示例）'
        : '知识框架（示例）'

  return String.raw`> 演示模式：以下为本地示例，未调用真实 API。

# ${title}

## 一、极限与连续

- 极限的 $\varepsilon$-$\delta$ 定义，以及 $\varepsilon$-$N$ 写法的区别【资料1】
- 夹逼定理：$g(x)\le f(x)\le h(x)$ 且两端极限相同【资料1】
- 两个重要极限：$\lim_{x\to 0}\frac{\sin x}{x}=1$，$\lim_{x\to 0}(1+x)^{1/x}=e$

## 二、微分中值定理

- Rolle → Lagrange → Cauchy 的条件是层层加强的，考试常考"缺哪个条件会怎样"
- 证明存在性时先想辅助函数：见到 $f'(\xi)+g'(\xi)f(\xi)=0$ 试 $F=f e^{g}$【资料2】

## 三、级数

| 方法 | 适用 | 注意 |
| --- | --- | --- |
| 比较判别法 | 正项级数 | 需要找合适的参照级数 |
| 比值判别法 | 含阶乘、幂次 | $L=1$ 时失效 |
| 根值判别法 | 含 $n$ 次方 | 与比值法结论一致 |

- $p$-级数 $\sum 1/n^p$ 当且仅当 $p>1$ 收敛

## 复习建议

1. 先把上面每个定理的**条件**默写一遍，再做题。
2. 错题本里同一考法的题放在一起重做。

> 填入 API Key 后会按你上传的资料生成完整提纲，并标注资料出处。`
}

function demoOcr(messages) {
  const pageMatch = String(messages?.[1]?.content?.[0]?.text || '').match(/第\s*(\d+)\s*页/)
  const page = pageMatch ? pageMatch[1] : '1'
  return String.raw`## 第 ${page} 页（演示识别）

> 演示模式：下面是模拟的视觉转录结果，用来验证「PDF 页面 → 图片 → LaTeX」的流程。

一、叙述题（每题 3 分）

1. 数列的 Cauchy 收敛原理：$\{a_n\}$ 收敛当且仅当对任意 $\varepsilon>0$，存在 $N$，当 $m,n>N$ 时 $|a_m-a_n|<\varepsilon$。

2. 写出 $\lim_{x\to x_0}f(x)=+\infty$ 与 $\lim_{x\to+\infty}f(x)=A$ 的 $\varepsilon$-$\delta$ 定义。

3. $\lim_{x\to x_0}f(x)$ 存在的 Heine 定理：对任意趋于 $x_0$ 的数列 $\{x_n\}$，$\lim_{n\to\infty}f(x_n)$ 都存在且相等。

二、计算题（每题 5 分）

1. 设 $x=t-\sin t,\ y=1-\cos t$ 确定隐函数 $y(x)$，求二阶微分 $\mathrm{d}^2y$。

2. 求极限 $\lim_{x\to 0}\left(\frac{1}{x}-\frac{1}{\tan x}\right)$。

3. 求极限 $\lim_{n\to\infty}\left(1+\frac{1}{n}-\frac{1}{n^2}\right)^n$。

4. 设 $y=x^2\sin x$，求 $y^{(80)}$。`
}

export async function streamChat(params) {
  const { messages = [], onDelta, onReasoning, onUsage, signal, model } = params
  const system = systemText(messages)

  if (system.includes('[TASK:QUIZ]')) {
    const text = demoQuiz(messages)
    for (const piece of text.match(/[\s\S]{1,120}/g) || []) {
      await sleep(12, signal)
      onDelta?.(piece, piece)
    }
    onUsage?.({ prompt_tokens: 800, completion_tokens: 420, total_tokens: 1220 })
    return { content: text, reasoning: '', usage: null, finishReason: 'stop' }
  }

  if (system.includes('[TASK:GRADE]')) {
    const text = demoGrade(messages)
    for (const piece of text.match(/[\s\S]{1,120}/g) || []) {
      await sleep(12, signal)
      onDelta?.(piece, piece)
    }
    return { content: text, reasoning: '', usage: null, finishReason: 'stop' }
  }

  if (system.includes('[TASK:SUMMARY]')) {
    const text = demoSummary(messages)
    for (const piece of text.match(/[\s\S]{1,80}/g) || []) {
      await sleep(18, signal)
      onDelta?.(piece, piece)
    }
    return { content: text, reasoning: '', usage: null, finishReason: 'stop' }
  }

  if (system.includes('[TASK:OCR]')) {
    const text = demoOcr(messages)
    for (const piece of text.match(/[\s\S]{1,80}/g) || []) {
      await sleep(12, signal)
      onDelta?.(piece, piece)
    }
    return { content: text, reasoning: '', usage: null, finishReason: 'stop' }
  }

  const answer = chatAnswer(messages)
  if (model === 'deepseek-reasoner') {
    // 演示一下思考过程的样子
    const thinking = '先判断题目属于哪一类：极限、积分还是证明。回忆相关定理的条件，再决定用哪种写法。'
    for (const piece of thinking.match(/[\s\S]{1,8}/g) || []) {
      await sleep(20, signal)
      onReasoning?.(piece, piece)
    }
  }
  let full = ''
  for (const piece of answer.match(/[\s\S]{1,6}/g) || []) {
    await sleep(14, signal)
    full += piece
    onDelta?.(piece, full)
  }
  onUsage?.({ prompt_tokens: 900, completion_tokens: 500, total_tokens: 1400 })
  return { content: answer, reasoning: '', usage: null, finishReason: 'stop' }
}

export async function chatOnce(params) {
  await sleep(600, params.signal)
  const messages = params.messages || []
  const system = systemText(messages)
  let text
  if (system.includes('[TASK:QUIZ]')) text = demoQuiz(messages)
  else if (system.includes('[TASK:GRADE]')) text = demoGrade(messages)
  else if (system.includes('[TASK:SUMMARY]')) text = demoSummary(messages)
  else if (system.includes('[TASK:OCR]')) text = demoOcr(messages)
  else text = chatAnswer(messages)
  return {
    text,
    reasoning: '',
    usage: { prompt_tokens: 900, completion_tokens: 500, total_tokens: 1400 },
    finishReason: 'stop',
    raw: null,
  }
}

export async function testConnection() {
  await sleep(300)
  return { models: ['deepseek-flash', 'deepseek-v4-pro'], latencyMs: 300, baseUrl: 'mock://demo' }
}

/** 演示模式下模拟逐页视觉转录 */
export async function transcribeImages({ images = [], onProgress, signal } = {}) {
  const pages = []
  for (const image of images) {
    await sleep(320, signal)
    pages.push({
      page: image.page,
      text: demoOcr([
        { role: 'assistant', content: '' },
        { role: 'user', content: [{ type: 'text', text: `请转录第 ${image.page} 页` }] },
      ]),
    })
    onProgress?.(pages.length, images.length)
  }
  return pages
}

export const DEMO_KEY = 'demo-mode-no-key-required'
