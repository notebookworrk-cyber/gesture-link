import { create } from 'zustand'
import { clearPhotos, deletePhoto, listPhotos, savePhoto } from './db'
import type { PhotoRecord, PhotoStoreStatus } from './types'

export interface PhotoState {
  photos: PhotoRecord[]
  status: PhotoStoreStatus
  error: string | null
  ready: boolean
  init: () => Promise<void>
  add: (photo: PhotoRecord) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
}

let initPromise: Promise<void> | null = null

export const usePhotos = create<PhotoState>()((set, get) => ({
  photos: [],
  status: 'idle',
  error: null,
  ready: false,

  init: async () => {
    if (get().ready) return
    if (initPromise) return initPromise
    initPromise = (async () => {
      set({ status: 'loading', error: null })
      try {
        const photos = (await listPhotos()).sort((a, b) => b.createdAt - a.createdAt)
        set({ photos, status: 'ready', ready: true, error: null })
      } catch (error) {
        set({
          photos: [],
          status: 'error',
          ready: true,
          error:
            error instanceof Error
              ? error.message
              : 'The photo database could not be opened in this browser.',
        })
      }
    })()
    return initPromise
  },

  add: async (photo) => {
    try {
      await savePhoto(photo)
      set({ photos: [photo, ...get().photos], status: 'ready', error: null })
    } catch (error) {
      set({
        status: 'error',
        error:
          error instanceof Error ? error.message : 'The photograph could not be saved.',
      })
      throw error
    }
  },

  rename: async (id, name) => {
    const photo = get().photos.find((item) => item.id === id)
    if (!photo) return
    const next = { ...photo, name: name.trim() || photo.name }
    try {
      await savePhoto(next)
      set({
        photos: get().photos.map((item) => (item.id === id ? next : item)),
        error: null,
      })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'The photograph could not be renamed.',
      })
    }
  },

  remove: async (id) => {
    const previous = get().photos
    set({ photos: previous.filter((item) => item.id !== id) })
    try {
      await deletePhoto(id)
      set({ error: null })
    } catch (error) {
      set({
        photos: previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'The photograph could not be deleted.',
      })
    }
  },

  clear: async () => {
    const previous = get().photos
    set({ photos: [] })
    try {
      await clearPhotos()
      set({ error: null })
    } catch (error) {
      set({
        photos: previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'The photos could not be cleared.',
      })
    }
  },
}))

/** Test helper: resets the module state between test files. */
export function resetPhotosForTests(): void {
  initPromise = null
  usePhotos.setState({ photos: [], status: 'idle', error: null, ready: false })
}
