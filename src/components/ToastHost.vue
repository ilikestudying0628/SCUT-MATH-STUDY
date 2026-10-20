<script setup>
import { dismissToast, toastState } from '../composables/useToast.js'

const ICONS = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
}
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <transition-group name="toast">
      <div
        v-for="item in toastState.items"
        :key="item.id"
        class="toast"
        :class="item.type"
        @click="dismissToast(item.id)"
      >
        <span class="glyph">{{ ICONS[item.type] || 'i' }}</span>
        <span class="text">{{ item.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-width: min(400px, calc(100vw - 32px));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
  font-size: var(--fs-sm);
  line-height: 1.5;
  color: var(--text);
  cursor: pointer;
}

.glyph {
  flex: none;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--surface-3);
  color: var(--text-soft);
}

.toast.success .glyph {
  background: color-mix(in srgb, var(--ok) 18%, transparent);
  color: var(--ok);
}
.toast.error .glyph {
  background: var(--danger-soft);
  color: var(--danger);
}
.toast.warning .glyph {
  background: color-mix(in srgb, var(--warn) 18%, transparent);
  color: var(--warn);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 200ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
