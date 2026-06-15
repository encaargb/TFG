import { describe, expect, it } from 'vitest'
import {
  getPointRegionMinimumPointCount,
  hasValidVisiblePointRegionSegments,
} from '../../src/utils/pointRegionValidation'

describe('pointRegionValidation', () => {
  it('requires at least two points for polylines', () => {
    expect(getPointRegionMinimumPointCount('polyline')).toBe(2)
    expect(hasValidVisiblePointRegionSegments([{ x: 0, y: 0 }], 'polyline')).toBe(false)
  })

  it('requires at least three points for polygons', () => {
    expect(getPointRegionMinimumPointCount('polygon')).toBe(3)
    expect(hasValidVisiblePointRegionSegments([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ], 'polygon')).toBe(false)
  })

  it('rejects polyline segments shorter than the minimum visible length', () => {
    expect(hasValidVisiblePointRegionSegments([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ], 'polyline')).toBe(false)
  })

  it('rejects polygon segments shorter than the minimum visible length', () => {
    expect(hasValidVisiblePointRegionSegments([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 8, y: 8 },
    ], 'polygon')).toBe(false)
  })

  it('validates the polygon closing segment', () => {
    expect(hasValidVisiblePointRegionSegments([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 3, y: 0 },
    ], 'polygon')).toBe(false)
  })

  it('accepts valid polygon and polyline segments', () => {
    expect(hasValidVisiblePointRegionSegments([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
    ], 'polyline')).toBe(true)
    expect(hasValidVisiblePointRegionSegments([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ], 'polygon')).toBe(true)
  })
})
