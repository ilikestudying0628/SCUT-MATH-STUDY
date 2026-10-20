<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import { useSettingsStore } from '../stores/settings.js'
import { useLibraryStore } from '../stores/library.js'
import { useQuizStore } from '../stores/quiz.js'
import { useWrongbookStore } from '../stores/wrongbook.js'
import { getCourse } from '../core/courses.js'
import { formatRelative } from '../core/text.js'
import { totalPoints } from '../core/exporters.js'

const settings = useSettingsStore()
const library = useLibraryStore()
const quiz = useQuizStore()
const wrongbook = useWrongbookStore()

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const course = computed(() => getCourse(settings.course))
const dateText = computed(() =>
  new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
)

const suggestion = computed(() => {
  if (!settings.canCallApi) {
    return {
      icon: 'alert',
      title: '先配置 API Key',
      desc: '也可以打开演示模式，不花钱体验完整流程。',
      to: '/settings',
      cta: '去设置',
    }
  }
  if (!library.readyDocs.length) {
    return {
      icon: 'library',
      title: '上传第一份课程资料',
      desc: '讲义、课件、往年题都行；解析后 AI 才能引用原文。',
      to: '/library',
      cta: '上传资料',
    }
  }
  if (wrongbook.activeItems.length) {
    return {
      icon: 'wrong',
      title: `先清掉 ${wrongbook.activeItems.length} 道错题`,
      desc: '考前把错题重做一遍，比刷新题更划算。',
      to: '/wrong',
      cta: '打开错题本',
    }
  }
  if (!quiz.quizzes.length) {
    return {
      icon: 'quiz',
      title: '生成第一套练习卷',
      desc: `按《${library.readyDocs[0].title}》出题，附答案与解析。`,
      to: '/quiz',
      cta: '去出题',
    }
  }
  return {
    icon: 'chat',
    title: '继续上一次对话',
    desc: '把不懂的推导追问到底，比抄笔记更有效。',
    to: '/chat',
    cta: '继续对话',
  }
})

const recentDocs = computed(() => library.docs.slice(0, 4))
const recentQuizzes = computed(() => quiz.quizzes.slice(0, 3))
const lastQuiz = computed(() => quiz.quizzes[0] || null)

const stats = computed(() => [
  { label: '课程资料', value: library.readyDocs.length, unit: '份', icon: 'library', to: '/library' },
  { label: '检索块', value: library.chunkCount, unit: '块', icon: 'layers', to: '/library' },
  { label: '练习卷', value: quiz.quizzes.length, unit: '套', icon: 'quiz', to: '/quiz' },
  { label: '待复习错题', value: wrongbook.activeItems.length, unit: '道', icon: 'wrong', to: '/wrong' },
])
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-text">
        <span class="date">{{ dateText }}</span>
        <h1>{{ greeting }}，今天也把定理的条件写清楚。</h1>
        <p class="lead">
          当前课程是<strong>{{ settings.courseLabel }}</strong>。把老师发的讲义、课件和往年题放进资料库，
          AI 会依据这些内容答疑、出题、批改，并标出引用来源。
        </p>
        <div class="hero-actions">
          <RouterLink to="/chat" class="btn primary">
            <Icon name="chat" :size="16" /> 开始对话
          </RouterLink>
          <RouterLink to="/quiz" class="btn">
            <Icon name="quiz" :size="16" /> 生成练习卷
          </RouterLink>
          <RouterLink to="/library" class="btn ghost">
            <Icon name="upload" :size="16" /> 上传资料
          </RouterLink>
        </div>
      </div>
      <div class="hero-card">
        <div class="seal serif">Σ</div>
        <p class="quote">“数学分析的第一课，是学会把‘显然’写成 ε-δ。”</p>
        <span class="quote-from">—— 期末复习助手</span>
      </div>
    </header>

    <section class="stats">
      <RouterLink v-for="item in stats" :key="item.label" :to="item.to" class="stat card">
        <span class="stat-icon"><Icon :name="item.icon" :size="17" /></span>
        <span class="stat-value">{{ item.value }}</span>
        <span class="stat-label">{{ item.label }}（{{ item.unit }}）</span>
      </RouterLink>
    </section>

    <section class="suggest card" :class="{ warn: !settings.canCallApi }">
      <span class="suggest-icon"><Icon :name="suggestion.icon" :size="20" /></span>
      <div class="suggest-text">
        <strong>{{ suggestion.title }}</strong>
        <p>{{ suggestion.desc }}</p>
      </div>
      <RouterLink :to="suggestion.to" class="btn sm">{{ suggestion.cta }}</RouterLink>
    </section>

    <div class="columns">
      <section class="panel card pad">
        <header class="panel-head">
          <h2>资料库</h2>
          <RouterLink to="/library" class="more">管理</RouterLink>
        </header>

        <div v-if="recentDocs.length" class="mini-list">
          <RouterLink
            v-for="doc in recentDocs"
            :key="doc.id"
            to="/library"
            class="mini-item"
          >
            <span class="file-icon"><Icon name="file" :size="15" /></span>
            <span class="mini-text">
              <span class="mini-title truncate">{{ doc.title }}</span>
              <span class="mini-meta">
                {{ doc.chunkCount }} 块 · {{ formatRelative(doc.updatedAt || doc.createdAt) }}
              </span>
            </span>
            <span class="badge" :class="doc.status === 'ready' ? 'ok' : doc.status === 'error' ? 'danger' : ''">
              {{ doc.status === 'ready' ? '就绪' : doc.status === 'error' ? '失败' : '解析中' }}
            </span>
          </RouterLink>
        </div>
        <p v-else class="empty-line">
          还没有资料。上传一份讲义，AI 的回答就能引用原文并标注页码。
        </p>

        <div class="panel-foot">
          <RouterLink to="/library" class="btn sm">
            <Icon name="plus" :size="14" /> 添加资料
          </RouterLink>
          <span class="muted xs" v-if="library.totalChars">
            共 {{ library.totalChars.toLocaleString() }} 字
          </span>
        </div>
      </section>

      <section class="panel card pad">
        <header class="panel-head">
          <h2>练习与错题</h2>
          <RouterLink to="/quiz" class="more">去练习</RouterLink>
        </header>

        <RouterLink v-if="lastQuiz" :to="'/quiz'" class="last-quiz">
          <span class="badge accent">最近一套</span>
          <strong class="truncate">{{ lastQuiz.title }}</strong>
          <span class="xs muted">
            {{ lastQuiz.questions.length }} 题 · {{ totalPoints(lastQuiz) }} 分
            <template v-if="lastQuiz.attempts?.length">
              · 最近 {{ lastQuiz.attempts[0].totalScore }}/{{ lastQuiz.attempts[0].maxTotal }} 分
            </template>
          </span>
        </RouterLink>

        <div v-if="wrongbook.byCourse.length" class="wrong-groups">
          <div v-for="[name, items] in wrongbook.byCourse" :key="name" class="wrong-row">
            <span class="truncate">{{ name }}</span>
            <span class="badge danger">{{ items.length }} 道</span>
          </div>
        </div>
        <p v-else class="empty-line">
          做题后，得分低于 60% 的题目会自动进入错题本。
        </p>

        <div class="panel-foot">
          <RouterLink to="/wrong" class="btn sm">
            <Icon name="wrong" :size="14" /> 打开错题本
          </RouterLink>
          <span class="muted xs">{{ wrongbook.items.length }} 条记录</span>
        </div>
      </section>
    </div>

    <section class="course-tip card pad">
      <div class="tip-head">
        <span class="badge accent">{{ course.name }}</span>
        <h3>这门课的常见考点</h3>
      </div>
      <p>{{ course.hint }}</p>
      <p class="disclaimer">
        以上仅为通用复习方向，不等于你所在班级的教学大纲；一切以老师课件与真题为准。
      </p>
    </section>

    <section class="workflow">
      <h2>建议的复习流程</h2>
      <ol>
        <li>
          <span class="step">1</span>
          <div><strong>整理资料</strong><p>把这一学期的讲义、课件、往年题拖进资料库。</p></div>
        </li>
        <li>
          <span class="step">2</span>
          <div><strong>先问概念</strong><p>让 AI 用你的资料复述定义、定理条件，并标出引用。</p></div>
        </li>
        <li>
          <span class="step">3</span>
          <div><strong>再出题</strong><p>按题型与难度生成一套题，限时做完再提交批改。</p></div>
        </li>
        <li>
          <span class="step">4</span>
          <div><strong>清错题</strong><p>考前只做错题本，把丢分点逐个补掉。</p></div>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  gap: 22px;
  align-items: stretch;
  padding: 26px 28px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background:
    radial-gradient(1200px 200px at 0% 0%, var(--accent-soft), transparent 60%),
    var(--surface);
  box-shadow: var(--shadow-sm);
  margin-bottom: 18px;
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.date {
  font-size: 11.5px;
  letter-spacing: 1px;
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
}

.hero h1 {
  font-size: clamp(22px, 2.6vw, 30px);
  margin: 8px 0 10px;
  line-height: 1.35;
}

.lead {
  margin: 0;
  max-width: 620px;
  color: var(--text-mute);
  font-size: var(--fs-sm);
  line-height: 1.8;
}
.lead strong {
  color: var(--text-soft);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.hero-card {
  width: 220px;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 18px;
  border-radius: var(--radius);
  border: 1px dashed var(--border-strong);
  background: color-mix(in srgb, var(--surface-2) 70%, transparent);
}
.seal {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #fff;
  font-size: 24px;
}
[data-theme='dark'] .seal {
  color: #0e1418;
}
.quote {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-soft);
}
.quote-from {
  font-size: 10.5px;
  color: var(--text-mute);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 13px 15px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition), transform var(--transition);
}
.stat:hover {
  text-decoration: none;
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.stat-icon {
  color: var(--accent);
  margin-bottom: 4px;
}
.stat-value {
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 11.5px;
  color: var(--text-mute);
}

.suggest {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 14px 17px;
  margin-bottom: 16px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}
.suggest.warn {
  border-color: color-mix(in srgb, var(--warn) 30%, var(--border));
  background: color-mix(in srgb, var(--warn) 7%, var(--surface));
}
.suggest-icon {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--accent);
}
.suggest-text {
  flex: 1;
  min-width: 0;
}
.suggest-text strong {
  font-size: var(--fs-sm);
}
.suggest-text p {
  margin: 2px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.panel-head h2 {
  font-size: var(--fs-lg);
  margin: 0;
}
.more {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 600;
}

.mini-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mini-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: var(--radius-xs);
  color: var(--text);
  border: 1px solid transparent;
}
.mini-item:hover {
  text-decoration: none;
  background: var(--surface-2);
  border-color: var(--border);
}
.file-icon {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--surface-2);
  color: var(--text-mute);
}
.mini-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.mini-title {
  font-size: 12.5px;
  font-weight: 600;
}
.mini-meta {
  font-size: 10.5px;
  color: var(--text-mute);
}

.empty-line {
  margin: 4px 0;
  font-size: var(--fs-xs);
  color: var(--text-mute);
  line-height: 1.7;
}

.panel-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

.last-quiz {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
}
.last-quiz:hover {
  text-decoration: none;
  border-color: var(--border-strong);
}
.last-quiz .badge {
  align-self: flex-start;
}

.wrong-groups {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wrong-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-soft);
}
.wrong-row .badge {
  margin-left: auto;
}

.course-tip {
  margin-top: 14px;
}
.tip-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 6px;
}
.tip-head h3 {
  font-size: var(--fs-base);
}
.course-tip p {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-soft);
  line-height: 1.75;
}
.course-tip .disclaimer {
  margin-top: 6px;
  font-size: var(--fs-xs);
  color: var(--text-mute);
}

.workflow {
  margin-top: 20px;
}
.workflow h2 {
  font-size: var(--fs-lg);
  margin-bottom: 10px;
}
.workflow ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  counter-reset: step;
}
.workflow li {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
}
.step {
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}
.workflow strong {
  font-size: 12.5px;
}
.workflow p {
  margin: 3px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-mute);
}

@media (max-width: 1000px) {
  .hero-card {
    display: none;
  }
  .columns {
    grid-template-columns: 1fr;
  }
  .workflow ol {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 20px 18px;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .workflow ol {
    grid-template-columns: 1fr;
  }
}
</style>
