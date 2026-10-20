<script setup>
import { computed, onMounted, ref } from 'vue'
import WrongbookCard from '../components/WrongbookCard.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import { useWrongbookStore } from '../stores/wrongbook.js'
import { useToast } from '../composables/useToast.js'
import { askConfirm } from '../composables/useConfirm.js'
import { downloadText, safeFilename, wrongbookToMarkdown } from '../core/exporters.js'

const wrongbook = useWrongbookStore()
const toast = useToast()

const filter = ref('all')
const showMastered = ref(false)

const courseOptions = computed(() => {
  const names = [...new Set(wrongbook.items.map((item) => item.courseName).filter(Boolean))]
  return names
})

const visible = computed(() =>
  wrongbook.items.filter((item) => {
    if (!showMastered.value && item.mastered) return false
    if (filter.value !== 'all' && item.courseName !== filter.value) return false
    return true
  }),
)

onMounted(async () => {
  await wrongbook.init()
})

async function toggle(item) {
  await wrongbook.toggleMastered(item.id)
  toast.success(item.mastered ? '已标记为未掌握' : '已标记为掌握')
}

async function remove(item) {
  const ok = await askConfirm({
    title: '删除错题',
    message: '确定从错题本删除这道题吗？',
    confirmText: '删除',
  })
  if (!ok) return
  await wrongbook.remove(item.id)
  toast.success('已删除')
}

async function clearAll() {
  const ok = await askConfirm({
    title: '清空错题本',
    message: `会删除全部 ${wrongbook.items.length} 道错题记录，无法恢复。`,
    confirmText: '清空',
  })
  if (!ok) return
  await wrongbook.clear()
  toast.success('错题本已清空')
}

function exportMarkdown() {
  const list = visible.value
  if (!list.length) {
    toast.warning('没有可导出的错题')
    return
  }
  downloadText(`${safeFilename('错题本')}.md`, wrongbookToMarkdown(list))
  toast.success('已导出错题本')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>错题本</h1>
      <span class="sub">做错的主观题与客观题会自动收集到这里</span>
      <div class="spacer"></div>
      <button class="btn" :disabled="!visible.length" @click="exportMarkdown">
        <Icon name="download" :size="15" /> 导出
      </button>
      <button class="btn danger" :disabled="!wrongbook.items.length" @click="clearAll">清空</button>
    </div>

    <div class="toolbar">
      <div class="chips">
        <button class="chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          全部（{{ wrongbook.activeItems.length }}）
        </button>
        <button
          v-for="name in courseOptions"
          :key="name"
          class="chip"
          :class="{ active: filter === name }"
          @click="filter = name"
        >
          {{ name }}
        </button>
      </div>
      <label class="toggle-mastered">
        <input v-model="showMastered" type="checkbox" />
        显示已掌握
      </label>
    </div>

    <div v-if="visible.length" class="list">
      <WrongbookCard
        v-for="item in visible"
        :key="item.id"
        :item="item"
        @toggle="toggle"
        @remove="remove"
      />
    </div>

    <EmptyState
      v-else
      icon="wrong"
      title="错题本是空的"
      desc="去「出题练习」做一套题，得分低于 60% 的题目会自动收进这里，方便考前集中重做。"
    >
      <RouterLink to="/quiz" class="btn primary">
        <Icon name="quiz" :size="15" /> 去做一套题
      </RouterLink>
    </EmptyState>

    <p v-if="wrongbook.items.length" class="foot-note">
      共 {{ wrongbook.items.length }} 条记录，其中 {{ wrongbook.masteredItems.length }} 条已标记掌握。
    </p>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.toggle-mastered {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--text-mute);
  cursor: pointer;
}
.toggle-mastered input {
  accent-color: var(--accent);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.foot-note {
  margin-top: 16px;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}
</style>
