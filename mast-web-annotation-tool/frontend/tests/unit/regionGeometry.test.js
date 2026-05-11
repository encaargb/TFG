import { describe, expect, it } from 'vitest'
import {
  clampRectangleToBounds,
  createRectangleRegion,
  isDrawableRegion,
  toDocumentRectangle,
  toVisibleRectangle,
} from '../../src/utils/regionGeometry'

describe('regionGeometry', () => {
  it('creates a normalized rectangle region from two document points', () => {
    expect(
      createRectangleRegion({
        id: 'region-1',
        pageIndex: 2,
        start: { x: 500, y: 300 },
        end: { x: 200, y: 100 },
      })
    ).toEqual({
      id: 'region-1',
      pageIndex: 2,
      type: 'rectangle',
      x: 200,
      y: 100,
      width: 300,
      height: 200,
      color: '#0d6efd',
      annotations: [],
    })
  })

  it('detects whether a rectangle is large enough to keep', () => {
    expect(isDrawableRegion({ width: 4, height: 4 })).toBe(true)
    expect(isDrawableRegion({ width: 3, height: 10 })).toBe(false)
    expect(isDrawableRegion({ width: 10, height: 3 })).toBe(false)
  })

  it('clamps a rectangle so it stays inside document bounds', () => {
    expect(
      clampRectangleToBounds(
        { x: -20, y: 950, width: 300, height: 200 },
        { width: 2000, height: 1000 }
      )
    ).toEqual({
      x: 0,
      y: 800,
      width: 300,
      height: 200,
    })
  })

  it('clamps oversized rectangles to the document size', () => {
    expect(
      clampRectangleToBounds(
        { x: 100, y: 100, width: 2500, height: 1200 },
        { width: 2000, height: 1000 }
      )
    ).toEqual({
      x: 0,
      y: 0,
      width: 2000,
      height: 1000,
    })
  })

  it('converts document region coordinates to visible canvas coordinates', () => {
    expect(
      toVisibleRectangle(
        { x: 200, y: 100, width: 300, height: 200 },
        0.5,
        0.5,
        1.25
      )
    ).toEqual({
      x: 125,
      y: 62.5,
      width: 187.5,
      height: 125,
    })
  })

  it('converts visible canvas coordinates back to document coordinates', () => {
    expect(
      toDocumentRectangle(
        { x: 125, y: 62.5, width: 187.5, height: 125 },
        0.5,
        0.5,
        1.25
      )
    ).toEqual({
      x: 200,
      y: 100,
      width: 300,
      height: 200,
    })
  })
})
