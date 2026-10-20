import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: '工作台' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('../views/ChatView.vue'),
    meta: { title: '对话复习' },
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('../views/LibraryView.vue'),
    meta: { title: '资料库' },
  },
  {
    path: '/quiz',
    name: 'quiz',
    component: () => import('../views/QuizView.vue'),
    meta: { title: '出题练习' },
  },
  {
    path: '/outline',
    name: 'outline',
    component: () => import('../views/OutlineView.vue'),
    meta: { title: '复习提纲' },
  },
  {
    path: '/wrong',
    name: 'wrong',
    component: () => import('../views/WrongbookView.vue'),
    meta: { title: '错题本' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '设置' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = to.meta?.title
  document.title = title ? `${title} · 华工数学复习助手` : '华工数学复习助手'
})

export default router
