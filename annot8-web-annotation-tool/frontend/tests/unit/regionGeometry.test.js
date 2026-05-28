import { describe, expect, it } from 'vitest'
import {
  clampPolygonToBounds,
  clampRectangleToBounds,
  createPolygonRegion,
  createPolylineRegion,
  createRectangleRegion,
  flattenPoints,
  isDrawableRegion,
  toDocumentPoints,
  toDocumentRectangle,
  toVisiblePoints,
  toVisibleRectangle,
  unflattenPoints,
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

  it('creates a polygon region from document points', () => {
    expect(
      createPolygonRegion({
        id: 'region-2',
        pageIndex: 1,
        points: [
          { x: 10.2, y: 20.8 },
          { x: 100.4, y: 30.3 },
          { x: 50.5, y: 80.1 },
        ],
      })
    ).toEqual({
      id: 'region-2',
      pageIndex: 1,
      type: 'polygon',
      points: [
        { x: 10, y: 21 },
        { x: 100, y: 30 },
        { x: 51, y: 80 },
      ],
      color: '#0d6efd',
      annotations: [],
    })
  })

  it('detects whether a polygon has enough vertices to keep', () => {
    expect(isDrawableRegion({ type: 'polygon', points: [{}, {}, {}] })).toBe(true)
    expect(isDrawableRegion({ type: 'polygon', points: [{}, {}] })).toBe(false)
  })

  it('creates a polyline region from document points', () => {
    expect(
      createPolylineRegion({
        id: 'region-3',
        pageIndex: 2,
        points: [
          { x: 10.2, y: 20.8 },
          { x: 100.4, y: 30.3 },
        ],
      })
    ).toEqual({
      id: 'region-3',
      pageIndex: 2,
      type: 'polyline',
      points: [
        { x: 10, y: 21 },
        { x: 100, y: 30 },
      ],
      color: '#0d6efd',
      annotations: [],
    })
  })

  it('detects whether a polyline has enough vertices to keep', () => {
    expect(isDrawableRegion({ type: 'polyline', points: [{}, {}] })).toBe(true)
    expect(isDrawableRegion({ type: 'polyline', points: [{}] })).toBe(false)
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

  it('clamps polygon points to document bounds', () => {
    expect(
      clampPolygonToBounds(
        {
          points: [
            { x: -10, y: 20 },
            { x: 2100, y: 40 },
            { x: 50, y: 1200 },
          ],
        },
        { width: 2000, height: 1000 }
      )
    ).toEqual({
      points: [
        { x: 0, y: 20 },
        { x: 2000, y: 40 },
        { x: 50, y: 1000 },
      ],
    })
  })

  it('converts polygon points between document and visible coordinates', () => {
    const visiblePoints = toVisiblePoints(
      [
        { x: 200, y: 100 },
        { x: 400, y: 200 },
      ],
      0.5,
      0.5,
      1.25
    )

    expect(visiblePoints).toEqual([
      { x: 125, y: 62.5 },
      { x: 250, y: 125 },
    ])
    expect(toDocumentPoints(visiblePoints, 0.5, 0.5, 1.25)).toEqual([
      { x: 200, y: 100 },
      { x: 400, y: 200 },
    ])
  })

  it('flattens and unflattens polygon points for Konva', () => {
    const points = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]

    expect(flattenPoints(points)).toEqual([10, 20, 30, 40])
    expect(unflattenPoints([10, 20, 30, 40])).toEqual(points)
  })
})
