import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 相对路径：dist 可以直接丢到任意静态目录 / GitHub Pages 子路径
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  server: {
    watch: {
      // 部分编辑器/工具会在源文件旁建临时目录，避免 watcher 因锁文件崩溃
      ignored: ['**/*.tmpdir/**', '**/.*.tmpdir/**', '**/*.tmp'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    server: {
      deps: {
        inline: ['katex'],
      },
    },
  },
})
