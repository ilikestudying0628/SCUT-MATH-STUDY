<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { useToast } from '../composables/useToast.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  doc: { type: Object, default: null },
  text: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'save'])
const toast = useToast()

const editing = ref(false)
const draft = ref('')

watch(
  () => props.open,
  (open) => {
    editing.value = false
    draft.value = props.text
  },
)

watch(
  () => props.text,
  (value) => {
    if (!editing.value) draft.value = value
  },
)

const charCount = computed(() => draft.value.length.toLocaleString())
const preview = computed(() =>
  draft.value.length > 60000 ? `${draft.value.slice(0, 60000)}\n\n……（预览已截断，编辑时可见全文）` : draft.value,
)

function save() {
  if (!draft.value.trim()) {
    toast.error('内容不能为空')
    return
  }
  emit('save', draft.value)
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="open" class="backdrop" @click.self="emit('close')">
        <div class="modal" role="dialog" aria-modal="true" aria-label="资料原文">
          <header class="head">
            <div class="titles">
              <span class="eyebrow">解析文本 · {{ editing ? '编辑' : '预览' }}</span>
              <h3 class="truncate">{{ doc?.title || '资料' }}</h3>
              <p class="meta">{{ charCount }} 字 · 修改后会重新切分检索块</p>
            </div>
            <button class="btn ghost icon" aria-label="关闭" @click="emit('close')">
              <Icon name="close" :size="18" />
            </button>
          </header>

          <div class="body">
            <div v-if="loading" class="loading"><span class="spinner"></span> 正在读取…</div>
            <textarea v-else-if="editing" v-model="draft" class="textarea editor" spellcheck="false"></textarea>
            <pre v-else class="preview">{{ preview }}</pre>
          </div>

          <footer class="foot">
            <span class="xs muted">公式若因 PDF 提取而错乱，可以直接在这里修正，再保存。</span>
            <div class="actions">
              <button v-if="!editing" class="btn" @click="editing = true">
                <Icon name="edit" :size="15" /> 编辑文本
              </button>
              <template v-else>
                <button class="btn ghost" @click="editing = false">取消编辑</button>
                <button class="btn primary" @click="save">保存并重建索引</button>
              </template>
            </div>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  background: rgba(20, 24, 28, 0.42);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 18px;
}

.modal {
  width: min(860px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border);
}
.titles {
  min-width: 0;
  flex: 1;
}
.eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.6px;
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
}
.head h3 {
  font-size: var(--fs-lg);
  margin: 3px 0 0;
}
.meta {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-mute);
}

.body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  padding: 14px 18px;
}

.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-mute);
  font-size: var(--fs-sm);
}

.preview,
.editor {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 13px 15px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-family: var(--font-sans);
  font-size: var(--fs-sm);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-soft);
}
.editor {
  resize: none;
  color: var(--text);
  background: var(--surface);
}
.editor:focus {
  outline: none;
  border-color: var(--accent);
}

.foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}
.foot .muted {
  flex: 1;
  line-height: 1.5;
}
.actions {
  display: flex;
  gap: 8px;
  flex: none;
}

@media (max-width: 640px) {
  .foot {
    flex-direction: column;
    align-items: stretch;
  }
  .actions {
    justify-content: flex-end;
  }
}
</style>
