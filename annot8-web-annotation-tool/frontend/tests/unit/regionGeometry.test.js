import { describe, expect, it } from 'vitest'
import {
  clampPolygonToBounds,
  clampRectangleToBounds,
  createPolygonRegion,
  createPolylineRegion,
  createRectangleRegion,
  flattenPoints,
  getRectangleHeight,
  getRectangleWidth,
  isDrawableRegion,
  normalizeRectangleEdges,
  toDocumentPoints,
  toDocumentRectangle,
  toKonvaRectangle,
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
      left: 200,
      top: 100,
      right: 500,
      bottom: 300,
      color: '#0d6efd',
      annotations: [],
    })
  })

  it('creates rectangle edge coordinates regardless of drag direction', () => {
    expect(
      createRectangleRegion({
        id: 'region-1',
        pageIndex: 0,
        start: { x: 100, y: 50 },
        end: { x: 250, y: 150 },
      })
    ).toEqual(
      expect.objectContaining({
        left: 100,
        top: 50,
        right: 250,
        bottom: 150,
      })
    )

    expect(
      createRectangleRegion({
        id: 'region-2',
        pageIndex: 0,
        start: { x: 250, y: 150 },
        end: { x: 100, y: 50 },
      })
    ).toEqual(
      expect.objectContaining({
        left: 100,
        top: 50,
        right: 250,
        bottom: 150,
      })
    )
  })

  it('normalizes rectangle edge coordinates', () => {
    expect(
      normalizeRectangleEdges({
        left: 500,
        top: 300,
        right: 200,
        bottom: 100,
      })
    ).toEqual({
      left: 200,
      top: 100,
      right: 500,
      bottom: 300,
    })
  })

  it('computes rectangle width and height from edge coordinates', () => {
    const rectangle = {
      left: 200,
      top: 100,
      right: 500,
      bottom: 300,
    }

    expect(getRectangleWidth(rectangle)).toBe(300)
    expect(getRectangleHeight(rectangle)).toBe(200)
  })

  it('converts edge rectangle coordinates to Konva geometry', () => {
    expect(
      toKonvaRectangle({
        left: 200,
        top: 100,
        right: 500,
        bottom: 300,
      })
    ).toEqual({
      x: 200,
      y: 100,
      width: 300,
      height: 200,
    })
  })

  it('detects whether a rectangle is large enough to keep', () => {
    expect(isDrawableRegion({ left: 10, top: 20, right: 14, bottom: 24 })).toBe(true)
    expect(isDrawableRegion({ left: 10, top: 20, right: 13, bottom: 24 })).toBe(false)
    expect(isDrawableRegion({ left: 10, top: 20, right: 14, bottom: 23 })).toBe(false)
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
        { left: -20, top: 950, right: 280, bottom: 1150 },
        { width: 2000, height: 1000 }
      )
    ).toEqual({
      left: 0,
      top: 800,
      right: 300,
      bottom: 1000,
    })
  })

  it('clamps oversized rectangles to the document size', () => {
    expect(
      clampRectangleToBounds(
        { left: 100, top: 100, right: 2600, bottom: 1300 },
        { width: 2000, height: 1000 }
      )
    ).toEqual({
      left: 0,
      top: 0,
      right: 2000,
      bottom: 1000,
    })
  })

  it('converts document rectangle edges to visible canvas geometry', () => {
    expect(
      toVisibleRectangle(
        { left: 200, top: 100, right: 500, bottom: 300 },
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

  it('converts visible canvas geometry back to document rectangle edges', () => {
    expect(
      toDocumentRectangle(
        { x: 125, y: 62.5, width: 187.5, height: 125 },
        0.5,
        0.5,
        1.25
      )
    ).toEqual({
      left: 200,
      top: 100,
      right: 500,
      bottom: 300,
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
