import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'

import './styles/tokens.css'
import './styles/base.css'
import 'katex/dist/katex.min.css'
import './styles/print.css'

createApp(App).use(createPinia()).use(router).mount('#app')
