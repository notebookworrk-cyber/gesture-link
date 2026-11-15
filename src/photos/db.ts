import type { PhotoRecord } from './types'

const DB_NAME = 'gesturelink.photos'
const DB_VERSION = 1
const STORE = 'photos'

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
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the photo database.'))
    request.onblocked = () => reject(new Error('The photo database is blocked by another tab.'))
  })
  // A failed open must not be cached, otherwise the page can never recover.
  database.catch(() => {
    database = null
  })
  return database
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = work(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Photo storage failed.'))
      }),
  )
}

export async function listPhotos(): Promise<PhotoRecord[]> {
  const records = await run<PhotoRecord[]>('readonly', (store) => store.getAll() as IDBRequest<PhotoRecord[]>)
  return records.sort((a, b) => b.createdAt - a.createdAt)
}

export async function savePhoto(photo: PhotoRecord): Promise<void> {
  await run('readwrite', (store) => store.put(photo) as IDBRequest<IDBValidKey>)
}

export async function deletePhoto(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>)
}

export async function clearPhotos(): Promise<void> {
  await run('readwrite', (store) => store.clear() as unknown as IDBRequest<undefined>)
}

/** Test helper: drops the cached connection so a new database can be opened. */
export function resetPhotoDatabaseForTests(): void {
  database = null
}
