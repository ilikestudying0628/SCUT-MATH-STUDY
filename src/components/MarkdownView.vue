<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '../core/markdown/index.js'

const props = defineProps({
  content: { type: String, default: '' },
})

const emit = defineEmits(['cite'])

const html = computed(() => renderMarkdown(props.content))

function onClick(event) {
  const chip = event.target?.closest?.('[data-cite]')
  if (!chip) return
  event.preventDefault()
  const n = Number(chip.dataset.cite)
  if (Number.isFinite(n)) emit('cite', n)
}
</script>

<template>
  <div class="md" v-html="html" @click="onClick"></div>
</template>
