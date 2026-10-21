import { chatOnce } from './deepseek.js'

export const OCR_SYSTEM = `[TASK:OCR]
你在把数学资料（试卷、讲义、笔记）的页面截图逐字转写成 Markdown，供后续检索与复习使用。

转录规则：
1. 逐字转录，保留题号、选项、标题层级与阅读顺序；不要合并题目。
2. 所有数学式子都用 LaTeX：行内 $...$，独立公式 $$...$$；多行推导放进 aligned 并在等号处对齐。
3. 公式要完整，不能省略或改写成中文；看不清的符号写 [?]，不要猜。
4. 公式里不夹中文，中文说明放在公式外；不要用 \\tag、equation、eqnarray。
5. 不解释、不总结、不补全；只输出这一页的 Markdown 正文。
6. 如果这一页没有文字（纯图或空白），输出空字符串。`

/**
 * @param {{imageDataUrl: string, pageNo: number, hint?: string}} params
 */
export function buildOcrMessages({ imageDataUrl, pageNo, hint = '' }) {
  return [
    { role: 'system', content: OCR_SYSTEM },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `请转录第 ${pageNo} 页${hint ? `（${hint}）` : ''}。只输出 Markdown。`,
        },
        { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
      ],
    },
  ]
}

/**
 * 逐页调用视觉模型转录。
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} [params.baseUrl]
 * @param {string} [params.model]
 * @param {Array<{page: number, dataUrl: string}>} params.images
 * @param {string} [params.hint]
 * @param {AbortSignal} [params.signal]
 * @param {(done: number, total: number) => void} [params.onProgress]
 */
export async function transcribeImages(params) {
  const { images = [], onProgress, signal, hint = '' } = params
  const pages = []
  for (const image of images) {
    if (signal?.aborted) break
    const response = await chatOnce({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      model: params.model,
      messages: buildOcrMessages({ imageDataUrl: image.dataUrl, pageNo: image.page, hint }),
      temperature: 0.1,
      maxTokens: 4000,
      signal,
    })
    const text = String(response.text || '').trim()
    if (text) pages.push({ page: image.page, text })
    onProgress?.(pages.length, images.length)
  }
  return pages
}
