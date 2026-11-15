import type { Board } from './types'

const DB_NAME = 'gesturelink.whiteboards'
const DB_VERSION = 1
const STORE = 'boards'

let database: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database
  database = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the board database.'))
    request.onblocked = () => reject(new Error('The board database is blocked by another tab.'))
  })
  // A failed open should be retried next time instead of caching the failure.
  database.catch(() => {
    database = null
  })
  return database
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The storage request failed.'))
  })
}

export async function loadBoards(): Promise<Board[]> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE, 'readonly')
  const boards = await wrap(transaction.objectStore(STORE).getAll() as IDBRequest<Board[]>)
  return boards.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveBoard(board: Board): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE, 'readwrite')
  await wrap(transaction.objectStore(STORE).put(board))
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The save did not complete.'))
  })
}

export async function deleteBoard(id: string): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE, 'readwrite')
  await wrap(transaction.objectStore(STORE).delete(id))
}

export async function isStorageAvailable(): Promise<boolean> {
  try {
    await openDatabase()
    return true
  } catch {
    return false
  }
}
