import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  photos: [] as unknown[],
  listPhotos: vi.fn(async () => [] as unknown[]),
  savePhoto: vi.fn(async () => undefined),
  deletePhoto: vi.fn(async () => undefined),
  clearPhotos: vi.fn(async () => undefined),
}))

vi.mock('@/photos/db', () => ({
  listPhotos: db.listPhotos,
  savePhoto: db.savePhoto,
  deletePhoto: db.deletePhoto,
  clearPhotos: db.clearPhotos,
  resetPhotoDatabaseForTests: () => undefined,
}))

import { resetPhotosForTests, usePhotos } from '@/photos/store'
import type { PhotoRecord } from '@/photos/types'

function makePhoto(id: string, createdAt: number): PhotoRecord {
  return {
    id,
    name: `Photo ${id}`,
    createdAt,
    width: 640,
    height: 480,
    filter: 'natural',
    filterStrength: 0.8,
    stickers: [],
    blob: new Blob(['x']),
    thumb: new Blob(['y']),
  }
}

describe('photo store', () => {
  beforeEach(() => {
    resetPhotosForTests()
    db.listPhotos.mockReset()
    db.savePhoto.mockReset()
    db.deletePhoto.mockReset()
    db.clearPhotos.mockReset()
    db.listPhotos.mockResolvedValue([])
  })

  it('loads the stored photographs', async () => {
    db.listPhotos.mockResolvedValue([makePhoto('a', 2), makePhoto('b', 5)])
    await usePhotos.getState().init()
    const state = usePhotos.getState()
    expect(state.status).toBe('ready')
    expect(state.photos.map((photo) => photo.id)).toEqual(['b', 'a'])
  })

  it('reports a storage failure instead of throwing', async () => {
    db.listPhotos.mockRejectedValue(new Error('no database'))
    await usePhotos.getState().init()
    const state = usePhotos.getState()
    expect(state.status).toBe('error')
    expect(state.error).toContain('no database')
  })

  it('adds a photograph at the front of the list', async () => {
    await usePhotos.getState().init()
    await usePhotos.getState().add(makePhoto('new', 9))
    expect(usePhotos.getState().photos.map((photo) => photo.id)).toEqual(['new'])
    expect(db.savePhoto).toHaveBeenCalledTimes(1)
  })

  it('renames a photograph without touching the others', async () => {
    db.listPhotos.mockResolvedValue([makePhoto('a', 2), makePhoto('b', 5)])
    await usePhotos.getState().init()
    await usePhotos.getState().rename('a', '  Holiday  ')
    const photos = usePhotos.getState().photos
    expect(photos.find((photo) => photo.id === 'a')?.name).toBe('Holiday')
    expect(photos.find((photo) => photo.id === 'b')?.name).toBe('Photo b')
  })

  it('keeps the old name when a rename is empty', async () => {
    db.listPhotos.mockResolvedValue([makePhoto('a', 2)])
    await usePhotos.getState().init()
    await usePhotos.getState().rename('a', '   ')
    expect(usePhotos.getState().photos[0]?.name).toBe('Photo a')
  })

  it('removes a photograph from the list and the database', async () => {
    db.listPhotos.mockResolvedValue([makePhoto('a', 2), makePhoto('b', 5)])
    await usePhotos.getState().init()
    await usePhotos.getState().remove('a')
    expect(usePhotos.getState().photos.map((photo) => photo.id)).toEqual(['b'])
    expect(db.deletePhoto).toHaveBeenCalledWith('a')
  })

  it('restores the list when the delete fails', async () => {
    db.listPhotos.mockResolvedValue([makePhoto('a', 2)])
    db.deletePhoto.mockRejectedValue(new Error('locked'))
    await usePhotos.getState().init()
    await usePhotos.getState().remove('a')
    expect(usePhotos.getState().photos).toHaveLength(1)
    expect(usePhotos.getState().status).toBe('error')
  })
})
