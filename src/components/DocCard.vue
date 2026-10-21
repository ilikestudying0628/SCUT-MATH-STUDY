<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { courseName } from '../core/courses.js'
import { formatBytes, formatRelative } from '../core/text.js'

const props = defineProps({
  doc: { type: Object, required: true },
  job: { type: Object, default: null },
})

const emit = defineEmits(['preview', 'edit', 'delete', 'recognize'])

const statusLabel = computed(() => {
  if (props.job?.label) return props.job.label
  if (props.doc.status === 'ready') return props.doc.meta?.kind === 'image' ? '待识别' : '已入库'
  if (props.doc.status === 'error') return '解析失败'
  return props.job?.stage === 'indexing' ? '建立索引' : '解析中'
})

const progressText = computed(() => {
  if (!props.job) return ''
  if ((props.job.stage === 'parsing' || props.job.stage === 'render' || props.job.stage === 'ocr') && props.job.total) {
    return `${props.job.done}/${props.job.total} ${props.job.stage === 'render' ? '页' : props.job.stage === 'ocr' ? '页' : ''}`.trim()
  }
  return ''
})

const needsRecognition = computed(
  () => Boolean(props.doc.quality?.needsRecognition) || props.doc.meta?.kind === 'image',
)

const canRecognize = computed(() => {
  if (props.doc.status !== 'ready') return false
  const isPdf = /pdf/i.test(props.doc.fileName || '') || /pdf/i.test(props.doc.mime || '')
  const isImage =
    /^image\//.test(props.doc.mime || '') ||
    /\.(png|jpe?g|webp|bmp)$/i.test(props.doc.fileName || '') ||
    props.doc.meta?.kind === 'image'
  return isPdf || isImage
})
</script>

<template>
  <article class="doc-card" :class="doc.status">
    <div class="main">
      <div class="title-row">
        <h3 class="truncate">{{ doc.title }}</h3>
        <span class="badge" :class="doc.status === 'ready' ? 'ok' : doc.status === 'error' ? 'danger' : 'accent'">
          <span v-if="doc.status === 'parsing'" class="spinner" style="width: 10px; height: 10px"></span>
          {{ statusLabel }}
        </span>
        <span class="badge">{{ courseName(doc.course) }}</span>
      </div>

      <p class="meta">
        <span v-if="doc.fileName" class="mono xs">{{ doc.fileName }}</span>
        <span v-if="doc.charCount">{{ doc.charCount.toLocaleString() }} 字</span>
        <span v-if="doc.chunkCount">{{ doc.chunkCount }} 个检索块</span>
        <span v-if="doc.meta?.pages">共 {{ doc.meta.pages }} 页</span>
        <span v-if="doc.meta?.slides">{{ doc.meta.slides }} 张幻灯片</span>
        <span v-if="doc.size">{{ formatBytes(doc.size) }}</span>
        <span class="muted">{{ formatRelative(doc.updatedAt || doc.createdAt) }}</span>
      </p>

      <p v-if="doc.status === 'parsing' || job?.stage === 'render' || job?.stage === 'ocr'" class="progress">
        <span class="spinner"></span>
        正在{{ job?.label || (job?.stage === 'indexing' ? '切分与建立索引' : '提取文字') }} {{ progressText }}
      </p>

      <p v-if="needsRecognition && !job" class="quality-warning">
        <Icon name="alert" :size="14" />
        文字层里缺公式（数学字体没有 Unicode 映射），句子会在公式处断掉；点右侧「AI 识别」可以逐页转录。
      </p>

      <p v-if="doc.error" class="error">
        <Icon name="alert" :size="14" />
        {{ doc.error }}
      </p>

      <ul v-if="doc.warnings?.length" class="warnings">
        <li v-for="(warning, index) in doc.warnings" :key="index">{{ warning }}</li>
      </ul>
    </div>

    <div class="actions">
      <button
        v-if="canRecognize && !job"
        class="btn sm"
        :class="{ primary: needsRecognition }"
        :disabled="doc.status === 'parsing'"
        @click="emit('recognize', doc)"
      >
        <Icon name="sparkle" :size="14" /> AI 识别
      </button>
      <button class="btn ghost sm" :disabled="doc.status !== 'ready' || Boolean(job)" @click="emit('preview', doc)">
        <Icon name="eye" :size="14" /> 查看
      </button>
      <button class="btn ghost sm" :disabled="doc.status !== 'ready' || Boolean(job)" @click="emit('edit', doc)">
        <Icon name="edit" :size="14" /> 编辑
      </button>
      <button class="btn ghost sm" :disabled="doc.status === 'parsing' || Boolean(job)" @click="emit('delete', doc)">
        <Icon name="trash" :size="14" /> 删除
      </button>
    </div>
  </article>
</template>

<style scoped>
.doc-card {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
}
.doc-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow);
}
.doc-card.error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border));
}

.main {
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.title-row h3 {
  font-family: var(--font-sans);
  font-size: 14.5px;
  font-weight: 700;
  max-width: 100%;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 5px 0 0;
  font-size: 11.5px;
  color: var(--text-mute);
}

.progress {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 8px 0 0;
  font-size: var(--fs-xs);
  color: var(--accent);
}

.error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 8px 0 0;
  padding: 7px 9px;
  border-radius: var(--radius-xs);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: var(--fs-xs);
  line-height: 1.55;
}

.warnings {
  margin: 8px 0 0;
  padding-left: 16px;
  font-size: var(--fs-xs);
  color: var(--warn);
  line-height: 1.55;
}

.quality-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 8px 0 0;
  padding: 7px 9px;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--warn) 10%, transparent);
  color: var(--warn);
  font-size: var(--fs-xs);
  line-height: 1.55;
}
.quality-warning svg {
  flex: none;
  margin-top: 2px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
  flex: none;
}

@media (max-width: 720px) {
  .doc-card {
    flex-direction: column;
  }
  .actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
