<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'
import ToastHost from './ToastHost.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { useSettingsStore } from '../stores/settings.js'
import { useLibraryStore } from '../stores/library.js'
import { useChatStore } from '../stores/chat.js'
import { useQuizStore } from '../stores/quiz.js'
import { useWrongbookStore } from '../stores/wrongbook.js'
import { COURSES } from '../core/courses.js'

const settings = useSettingsStore()
const library = useLibraryStore()
const chat = useChatStore()
const quiz = useQuizStore()
const wrongbook = useWrongbookStore()
const route = useRoute()

const navOpen = ref(false)
const initializing = ref(true)

const NAV = [
  { to: '/', name: 'dashboard', label: '工作台', icon: 'home' },
  { to: '/chat', name: 'chat', label: '对话复习', icon: 'chat' },
  { to: '/library', name: 'library', label: '资料库', icon: 'library' },
  { to: '/quiz', name: 'quiz', label: '出题练习', icon: 'quiz' },
  { to: '/outline', name: 'outline', label: '复习提纲', icon: 'book' },
  { to: '/wrong', name: 'wrong', label: '错题本', icon: 'wrong' },
  { to: '/settings', name: 'settings', label: '设置', icon: 'settings' },
]

const themeIcon = computed(() => (settings.resolvedTheme === 'dark' ? 'sun' : 'moon'))
const themeLabel = computed(
  () => ({ auto: '跟随系统', light: '浅色', dark: '深色' })[settings.theme] || '跟随系统',
)

onMounted(async () => {
  try {
    await Promise.all([
      library.init(),
      quiz.init(),
      wrongbook.init(),
      chat.init(),
    ])
  } catch (error) {
    console.warn('初始化本地数据失败', error)
  } finally {
    initializing.value = false
  }
})

function onCourseChange(event) {
  settings.course = event.target.value
  settings.save()
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark']
  const index = order.indexOf(settings.theme)
  settings.theme = order[(index + 1) % order.length]
  settings.save()
}

function closeNav() {
  navOpen.value = false
}
</script>

<template>
  <div class="shell">
    <div v-if="navOpen" class="nav-backdrop" @click="closeNav"></div>

    <aside class="sidebar" :class="{ open: navOpen }">
      <div class="brand">
        <div class="logo serif">Σ</div>
        <div class="brand-text">
          <strong>华工数学</strong>
          <span>期末复习助手</span>
        </div>
        <button class="btn ghost icon close-nav" aria-label="关闭菜单" @click="closeNav">
          <Icon name="close" :size="18" />
        </button>
      </div>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          @click="closeNav"
        >
          <Icon :name="item.icon" :size="17" />
          <span>{{ item.label }}</span>
          <span v-if="item.name === 'wrong' && wrongbook.activeItems.length" class="count">
            {{ wrongbook.activeItems.length }}
          </span>
          <span v-if="item.name === 'library' && library.docs.length" class="count muted">
            {{ library.docs.length }}
          </span>
        </RouterLink>
      </nav>

      <div class="side-foot">
        <div class="hint-card">
          <Icon name="layers" :size="15" />
          <div>
            <strong>资料只存在本机</strong>
            <p>浏览器 IndexedDB 存储，不上传服务器。</p>
          </div>
        </div>
        <div class="version">v0.1.0 · 复习用，请以老师课件为准</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="btn ghost icon menu-btn" aria-label="打开菜单" @click="navOpen = true">
          <Icon name="menu" :size="19" />
        </button>

        <div class="course">
          <span class="course-caption">当前课程</span>
          <select class="select course-select" :value="settings.course" @change="onCourseChange">
            <option v-for="course in COURSES" :key="course.id" :value="course.id">
              {{ course.name }}
            </option>
          </select>
          <input
            v-if="settings.course === 'custom'"
            v-model="settings.customCourse"
            class="input custom-course"
            placeholder="填写课程名"
            maxlength="24"
            @change="settings.save()"
          />
        </div>

        <div class="spacer"></div>

        <RouterLink
          to="/settings"
          class="status-chip"
          :class="{
            ok: settings.mockMode || settings.hasKey,
            warn: settings.mockMode,
            bad: !settings.mockMode && !settings.hasKey,
          }"
        >
          <span class="dot"></span>
          {{
            settings.mockMode
              ? '演示模式'
              : settings.hasKey
                ? `Key ${settings.keyMasked}`
                : '未配置 Key'
          }}
        </RouterLink>

        <button class="btn ghost icon" :title="`主题：${themeLabel}`" :aria-label="`切换主题（当前${themeLabel}）`" @click="cycleTheme">
          <Icon :name="themeIcon" :size="18" />
        </button>
      </header>

      <div v-if="!settings.canCallApi && route.name !== 'settings'" class="setup-banner">
        <Icon name="alert" :size="16" />
        <span>还没有配置 DeepSeek API Key。资料解析、错题本等本地功能可用，AI 答疑与出题需要 Key 或演示模式。</span>
        <RouterLink to="/settings" class="banner-link">去设置</RouterLink>
      </div>

      <main class="content" :class="{ 'chat-mode': route.name === 'chat' }">
        <div v-if="initializing" class="boot">
          <div class="spinner"></div>
          <span>正在读取本地资料…</span>
        </div>
        <RouterView v-else v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>

    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
}

/* ---------- 侧栏 ---------- */
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 16px 12px 14px;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(10px);
  z-index: 40;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 18px;
}

.logo {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #fff;
  font-size: 21px;
  font-weight: 700;
  box-shadow: var(--shadow-sm);
}
[data-theme='dark'] .logo {
  color: #0e1418;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.brand-text strong {
  font-family: var(--font-serif);
  font-size: 16px;
  letter-spacing: 0.4px;
}
.brand-text span {
  font-size: 11.5px;
  color: var(--text-mute);
  letter-spacing: 0.5px;
}

.close-nav {
  display: none;
  margin-left: auto;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  color: var(--text-soft);
  font-size: 14px;
  font-weight: 600;
  transition: background var(--transition), color var(--transition);
}
.nav-link:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}
.nav-link.router-link-active {
  background: var(--accent-soft);
  color: var(--accent);
}

.count {
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
[data-theme='dark'] .count {
  color: #0e1418;
}
.count.muted {
  background: var(--surface-3);
  color: var(--text-mute);
}

.side-foot {
  margin-top: auto;
  padding-top: 14px;
}

.hint-card {
  display: flex;
  gap: 8px;
  padding: 10px 11px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-strong);
  color: var(--text-mute);
  background: color-mix(in srgb, var(--surface-2) 60%, transparent);
}
.hint-card strong {
  display: block;
  font-size: 12px;
  color: var(--text-soft);
}
.hint-card p {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.5;
}

.version {
  margin-top: 10px;
  padding: 0 4px;
  font-size: 10.5px;
  color: var(--text-mute);
  opacity: 0.8;
}

/* ---------- 主区 ---------- */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  flex: none;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(10px);
  z-index: 20;
}

.menu-btn {
  display: none;
}

.course {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.course-caption {
  font-size: 11px;
  letter-spacing: 0.6px;
  color: var(--text-mute);
  text-transform: uppercase;
}

.course-select {
  width: auto;
  min-width: 128px;
  padding: 6px 10px;
  font-size: var(--fs-sm);
  font-weight: 600;
  background: var(--surface);
}

.custom-course {
  width: 140px;
  padding: 6px 10px;
  font-size: var(--fs-sm);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-soft);
  white-space: nowrap;
}
.status-chip:hover {
  text-decoration: none;
  border-color: var(--border-strong);
}
.status-chip .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-mute);
}
.status-chip.ok .dot {
  background: var(--ok);
}
.status-chip.ok {
  color: var(--ok);
  border-color: color-mix(in srgb, var(--ok) 35%, var(--border));
}
.status-chip.warn .dot {
  background: var(--warn);
}
.status-chip.warn {
  color: var(--warn);
  border-color: color-mix(in srgb, var(--warn) 35%, var(--border));
}
.status-chip.bad .dot {
  background: var(--danger);
}
.status-chip.bad {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
}

.setup-banner {
  flex: none;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px;
  font-size: var(--fs-sm);
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 9%, var(--surface));
  border-bottom: 1px solid color-mix(in srgb, var(--warn) 22%, var(--border));
}
.banner-link {
  margin-left: auto;
  font-weight: 700;
  color: inherit;
  text-decoration: underline;
  white-space: nowrap;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.content.chat-mode {
  display: flex;
  overflow: hidden;
}

.boot {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-mute);
  font-size: var(--fs-sm);
}

/* ---------- 移动端 ---------- */
.nav-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 24, 28, 0.4);
  z-index: 39;
}

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-102%);
    transition: transform 220ms ease;
    box-shadow: var(--shadow-lg);
    background: var(--surface);
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .close-nav {
    display: inline-flex;
  }
  .menu-btn {
    display: inline-flex;
  }
  .topbar {
    padding: 0 12px;
    gap: 8px;
  }
  .course-caption {
    display: none;
  }
  .course-select {
    min-width: 96px;
  }
  .custom-course {
    width: 96px;
  }
  .setup-banner {
    padding: 8px 12px;
    font-size: var(--fs-xs);
  }
  .setup-banner span {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
</style>
