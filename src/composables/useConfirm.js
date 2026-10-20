import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: true,
  resolve: null,
})

/**
 * 全局确认框。用法：`if (!(await askConfirm({ message: '删除这份资料？' }))) return`
 */
export function askConfirm(options = {}) {
  return new Promise((resolve) => {
    Object.assign(confirmState, {
      open: true,
      title: options.title || '确认操作',
      message: options.message || '',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      danger: options.danger !== false,
      resolve,
    })
  })
}

export function settleConfirm(value) {
  const resolve = confirmState.resolve
  confirmState.open = false
  confirmState.resolve = null
  if (resolve) resolve(value)
}
