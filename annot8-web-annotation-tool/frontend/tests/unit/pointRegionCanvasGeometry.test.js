import { describe, expect, it } from 'vitest'
import {
  clampVisiblePointRegionDelta,
  getClosestPointRegionSegmentIndex,
  getPointToSegmentDistance,
  getVisiblePointRegionBounds,
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

  it('calculates visible bounds from point-region points', () => {
    expect(getVisiblePointRegionBounds([
      { x: 20, y: 30 },
      { x: 5, y: 40 },
      { x: 15, y: 10 },
    ])).toEqual({
      minX: 5,
      minY: 10,
      maxX: 20,
      maxY: 40,
    })
  })

  it('clamps a positive drag delta so the point region stays inside bounds', () => {
    expect(clampVisiblePointRegionDelta(
      [
        { x: 80, y: 70 },
        { x: 95, y: 90 },
      ],
      { x: 20, y: 20 },
      { width: 100, height: 100 }
    )).toEqual({ x: 5, y: 10 })
  })

  it('clamps a negative drag delta so the point region stays inside bounds', () => {
    expect(clampVisiblePointRegionDelta(
      [
        { x: 5, y: 8 },
        { x: 20, y: 30 },
      ],
      { x: -20, y: -20 },
      { width: 100, height: 100 }
    )).toEqual({ x: -5, y: -8 })
  })

  it('allows a valid drag delta that keeps the point region inside bounds', () => {
    expect(clampVisiblePointRegionDelta(
      [
        { x: 20, y: 20 },
        { x: 40, y: 40 },
      ],
      { x: 10, y: -10 },
      { width: 100, height: 100 }
    )).toEqual({ x: 10, y: -10 })
  })
})
