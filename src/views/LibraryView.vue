<script setup>
import { computed, onMounted, ref } from 'vue'
import FileDrop from '../components/FileDrop.vue'
import DocCard from '../components/DocCard.vue'
import DocEditor from '../components/DocEditor.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import { useLibraryStore } from '../stores/library.js'
import { useSettingsStore } from '../stores/settings.js'
import { useToast } from '../composables/useToast.js'
import { askConfirm } from '../composables/useConfirm.js'
import { COURSES } from '../core/courses.js'
import { SAMPLE_DOC } from '../core/samples.js'

const library = useLibraryStore()
const settings = useSettingsStore()
const toast = useToast()

const uploading = ref(0)
const pasteOpen = ref(false)
const pasteTitle = ref('')
const pasteText = ref('')
const pasteCourse = ref(settings.course)
const editorOpen = ref(false)
const editorDoc = ref(null)
const editorText = ref('')
const editorLoading = ref(false)

const docs = computed(() => library.filteredDocs)
const busy = computed(() => uploading.value > 0)
const totalChars = computed(() => library.totalChars)

onMounted(async () => {
  await library.init()
})

async function onFiles(files) {
  if (!files?.length) return
  uploading.value += files.length
  for (const file of files) {
    try {
      const doc = await library.addFile(file)
      toast.success(`《${doc.title}》已入库：${doc.chunkCount} 个检索块`)
      if (doc.warnings?.length) toast.warning(doc.warnings.join(' '), 7000)
    } catch (error) {
      toast.error(`${file.name}：${error?.message || '解析失败'}`, 7000)
    } finally {
      uploading.value -= 1
    }
  }
}

async function addSample() {
  try {
    const doc = await library.addText({
      title: SAMPLE_DOC.title,
      text: SAMPLE_DOC.text,
      course: SAMPLE_DOC.course,
    })
    toast.success(`已添加示例资料（${doc.chunkCount} 个检索块）`)
  } catch (error) {
    toast.error(error?.message || '添加失败')
  }
}

async function savePaste() {
  const text = pasteText.value.trim()
  if (!text) {
    toast.warning('先粘贴一些内容')
    return
  }
  try {
    const doc = await library.addText({
      title: pasteTitle.value.trim(),
      text,
      course: pasteCourse.value,
    })
    toast.success(`已保存：${doc.chunkCount} 个检索块`)
    pasteOpen.value = false
    pasteTitle.value = ''
    pasteText.value = ''
  } catch (error) {
    toast.error(error?.message || '保存失败')
  }
}

async function openEditor(doc) {
  editorDoc.value = doc
  editorText.value = ''
  editorOpen.value = true
  editorLoading.value = true
  try {
    editorText.value = await library.readDocText(doc.id)
  } catch (error) {
    toast.error(error?.message || '读取失败')
  } finally {
    editorLoading.value = false
  }
}

async function saveEditor(text) {
  if (!editorDoc.value) return
  try {
    await library.updateText(editorDoc.value.id, text)
    toast.success('已保存并重建检索索引')
    editorOpen.value = false
  } catch (error) {
    toast.error(error?.message || '保存失败')
  }
}

async function removeDoc(doc) {
  const ok = await askConfirm({
    title: '删除资料',
    message: `确定删除《${doc.title}》吗？对应的检索块会一起删除，引用它的对话将无法再打开原文。`,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await library.remove(doc.id)
    toast.success('已删除')
  } catch (error) {
    toast.error(error?.message || '删除失败')
  }
}

function downloadOriginal(doc) {
  toast.info('原文已随解析文本保留在本机，可在「查看」中查看。')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>资料库</h1>
      <span class="sub">上传课程资料，AI 只依据这些内容作答</span>
      <div class="spacer"></div>
      <button class="btn" @click="pasteOpen = true">
        <Icon name="edit" :size="15" /> 粘贴文本
      </button>
      <button v-if="!library.docs.length" class="btn" @click="addSample">
        <Icon name="sparkle" :size="15" /> 添加示例资料
      </button>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="value">{{ library.docs.length }}</span>
        <span class="label">份资料</span>
      </div>
      <div class="stat">
        <span class="value">{{ totalChars.toLocaleString() }}</span>
        <span class="label">总字数</span>
      </div>
      <div class="stat">
        <span class="value">{{ library.chunkCount }}</span>
        <span class="label">检索块</span>
      </div>
      <div class="stat">
        <span class="value">{{ settings.courseLabel }}</span>
        <span class="label">默认课程</span>
      </div>
      <div class="stats-note">
        <Icon name="layers" :size="14" />
        所有资料只保存在本机浏览器，不会上传到服务器。
      </div>
    </div>

    <FileDrop :disabled="busy" @files="onFiles" />
    <p v-if="busy" class="uploading">
      <span class="spinner"></span> 正在解析 {{ uploading }} 个文件，请稍候…
    </p>

    <div class="toolbar">
      <div class="filters">
        <select v-model="library.filterCourse" class="select course-filter">
          <option value="all">全部课程</option>
          <option v-for="course in COURSES" :key="course.id" :value="course.id">
            {{ course.name }}
          </option>
        </select>
        <label class="search">
          <Icon name="search" :size="15" />
          <input v-model="library.search" class="input" placeholder="搜索资料标题" />
        </label>
      </div>
      <span class="muted xs">{{ docs.length }} / {{ library.docs.length }} 份</span>
    </div>

    <div v-if="docs.length" class="doc-list">
      <DocCard
        v-for="doc in docs"
        :key="doc.id"
        :doc="doc"
        :job="library.jobs[doc.id] || null"
        @preview="openEditor"
        @edit="openEditor"
        @delete="removeDoc"
        @download="downloadOriginal"
      />
    </div>

    <EmptyState
      v-else-if="!library.loading"
      icon="library"
      title="资料库还是空的"
      desc="上传讲义、课件、笔记或往年题。PDF 与 PPT 里的公式可能提取不全，解析后可以手动修正文本。"
    >
      <button class="btn primary" @click="addSample">
        <Icon name="sparkle" :size="15" /> 先加一份示例资料
      </button>
      <button class="btn" @click="pasteOpen = true">粘贴文本</button>
    </EmptyState>

    <!-- 粘贴文本 -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="pasteOpen" class="backdrop" @click.self="pasteOpen = false">
          <div class="modal" role="dialog" aria-modal="true" aria-label="粘贴文本">
            <header class="modal-head">
              <h3>粘贴文本</h3>
              <button class="btn ghost icon" aria-label="关闭" @click="pasteOpen = false">
                <Icon name="close" :size="18" />
              </button>
            </header>
            <div class="modal-body">
              <div class="field">
                <label for="paste-title">资料标题</label>
                <input id="paste-title" v-model="pasteTitle" class="input" placeholder="例如：数学分析第十二章 级数" />
              </div>
              <div class="field">
                <label for="paste-course">所属课程</label>
                <select id="paste-course" v-model="pasteCourse" class="select">
                  <option v-for="course in COURSES" :key="course.id" :value="course.id">
                    {{ course.name }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label for="paste-text">内容</label>
                <textarea
                  id="paste-text"
                  v-model="pasteText"
                  class="textarea paste-area"
                  placeholder="把讲义、笔记或题目粘贴到这里，支持 Markdown 与 LaTeX（$…$）。"
                  spellcheck="false"
                ></textarea>
                <span class="hint">{{ pasteText.length.toLocaleString() }} 字符</span>
              </div>
            </div>
            <footer class="modal-foot">
              <button class="btn ghost" @click="pasteOpen = false">取消</button>
              <button class="btn primary" @click="savePaste">保存到资料库</button>
            </footer>
          </div>
        </div>
      </transition>
    </Teleport>

    <DocEditor
      :open="editorOpen"
      :doc="editorDoc"
      :text="editorText"
      :loading="editorLoading"
      @close="editorOpen = false"
      @save="saveEditor"
    />
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0;
  margin-bottom: 18px;
  padding: 14px 4px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.stat {
  padding: 0 18px;
  border-right: 1px solid var(--border);
  min-width: 110px;
}
.stat:last-of-type {
  border-right: none;
}
.stat .value {
  display: block;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
}
.stat .label {
  font-size: 11px;
  color: var(--text-mute);
  letter-spacing: 0.4px;
}

.stats-note {
  margin-left: auto;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 16px;
  font-size: 11.5px;
  color: var(--text-mute);
}

.uploading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 2px 0;
  font-size: var(--fs-xs);
  color: var(--accent);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 12px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.course-filter {
  width: auto;
  min-width: 128px;
  font-size: var(--fs-sm);
}

.search {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 260px;
  flex: 1;
  padding-left: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-mute);
}
.search:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus);
}
.search .input {
  border: none;
  box-shadow: none;
  padding-left: 0;
  background: transparent;
}
.search .input:focus {
  box-shadow: none;
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 弹窗 */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  background: rgba(20, 24, 28, 0.42);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 18px;
}

.modal {
  width: min(640px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.modal-head h3 {
  font-size: var(--fs-lg);
  flex: 1;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.paste-area {
  min-height: 220px;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}

@media (max-width: 760px) {
  .stat {
    min-width: 50%;
    border-right: none;
    padding: 8px 14px;
  }
  .stats-note {
    margin-left: 0;
    width: 100%;
    padding: 8px 14px 2px;
  }
  .search {
    max-width: none;
  }
}
</style>
