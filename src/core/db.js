import { openDB } from 'idb'

const DB_NAME = 'scut-math-study'
const DB_VERSION = 1

export const STORE_NAMES = [
  'docs',
  'docTexts',
  'files',
  'chunks',
  'chats',
  'messages',
  'quizzes',
  'wrongbook',
]

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('docs')) {
          const store = db.createObjectStore('docs', { keyPath: 'id' })
          store.createIndex('byCourse', 'course')
          store.createIndex('byCreated', 'createdAt')
        }
        if (!db.objectStoreNames.contains('docTexts')) {
          db.createObjectStore('docTexts', { keyPath: 'docId' })
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'docId' })
        }
        if (!db.objectStoreNames.contains('chunks')) {
          const store = db.createObjectStore('chunks', { keyPath: 'id' })
          store.createIndex('byDoc', 'docId')
          store.createIndex('byDocIndex', ['docId', 'index'])
        }
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' })
          store.createIndex('byUpdated', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' })
          store.createIndex('byChat', 'chatId')
        }
        if (!db.objectStoreNames.contains('quizzes')) {
          const store = db.createObjectStore('quizzes', { keyPath: 'id' })
          store.createIndex('byCreated', 'createdAt')
        }
        if (!db.objectStoreNames.contains('wrongbook')) {
          const store = db.createObjectStore('wrongbook', { keyPath: 'id' })
          store.createIndex('byCreated', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

function newId(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}_${rand}`
}

export { newId }

/* ---------------- 资料 ---------------- */

export async function listDocs() {
  const db = await getDB()
  const docs = await db.getAll('docs')
  return docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function putDoc(doc) {
  const db = await getDB()
  await db.put('docs', doc)
  return doc
}

export async function getDoc(id) {
  const db = await getDB()
  return db.get('docs', id)
}

export async function putDocText(docId, text) {
  const db = await getDB()
  await db.put('docTexts', { docId, text })
}

export async function getDocText(docId) {
  const db = await getDB()
  const row = await db.get('docTexts', docId)
  return row?.text || ''
}

export async function putFileBlob(docId, blob, meta = {}) {
  const db = await getDB()
  await db.put('files', { docId, blob, ...meta })
}

export async function getFileBlob(docId) {
  const db = await getDB()
  const row = await db.get('files', docId)
  return row || null
}

export async function deleteDocCascade(docId) {
  const db = await getDB()
  const tx = db.transaction(['docs', 'docTexts', 'files', 'chunks'], 'readwrite')
  await tx.objectStore('docs').delete(docId)
  await tx.objectStore('docTexts').delete(docId)
  await tx.objectStore('files').delete(docId)
  const index = tx.objectStore('chunks').index('byDoc')
  let cursor = await index.openCursor(docId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

/* ---------------- 分块 ---------------- */

export async function putChunks(docId, chunks) {
  const db = await getDB()
  const tx = db.transaction('chunks', 'readwrite')
  const store = tx.objectStore('chunks')
  const index = store.index('byDoc')
  let cursor = await index.openCursor(docId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const chunk of chunks) {
    await store.put({ ...chunk, docId, id: `${docId}:${chunk.index}` })
  }
  await tx.done
}

export async function getAllChunks() {
  const db = await getDB()
  return db.getAll('chunks')
}

export async function getChunksByDoc(docId) {
  const db = await getDB()
  return db.getAllFromIndex('chunks', 'byDoc', docId)
}

/* ---------------- 会话 ---------------- */

export async function listChats() {
  const db = await getDB()
  const chats = await db.getAll('chats')
  return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function putChat(chat) {
  const db = await getDB()
  await db.put('chats', chat)
  return chat
}

export async function getChat(id) {
  const db = await getDB()
  return db.get('chats', id)
}

export async function deleteChatCascade(chatId) {
  const db = await getDB()
  const tx = db.transaction(['chats', 'messages'], 'readwrite')
  await tx.objectStore('chats').delete(chatId)
  const index = tx.objectStore('messages').index('byChat')
  let cursor = await index.openCursor(chatId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function getMessages(chatId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('messages', 'byChat', chatId)
  return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

export async function putMessage(message) {
  const db = await getDB()
  await db.put('messages', message)
  return message
}

export async function deleteMessage(id) {
  const db = await getDB()
  await db.delete('messages', id)
}

/* ---------------- 试卷 ---------------- */

export async function listQuizzes() {
  const db = await getDB()
  const rows = await db.getAll('quizzes')
  return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function putQuiz(quiz) {
  const db = await getDB()
  await db.put('quizzes', quiz)
  return quiz
}

export async function getQuiz(id) {
  const db = await getDB()
  return db.get('quizzes', id)
}

export async function deleteQuiz(id) {
  const db = await getDB()
  await db.delete('quizzes', id)
}

/* ---------------- 错题本 ---------------- */

export async function listWrongbook() {
  const db = await getDB()
  const rows = await db.getAll('wrongbook')
  return rows.sort((a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0))
}

export async function putWrongItem(item) {
  const db = await getDB()
  await db.put('wrongbook', item)
  return item
}

export async function deleteWrongItem(id) {
  const db = await getDB()
  await db.delete('wrongbook', id)
}

/* ---------------- 导入导出 ---------------- */

export async function exportAll() {
  const db = await getDB()
  const data = {}
  for (const name of STORE_NAMES) {
    data[name] = await db.getAll(name)
  }
  return {
    app: 'scut-math-study',
    schemaVersion: DB_VERSION,
    exportedAt: Date.now(),
    data,
  }
}

export async function importAll(payload) {
  if (!payload || payload.app !== 'scut-math-study' || !payload.data) {
    throw new Error('这不是本应用导出的数据文件。')
  }
  const db = await getDB()
  const names = STORE_NAMES.filter((name) => Array.isArray(payload.data[name]))
  for (const name of names) {
    const tx = db.transaction(name, 'readwrite')
    await tx.objectStore(name).clear()
    for (const row of payload.data[name]) {
      await tx.objectStore(name).put(row)
    }
    await tx.done
  }
  return names.reduce((acc, name) => acc + payload.data[name].length, 0)
}

export async function clearAllData() {
  const db = await getDB()
  for (const name of STORE_NAMES) {
    const tx = db.transaction(name, 'readwrite')
    await tx.objectStore(name).clear()
    await tx.done
  }
}

export async function storageUsage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}
