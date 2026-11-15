import { describe, expect, it } from 'vitest'
import { STICKERS, anchorFromFace } from '@/photos/stickers'
import { toReading } from '@/vision/faceTracker'
import type { FaceReading, Landmark } from '@/vision/types'

function makeFace(): FaceReading {
  const points: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  points[263] = { x: 0.42, y: 0.45, z: 0 }
  points[33] = { x: 0.58, y: 0.47, z: 0 }
  points[10] = { x: 0.5, y: 0.32, z: 0 }
  points[1] = { x: 0.5, y: 0.48, z: 0 }
  points[61] = { x: 0.47, y: 0.58, z: 0 }
  points[291] = { x: 0.53, y: 0.58, z: 0 }
  points[454] = { x: 0.38, y: 0.52, z: 0 }
  points[234] = { x: 0.62, y: 0.52, z: 0 }
  return {
    landmarks: points,
    box: { x: 0.38, y: 0.32, width: 0.24, height: 0.3 },
    roll: 0,
  }
}

describe('sticker anchors', () => {
  it('ships glasses, hats, crowns and decorative stickers', () => {
    expect(STICKERS.map((sticker) => sticker.id)).toEqual([
      'glasses',
      'hat',
      'crown',
      'ears',
      'mustache',
      'sparkles',
    ])
  })

  it('returns null without a face', () => {
    expect(anchorFromFace(null)).toBeNull()
  })

  it('returns null when the reading has too few landmarks', () => {
    expect(anchorFromFace({ landmarks: [], box: { x: 0, y: 0, width: 1, height: 1 }, roll: 0 })).toBeNull()
  })

  it('reads the eye, forehead, nose and mouth anchors', () => {
    const anchor = anchorFromFace(makeFace())
    expect(anchor).not.toBeNull()
    expect(anchor!.nose.x).toBeCloseTo(0.5)
    expect(anchor!.forehead.y).toBeCloseTo(0.32)
    expect(anchor!.mouth.x).toBeCloseTo(0.5)
    expect(anchor!.leftEye.x).toBeCloseTo(0.42)
    expect(anchor!.rightEye.x).toBeCloseTo(0.58)
  })

  it('uses the face width as the sticker unit', () => {
    const anchor = anchorFromFace(makeFace())
    expect(anchor!.size).toBeCloseTo(0.24)
  })

  it('derives the head roll from the eye line', () => {
    const face = makeFace()
    face.landmarks[263] = { x: 0.42, y: 0.4, z: 0 }
    face.landmarks[33] = { x: 0.58, y: 0.5, z: 0 }
    const reading = toReading(face.landmarks)
    expect(reading.roll).toBeLessThan(0)
  })

  it('carries the roll of the reading into the anchors', () => {
    const face = makeFace()
    face.roll = 0.25
    expect(anchorFromFace(face)!.roll).toBeCloseTo(0.25)
  })
})
