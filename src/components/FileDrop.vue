<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'

defineProps({
  accept: { type: String, default: '.pdf,.docx,.pptx,.txt,.md,.markdown,.tex,.csv' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['files'])
const dragging = ref(false)
const inputEl = ref(null)

function pick() {
  inputEl.value?.click()
}

function onInput(event) {
  const files = [...(event.target.files || [])]
  if (files.length) emit('files', files)
  event.target.value = ''
}

function onDrop(event) {
  dragging.value = false
  const files = [...(event.dataTransfer?.files || [])]
  if (files.length) emit('files', files)
}
</script>

<template>
  <div
    class="drop"
    :class="{ dragging, disabled }"
    role="button"
    tabindex="0"
    @click="pick"
    @keydown.enter.prevent="pick"
    @keydown.space.prevent="pick"
    @dragover.prevent="dragging = true"
    @dragenter.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input ref="inputEl" type="file" multiple :accept="accept" hidden @change="onInput" />
    <div class="icon">
      <Icon name="upload" :size="21" />
    </div>
    <div class="text">
      <strong>拖拽资料到这里，或点击选择</strong>
      <span>支持 PDF / DOCX / PPTX / TXT / MD，单个不超过 60MB。扫描版 PDF 需要先转成文字。</span>
    </div>
    <span class="badge accent">本机解析</span>
  </div>
</template>

<style scoped>
.drop {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: var(--radius);
  border: 1.5px dashed var(--border-strong);
  background: color-mix(in srgb, var(--surface) 65%, transparent);
  transition: border-color var(--transition), background var(--transition);
  cursor: pointer;
}
.drop:hover,
.drop.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.drop.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.icon {
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--accent);
}

.text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.text strong {
  font-size: var(--fs-sm);
}
.text span {
  font-size: var(--fs-xs);
  color: var(--text-mute);
  line-height: 1.55;
}

.drop .badge {
  margin-left: auto;
  flex: none;
}

@media (max-width: 640px) {
  .drop {
    flex-wrap: wrap;
  }
  .drop .badge {
    margin-left: 0;
  }
}
</style>
