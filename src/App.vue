<script setup>
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import { useSettingsStore } from './stores/settings.js'

const settings = useSettingsStore()

onMounted(() => {
  settings.load()
  settings.applyAppearance()
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener?.('change', () => {
    if (settings.theme === 'auto') settings.applyAppearance()
  })
})
</script>

<template>
  <AppShell />
</template>
