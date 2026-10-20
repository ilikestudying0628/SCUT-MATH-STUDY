import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuestionCard from '../src/components/QuestionCard.vue'
import CitationList from '../src/components/CitationList.vue'
import MessageBubble from '../src/components/MessageBubble.vue'

const singleQuestion = {
  id: 'q1',
  type: 'single',
  stem: 'Rolle 定理中，下列哪个条件不是必需的？',
  options: [
    { key: 'A', text: '闭区间连续' },
    { key: 'B', text: '开区间可导' },
    { key: 'C', text: '端点值相等' },
    { key: 'D', text: '导函数连续' },
  ],
  answer: 'D',
  explanation: 'Rolle 定理只要求可导，不要求导函数连续。',
  points: 5,
  difficulty: 'easy',
  knowledge: ['Rolle 定理'],
  source: '【资料1】',
}

describe('QuestionCard', () => {
  it('点击选项同步 v-model', async () => {
    const wrapper = mount(QuestionCard, {
      props: { question: singleQuestion, index: 0, modelValue: '' },
    })
    await wrapper.findAll('.option')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['B'])
  })

  it('多选题可累加选项并排序', async () => {
    const question = { ...singleQuestion, type: 'multiple', answer: 'A、C' }
    const wrapper = mount(QuestionCard, {
      props: { question, index: 0, modelValue: 'C' },
    })
    await wrapper.findAll('.option')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['AC'])
  })

  it('批改后展示得分与答案入口', async () => {
    const wrapper = mount(QuestionCard, {
      props: {
        question: singleQuestion,
        index: 0,
        modelValue: 'A',
        disabled: true,
        result: { score: 0, max: 5, note: '正确选项为 D', source: 'local' },
      },
    })
    expect(wrapper.find('.score').text()).toContain('0 / 5')
    expect(wrapper.text()).toContain('正确选项为 D')
    await wrapper.findAll('button').find((btn) => btn.text().includes('查看参考答案')).trigger('click')
    expect(wrapper.emitted('reveal')).toHaveLength(1)
  })

  it('公式在题干中渲染', () => {
    const wrapper = mount(QuestionCard, {
      props: {
        question: { ...singleQuestion, stem: '求 $\\lim_{x\\to0}\\frac{\\sin x}{x}$。' },
        index: 0,
        modelValue: '',
      },
    })
    expect(wrapper.find('.stem').html()).toContain('katex')
  })
})

describe('CitationList', () => {
  it('点击引用发出 open 事件', async () => {
    const citations = [
      { n: 1, docId: 'd1', docTitle: '数学分析讲义', page: 3, chunkId: 'd1:0', text: '原文' },
    ]
    const wrapper = mount(CitationList, { props: { citations } })
    await wrapper.find('.cite-item').trigger('click')
    expect(wrapper.emitted('open')[0][0]).toMatchObject({ n: 1, docTitle: '数学分析讲义' })
  })

  it('没有引用时不渲染', () => {
    const wrapper = mount(CitationList, { props: { citations: [] } })
    expect(wrapper.find('.citation-list').exists()).toBe(false)
  })
})

describe('MessageBubble', () => {
  it('渲染 Markdown 与公式', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'm1',
          role: 'assistant',
          content: '由 $x^2=1$ 得 $x=\\pm1$。',
          status: 'done',
          citations: [],
          createdAt: Date.now(),
        },
      },
    })
    expect(wrapper.find('.md').html()).toContain('katex')
  })

  it('显示错误提示与重试按钮', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'm2',
          role: 'assistant',
          content: '',
          status: 'error',
          error: { title: 'API Key 校验失败', message: 'Key 无效', hint: '去设置里重填' },
          createdAt: Date.now(),
        },
      },
    })
    expect(wrapper.text()).toContain('API Key 校验失败')
    expect(wrapper.text()).toContain('去设置里重填')
    expect(wrapper.text()).toContain('重试')
  })

  it('用户消息按纯文本展示', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'm3',
          role: 'user',
          content: '**不是加粗**',
          status: 'done',
          createdAt: Date.now(),
        },
      },
    })
    expect(wrapper.find('.user-text').text()).toContain('**不是加粗**')
  })
})
