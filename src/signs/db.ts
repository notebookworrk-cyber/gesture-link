import type { SignLabel, SignModel, SignSample, Transcript } from './types'

const DB_NAME = 'gesturelink.signs'
const DB_VERSION = 1
const LABELS = 'labels'
const SAMPLES = 'samples'
const MODELS = 'models'
const TRANSCRIPTS = 'transcripts'

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
      if (!db.objectStoreNames.contains(LABELS)) {
        const store = db.createObjectStore(LABELS, { keyPath: 'id' })
        store.createIndex('category', 'category')
      }
      if (!db.objectStoreNames.contains(SAMPLES)) {
        const store = db.createObjectStore(SAMPLES, { keyPath: 'id' })
        store.createIndex('labelId', 'labelId')
        store.createIndex('group', 'group')
      }
      if (!db.objectStoreNames.contains(MODELS)) {
        db.createObjectStore(MODELS, { keyPath: 'version' })
      }
      if (!db.objectStoreNames.contains(TRANSCRIPTS)) {
        const store = db.createObjectStore(TRANSCRIPTS, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the sign database.'))
    request.onblocked = () => reject(new Error('The sign database is blocked by another tab.'))
  })
  database.catch(() => {
    database = null
  })
  return database
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const request = work(transaction.objectStore(storeName))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Sign storage failed.'))
      }),
  )
}

export async function listLabels(): Promise<SignLabel[]> {
  const labels = await run<SignLabel[]>(LABELS, 'readonly', (store) => store.getAll() as IDBRequest<SignLabel[]>)
  return labels.sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveLabel(label: SignLabel): Promise<void> {
  await run(LABELS, 'readwrite', (store) => store.put(label) as IDBRequest<IDBValidKey>)
}

export async function deleteLabel(id: string): Promise<void> {
  await run(LABELS, 'readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>)
}

export async function listSamples(): Promise<SignSample[]> {
  const samples = await run<SignSample[]>(SAMPLES, 'readonly', (store) => store.getAll() as IDBRequest<SignSample[]>)
  return samples.sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveSamples(samples: SignSample[]): Promise<void> {
  await openDatabase().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SAMPLES, 'readwrite')
        const store = transaction.objectStore(SAMPLES)
        for (const sample of samples) store.put(sample)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('The samples could not be saved.'))
      }),
  )
}

export async function deleteSamples(ids: string[]): Promise<void> {
  await openDatabase().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SAMPLES, 'readwrite')
        const store = transaction.objectStore(SAMPLES)
        for (const id of ids) store.delete(id)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('The samples could not be deleted.'))
      }),
  )
}

export async function clearSamples(): Promise<void> {
  await run(SAMPLES, 'readwrite', (store) => store.clear() as unknown as IDBRequest<undefined>)
}

export async function loadModel(): Promise<SignModel | null> {
  const models = await run<SignModel[]>(MODELS, 'readonly', (store) => store.getAll() as IDBRequest<SignModel[]>)
  if (models.length === 0) return null
  return models.sort((a, b) => b.trainedAt - a.trainedAt)[0] ?? null
}

export async function saveModel(model: SignModel): Promise<void> {
  await run(MODELS, 'readwrite', (store) => store.put(model) as IDBRequest<IDBValidKey>)
}

export async function deleteModel(version: number): Promise<void> {
  await run(MODELS, 'readwrite', (store) => store.delete(version) as unknown as IDBRequest<undefined>)
}

export async function listTranscripts(): Promise<Transcript[]> {
  const transcripts = await run<Transcript[]>(
    TRANSCRIPTS,
    'readonly',
    (store) => store.getAll() as IDBRequest<Transcript[]>,
  )
  return transcripts.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveTranscript(transcript: Transcript): Promise<void> {
  await run(TRANSCRIPTS, 'readwrite', (store) => store.put(transcript) as IDBRequest<IDBValidKey>)
}

export async function deleteTranscript(id: string): Promise<void> {
  await run(TRANSCRIPTS, 'readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>)
}

/** Test helper: drops the cached connection so a new database can be opened. */
export function resetSignDatabaseForTests(): void {
  database = null
}
