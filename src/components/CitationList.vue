<script setup>
defineProps({
  citations: { type: Array, default: () => [] },
  title: { type: String, default: '资料依据' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['open'])
</script>

<template>
  <div v-if="citations.length" class="citation-list" :class="{ compact }">
    <div class="caption">
      <span>{{ title }}</span>
      <span class="muted">{{ citations.length }} 条</span>
    </div>
    <div class="items">
      <button
        v-for="cite in citations"
        :key="cite.chunkId || cite.n"
        type="button"
        class="cite-item"
        :title="`查看：${cite.docTitle}${cite.page != null ? ` 第 ${cite.page} 页` : ''}`"
        @click="emit('open', cite)"
      >
        <span class="cite-n">资料{{ cite.n }}</span>
        <span class="cite-doc truncate">{{ cite.docTitle }}</span>
        <span v-if="cite.page != null" class="cite-page">p.{{ cite.page }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.citation-list {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.caption {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--text-mute);
  margin-bottom: 7px;
  text-transform: uppercase;
}

.items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cite-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 260px;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 11.5px;
  line-height: 1.5;
  transition: all var(--transition);
}
.cite-item:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: var(--accent-soft);
  color: var(--accent);
}

.cite-n {
  font-weight: 700;
  color: var(--accent);
  flex: none;
}

.cite-doc {
  max-width: 150px;
}

.cite-page {
  color: var(--text-mute);
  flex: none;
}

.compact .cite-item {
  padding: 3px 8px;
  font-size: 11px;
}
</style>
