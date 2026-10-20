<script setup>
import Icon from './Icon.vue'

defineProps({
  icon: { type: String, default: 'book' },
  title: { type: String, default: '这里还是空的' },
  desc: { type: String, default: '' },
})
</script>

<template>
  <div class="empty">
    <div class="icon">
      <Icon :name="icon" :size="22" />
    </div>
    <strong>{{ title }}</strong>
    <p v-if="desc">{{ desc }}</p>
    <div v-if="$slots.default" class="actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  padding: 44px 24px;
  text-align: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  color: var(--text-mute);
}
.icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
}
strong {
  display: block;
  font-family: var(--font-serif);
  font-size: var(--fs-lg);
  color: var(--text-soft);
  margin-bottom: 6px;
}
p {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.7;
  max-width: 460px;
  margin-inline: auto;
}
.actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
