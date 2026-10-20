<script setup>
import { onBeforeUnmount, watch } from 'vue'
import Icon from './Icon.vue'
import { useToast } from '../composables/useToast.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  citation: { type: Object, default: null },
})

const emit = defineEmits(['close'])
const toast = useToast()

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeydown)
})

async function copy() {
  if (!props.citation?.text) return
  try {
    await navigator.clipboard.writeText(props.citation.text)
    toast.success('已复制原文片段')
  } catch {
    toast.error('复制失败，请手动选择文本')
  }
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="open" class="drawer-backdrop" @click.self="emit('close')">
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="资料原文">
          <header class="head">
            <div>
              <div class="eyebrow">资料 {{ citation?.n }}</div>
              <h3 class="truncate">{{ citation?.docTitle || '资料原文' }}</h3>
              <p class="meta">
                <span v-if="citation?.page != null">第 {{ citation.page }} 页</span>
                <span v-if="citation?.heading">· {{ citation.heading }}</span>
              </p>
            </div>
            <button class="btn ghost icon" aria-label="关闭" @click="emit('close')">
              <Icon name="close" :size="18" />
            </button>
          </header>

          <div class="body">
            <pre class="text">{{ citation?.text || '（没有内容）' }}</pre>
          </div>

          <footer class="foot">
            <span class="muted xs">AI 生成的内容请以教材与老师课件为准。</span>
            <button class="btn sm" @click="copy">复制原文</button>
          </footer>
        </aside>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: rgba(20, 24, 28, 0.35);
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: min(520px, 100%);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  animation: slide-in 200ms ease;
}

@keyframes slide-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}
.head h3 {
  font-size: var(--fs-lg);
  margin: 2px 0 0;
  max-width: 380px;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.6px;
  color: var(--accent);
  font-weight: 700;
}
.meta {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
}

.text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-sans);
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: var(--text-soft);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
}

.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
.foot .muted {
  flex: 1;
}
</style>
