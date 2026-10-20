<script setup>
import { nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { confirmState, settleConfirm } from '../composables/useConfirm.js'

const confirmButton = ref(null)

watch(
  () => confirmState.open,
  async (open) => {
    if (open) {
      await nextTick()
      confirmButton.value?.focus()
    }
  },
)

function onKeydown(event) {
  if (event.key === 'Escape') settleConfirm(false)
  if (event.key === 'Enter') settleConfirm(true)
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="confirmState.open" class="backdrop" @click.self="settleConfirm(false)" @keydown="onKeydown">
        <div class="dialog" role="dialog" aria-modal="true" :aria-label="confirmState.title">
          <header class="head">
            <span class="icon" :class="{ danger: confirmState.danger }">
              <Icon :name="confirmState.danger ? 'alert' : 'check'" :size="18" />
            </span>
            <h3>{{ confirmState.title }}</h3>
          </header>
          <p class="message">{{ confirmState.message }}</p>
          <footer class="actions">
            <button class="btn ghost" @click="settleConfirm(false)">
              {{ confirmState.cancelText }}
            </button>
            <button
              ref="confirmButton"
              class="btn"
              :class="confirmState.danger ? 'danger' : 'primary'"
              @click="settleConfirm(true)"
            >
              {{ confirmState.confirmText }}
            </button>
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
  z-index: 100;
  background: rgba(20, 24, 28, 0.42);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.dialog {
  width: min(420px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 20px 22px 16px;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.head h3 {
  font-size: var(--fs-lg);
}

.icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
}
.icon.danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.message {
  color: var(--text-soft);
  font-size: var(--fs-sm);
  line-height: 1.7;
  margin: 0 0 18px;
  white-space: pre-line;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
