<script setup>
import { computed, onMounted, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { useSettingsStore } from '../stores/settings.js'
import { useToast } from '../composables/useToast.js'
import { askConfirm } from '../composables/useConfirm.js'
import { MODELS } from '../api/deepseek.js'
import { clearAllData, exportAll, importAll, storageUsage } from '../core/db.js'
import { downloadJson } from '../core/exporters.js'
import { formatBytes as formatSize } from '../core/text.js'

const settings = useSettingsStore()
const toast = useToast()

const keyInput = ref(settings.apiKey)
const showKey = ref(false)
const usage = ref(null)
const importing = ref(false)
const clearBusy = ref(false)
const fileInput = ref(null)
const saveBusy = ref(false)

const keyLoaded = computed(() => Boolean(settings.apiKey))

onMounted(async () => {
  keyInput.value = settings.apiKey
  usage.value = await storageUsage()
})

async function saveKey() {
  settings.setApiKey(keyInput.value)
  if (settings.apiKey) toast.success('API Key 已保存到本机')
  else toast.info('已清空 API Key')
}

async function testConnection() {
  const ok = await settings.testConnection()
  if (ok) toast.success('连接成功')
  else toast.error(settings.connection.message || '连接失败')
}

function savePrefs() {
  settings.save()
  toast.success('设置已保存')
}

function resetParams() {
  settings.resetPreference()
  toast.success('已恢复默认参数')
}

function keyPersistChanged(mode) {
  settings.setKeyPersist(mode)
}

async function doExport() {
  try {
    const data = await exportAll()
    const name = `华工数学复习数据-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(name, data)
    toast.success('已导出数据包（不含原始文件）')
  } catch (error) {
    toast.error(error?.message || '导出失败')
  }
}

function pickImport() {
  fileInput.value?.click()
}

async function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const ok = await askConfirm({
    title: '导入数据',
    message: '导入会覆盖本机现有的资料、对话、练习卷与错题本，确定继续吗？',
    confirmText: '导入并覆盖',
  })
  if (!ok) return
  importing.value = true
  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    const count = await importAll(payload)
    toast.success(`已导入 ${count} 条记录，页面即将刷新`)
    setTimeout(() => window.location.reload(), 900)
  } catch (error) {
    toast.error(error?.message || '导入失败，文件格式不对')
  } finally {
    importing.value = false
  }
}

async function clearEverything() {
  const ok = await askConfirm({
    title: '清空全部数据',
    message: '会删除本机保存的全部资料、对话、练习卷、错题本与设置（API Key 也会清除）。此操作不可恢复，建议先导出。',
    confirmText: '全部清空',
  })
  if (!ok) return
  clearBusy.value = true
  try {
    await clearAllData()
    settings.clearApiKey()
    toast.success('已清空，页面即将刷新')
    setTimeout(() => window.location.reload(), 900)
  } catch (error) {
    toast.error(error?.message || '清空失败')
  } finally {
    clearBusy.value = false
  }
}

const storageText = computed(() => {
  if (!usage.value) return '无法读取存储用量'
  const { usage: used = 0, quota = 0 } = usage.value
  if (!quota) return `${formatSize(used)} 已使用`
  return `${formatSize(used)} / ${formatSize(quota)}（约 ${Math.round((used / quota) * 100)}%）`
})
</script>

<template>
  <div class="page settings-page">
    <div class="page-head">
      <h1>设置</h1>
      <span class="sub">API Key 只保存在本机浏览器</span>
    </div>

    <!-- API -->
    <section class="card pad section">
      <header class="section-head">
        <div>
          <h2>DeepSeek API</h2>
          <p class="xs muted">支持官方接口，也可以填写兼容 OpenAI 协议的代理地址。</p>
        </div>
        <span class="badge" :class="settings.connection.status === 'ok' ? 'ok' : settings.connection.status === 'error' ? 'danger' : ''">
          {{
            settings.connection.status === 'ok'
              ? '连接正常'
              : settings.connection.status === 'error'
                ? '连接失败'
                : settings.connection.status === 'testing'
                  ? '测试中…'
                  : '未测试'
          }}
        </span>
      </header>

      <div class="field">
        <label for="api-key">API Key</label>
        <div class="input-row">
          <input
            id="api-key"
            v-model="keyInput"
            :type="showKey ? 'text' : 'password'"
            class="input mono"
            placeholder="sk-..."
            autocomplete="off"
            spellcheck="false"
          />
          <button class="btn" @click="showKey = !showKey">
            <Icon name="eye" :size="15" />
            {{ showKey ? '隐藏' : '显示' }}
          </button>
          <button class="btn primary" @click="saveKey">保存 Key</button>
        </div>
        <div class="key-meta">
          <span v-if="keyLoaded" class="xs muted">已保存：{{ settings.keyMasked }}</span>
          <span v-else class="xs muted">还没有保存 Key</span>
          <button v-if="keyLoaded" class="link-danger" @click="keyInput = ''; settings.clearApiKey(); toast.success('已清除 Key')">
            清除
          </button>
        </div>
        <p class="hint">
          Key 会以明文形式保存在浏览器 localStorage（或本次会话的 sessionStorage）。公共电脑请选择「仅本次会话」，用完后点清除。
        </p>
      </div>

      <div class="row-3">
        <div class="field">
          <label>保存方式</label>
          <div class="segmented">
            <button
              type="button"
              :class="{ active: settings.keyPersist === 'local' }"
              @click="keyPersistChanged('local')"
            >
              保存在本机
            </button>
            <button
              type="button"
              :class="{ active: settings.keyPersist === 'session' }"
              @click="keyPersistChanged('session')"
            >
              仅本次会话
            </button>
          </div>
        </div>

        <div class="field">
          <label for="base-url">接口地址</label>
          <input
            id="base-url"
            v-model="settings.baseUrl"
            class="input mono"
            placeholder="https://api.deepseek.com"
            spellcheck="false"
          />
          <span class="hint">默认 https://api.deepseek.com，不要填 /chat/completions。</span>
        </div>

        <div class="field">
          <label for="model">模型</label>
          <input
            id="model"
            v-model="settings.model"
            class="input mono"
            list="model-options"
            placeholder="deepseek-chat"
            spellcheck="false"
          />
          <datalist id="model-options">
            <option v-for="model in MODELS" :key="model.id" :value="model.id">
              {{ model.label }}
            </option>
          </datalist>
          <span class="hint">deepseek-flash 支持看图（公式/扫描件识别）；deepseek-v4-pro 更擅长长推导。</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn" :disabled="settings.connection.status === 'testing'" @click="testConnection">
          <span v-if="settings.connection.status === 'testing'" class="spinner" style="width: 13px; height: 13px"></span>
          <Icon v-else name="refresh" :size="15" />
          测试连接
        </button>
        <span
          v-if="settings.connection.message"
          class="conn-msg"
          :class="settings.connection.status"
        >
          {{ settings.connection.message }}
        </span>
      </div>

      <div v-if="settings.connection.models?.length" class="models">
        <span class="xs muted">账号可用模型：</span>
        <span v-for="model in settings.connection.models" :key="model" class="badge">{{ model }}</span>
      </div>
    </section>

    <!-- 模型参数 -->
    <section class="card pad section">
      <header class="section-head">
        <div>
          <h2>检索与生成参数</h2>
          <p class="xs muted">影响回答引用多少资料、生成风格与切块大小。</p>
        </div>
        <button class="btn sm ghost" @click="resetParams">恢复默认</button>
      </header>

      <div class="slider-field">
        <label for="temperature">温度 <strong>{{ Number(settings.temperature).toFixed(2) }}</strong></label>
        <input id="temperature" v-model.number="settings.temperature" type="range" min="0" max="1.3" step="0.05" />
        <span class="hint">越低越严谨（建议 0.3–0.7 用于推导，出题可用 0.8）。</span>
      </div>

      <div class="row-3">
        <div class="field">
          <label for="top-k">每次引用块数（{{ settings.topK }}）</label>
          <input id="top-k" v-model.number="settings.topK" type="range" min="3" max="16" step="1" />
          <span class="hint">越多越全，但上下文更长、更慢。</span>
        </div>
        <div class="field">
          <label for="context-chars">上下文预算（{{ settings.contextChars.toLocaleString() }} 字）</label>
          <input id="context-chars" v-model.number="settings.contextChars" type="range" min="4000" max="30000" step="1000" />
          <span class="hint">放进提示词的资料总量上限。</span>
        </div>
        <div class="field">
          <label for="chunk-size">分块大小（{{ settings.chunkSize }} 字）</label>
          <input id="chunk-size" v-model.number="settings.chunkSize" type="range" min="400" max="1600" step="100" />
          <span class="hint">改动只影响之后新上传的资料。</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" @click="savePrefs">保存设置</button>
        <span class="xs muted">修改后点保存；部分参数下一次请求生效。</span>
      </div>
    </section>

    <!-- 演示模式 -->
    <section class="card pad section">
      <header class="section-head">
        <div>
          <h2>演示模式</h2>
          <p class="xs muted">不调用真实 API，用本地脚本模拟回答与批改，适合没有 Key 时熟悉流程。</p>
        </div>
        <label class="switch">
          <input
            v-model="settings.mockMode"
            type="checkbox"
            @change="settings.save()"
          />
          <span class="track"></span>
          <span class="switch-label">{{ settings.mockMode ? '已开启' : '已关闭' }}</span>
        </label>
      </header>
      <p class="hint">
        演示模式下「资料解析」「检索」「错题本」都是真实功能，只有 AI 回答与批改是模拟内容，回答里会明确标注。
      </p>
    </section>

    <!-- 外观 -->
    <section class="card pad section">
      <header class="section-head">
        <div>
          <h2>外观</h2>
          <p class="xs muted">深色模式适合晚上刷题。</p>
        </div>
      </header>
      <div class="row-2">
        <div class="field">
          <label>主题</label>
          <div class="segmented">
            <button
              v-for="option in [
                { value: 'auto', label: '跟随系统' },
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
              ]"
              :key="option.value"
              type="button"
              :class="{ active: settings.theme === option.value }"
              @click="settings.theme = option.value; settings.save()"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="field">
          <label>正文字号（{{ settings.fontSize }}px）</label>
          <input
            v-model.number="settings.fontSize"
            type="range"
            min="13"
            max="19"
            step="1"
            @change="settings.save()"
          />
        </div>
      </div>
    </section>

    <!-- 数据 -->
    <section class="card pad section">
      <header class="section-head">
        <div>
          <h2>数据管理</h2>
          <p class="xs muted">资料、对话、练习卷都存放在浏览器 IndexedDB。</p>
        </div>
        <span class="badge">{{ storageText }}</span>
      </header>

      <div class="data-actions">
        <button class="btn" @click="doExport">
          <Icon name="download" :size="15" /> 导出数据包
        </button>
        <button class="btn" :disabled="importing" @click="pickImport">
          <span v-if="importing" class="spinner" style="width: 13px; height: 13px"></span>
          <Icon v-else name="upload" :size="15" />
          导入数据包
        </button>
        <button class="btn danger" :disabled="clearBusy" @click="clearEverything">
          <Icon name="trash" :size="15" /> 清空全部数据
        </button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImportFile" />
      </div>
      <p class="hint">
        导出为 JSON（不含原始 PDF/PPT 文件，只含解析后的文本与分块）。换电脑时导入即可继续复习。
      </p>
    </section>

    <!-- 关于 -->
    <section class="card pad section about">
      <h2>关于与限制</h2>
      <ul>
        <li>本项目是纯前端应用：没有服务器，资料与对话不上传，只有你主动提问时会把你选中的资料片段发给 DeepSeek。</li>
        <li>PDF/PPT 由浏览器解析，公式、图表与扫描件可能提取不完整；解析后可以在资料库里手动修改文本。</li>
        <li>如果 PDF 的文字层缺公式（数学字体没有 Unicode 映射），可以用资料卡上的「AI 识别」：页面渲染成图片后由视觉模型逐页转录成 LaTeX。</li>
        <li>检索使用本地 BM25 关键词算法（DeepSeek 没有 embedding 接口），对中文做了分词与二元组处理。</li>
        <li>AI 生成的定义、答案与评分都可能出错，请以教材、老师课件和真题为准。</li>
        <li>版本 v0.1.0 · <a href="https://platform.deepseek.com" target="_blank" rel="noopener">DeepSeek 开放平台</a></li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 900px;
}

.section {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.section-head h2 {
  font-size: var(--fs-lg);
  margin: 0 0 2px;
}
.section-head .badge {
  margin-left: auto;
}

.key-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.link-danger {
  font-size: var(--fs-xs);
  color: var(--danger);
  font-weight: 600;
}

.row-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.row-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.conn-msg {
  font-size: var(--fs-xs);
  color: var(--text-mute);
  flex: 1;
  min-width: 180px;
}
.conn-msg.ok {
  color: var(--ok);
}
.conn-msg.error {
  color: var(--danger);
}

.models {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.slider-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.slider-field label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-soft);
}
.slider-field label strong {
  color: var(--accent);
  font-family: var(--font-mono);
}
.slider-field input[type='range'],
.field input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}

.segmented {
  display: flex;
  padding: 3px;
  gap: 3px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.segmented button {
  flex: 1;
  padding: 6px 4px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-mute);
}
.segmented button.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-left: auto;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.track {
  width: 42px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  position: relative;
  transition: background var(--transition);
}
.track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition);
}
.switch input:checked + .track {
  background: var(--accent);
  border-color: var(--accent);
}
.switch input:checked + .track::after {
  transform: translateX(18px);
}
.switch-label {
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.data-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.about ul {
  margin: 0;
  padding-left: 18px;
  font-size: var(--fs-sm);
  color: var(--text-soft);
  line-height: 1.8;
}
.about li {
  margin-bottom: 4px;
}

@media (max-width: 760px) {
  .row-3,
  .row-2 {
    grid-template-columns: 1fr;
  }
  .section-head .badge {
    margin-left: 0;
  }
}
</style>
