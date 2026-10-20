import { reactive } from 'vue'

let seq = 0

export const toastState = reactive({ items: [] })

export function dismissToast(id) {
  const index = toastState.items.findIndex((item) => item.id === id)
  if (index >= 0) toastState.items.splice(index, 1)
}

export function pushToast(message, type = 'info', duration = 3200) {
  if (!message) return null
  const id = ++seq
  toastState.items.push({ id, message: String(message), type })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function useToast() {
  return {
    toast: pushToast,
    info: (message, duration) => pushToast(message, 'info', duration ?? 3200),
    success: (message, duration) => pushToast(message, 'success', duration ?? 3000),
    warning: (message, duration) => pushToast(message, 'warning', duration ?? 4200),
    error: (message, duration) => pushToast(message, 'error', duration ?? 5200),
  }
}
