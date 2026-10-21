import { describe, expect, it } from 'vitest'
import { detectFormulaGaps } from '../src/core/parsers/quality.js'
import { buildOcrMessages } from '../src/api/vision.js'

// 取自用户真实试卷 PDF 的提取结果：公式全部丢失
const BROKEN_PDF_TEXT = `华南理工大学2023年数学分析I期末考试
一、叙述题（每题3分）
1.数列的Cauchy收敛原理.
2.的定义
3.存在的Heine定理.
4.闭区间套定理.
5.Lagrange中值定理.
二、判断并说明理由（每题5分）
1.若对任意严格单调递增趋于的数列都有收敛，则存在.
2.因为函数可微必定可导，故一致连续.
3.数列收敛的充分必要条件是任意的自然数，都有
.
三、计算题（每题5分）
1.设确定的隐函数，求关于
的二阶微分.`

const CLEAN_TEXT = `## 第一章 极限

定义 1.1（极限的 $\\varepsilon$-$\\delta$ 定义）设 $f$ 在 $x_0$ 的某去心邻域内有定义，
若对任意 $\\varepsilon>0$，存在 $\\delta>0$，使得 $0<|x-x_0|<\\delta$ 时都有 $|f(x)-A|<\\varepsilon$，
则称 $\\lim_{x\\to x_0}f(x)=A$。

## 第二章 级数

比值判别法：若 $\\lim\\left|\\frac{a_{n+1}}{a_n}\\right|=L<1$，则级数绝对收敛。
`

describe('解析质量检测', () => {
  it('识别出缺公式的 PDF（大宽度空白字形）', () => {
    const quality = detectFormulaGaps(BROKEN_PDF_TEXT, { pages: 2, gapCount: 12 })
    expect(quality.needsRecognition).toBe(true)
    expect(quality.gapCount).toBe(12)
    expect(quality.charsPerPage).toBeLessThan(300)
  })

  it('正常的公式文本不误报', () => {
    const quality = detectFormulaGaps(CLEAN_TEXT, { pages: 3, gapCount: 0 })
    expect(quality.needsRecognition).toBe(false)
  })

  it('空的图片资料由元数据单独标记', () => {
    const quality = detectFormulaGaps('', { pages: 1, gapCount: 0 })
    expect(quality.suspiciousCount).toBe(0)
    expect(quality.needsRecognition).toBe(false)
  })
})

describe('视觉转录请求', () => {
  it('消息里带图片与转录指令', () => {
    const messages = buildOcrMessages({
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
      pageNo: 2,
      hint: '试卷.pdf',
    })
    expect(messages[0].content).toContain('[TASK:OCR]')
    expect(messages[0].content).toContain('LaTeX')
    expect(messages[1].content[1]).toMatchObject({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    })
    expect(messages[1].content[0].text).toContain('第 2 页')
  })
})
