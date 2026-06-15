import { describe, expect, it } from 'vitest'
import {
  getClosestPointRegionSegmentIndex,
  getPointToSegmentDistance,
} from '../../src/components/viewer/pointRegionCanvasGeometry'

describe('pointRegionCanvasGeometry', () => {
  it('calculates the distance from a point to a segment', () => {
    expect(getPointToSegmentDistance(
      { x: 5, y: 3 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    )).toBe(3)
  })

  it('calculates the distance to a zero-length segment', () => {
    expect(getPointToSegmentDistance(
      { x: 3, y: 4 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    )).toBe(5)
  })

  it('finds the closest segment index for an open polyline', () => {
    expect(getClosestPointRegionSegmentIndex(
      { x: 10, y: 5 },
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
      4
    )).toBe(1)
  })

  it('finds the closing segment index for a closed polygon', () => {
    expect(getClosestPointRegionSegmentIndex(
      { x: 1, y: 1 },
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      true,
      4
    )).toBe(2)
  })

  it('returns -1 when the pointer is outside the hit tolerance', () => {
    expect(getClosestPointRegionSegmentIndex(
      { x: 20, y: 20 },
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      false,
      2
    )).toBe(-1)
  })
})
