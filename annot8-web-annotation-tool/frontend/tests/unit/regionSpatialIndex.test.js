import { describe, expect, it } from 'vitest'
import { createRegionSpatialIndex } from '../../src/utils/regionSpatialIndex'

const documentBounds = {
  width: 1000,
  height: 800,
}

function rectangleRegion(overrides = {}) {
  return {
    id: 'rectangle-1',
    type: 'rectangle',
    left: 100,
    top: 100,
    right: 200,
    bottom: 200,
    ...overrides,
  }
}

function polygonRegion(overrides = {}) {
  return {
    id: 'polygon-1',
    type: 'polygon',
    points: [
      { x: 300, y: 100 },
      { x: 400, y: 150 },
      { x: 350, y: 220 },
    ],
    ...overrides,
  }
}

function polylineRegion(overrides = {}) {
  return {
    id: 'polyline-1',
    type: 'polyline',
    points: [
      { x: 500, y: 300 },
      { x: 620, y: 300 },
      { x: 620, y: 360 },
    ],
    ...overrides,
  }
}

function queryAround(bounds) {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }
}

describe('regionSpatialIndex', () => {
  it('returns no candidates before the index is built', () => {
    const spatialIndex = createRegionSpatialIndex()

    expect(spatialIndex.query({ x: 100, y: 100, width: 10, height: 10 })).toEqual([])
  })

  it('builds with valid document bounds and returns rectangle candidates', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [rectangleRegion()])

    expect(new Set(spatialIndex.query({ x: 100, y: 100, width: 20, height: 20 })))
      .toEqual(new Set(['rectangle-1']))
  })

  it('indexes polygon and polyline bounding boxes', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [polygonRegion(), polylineRegion()])

    expect(new Set(spatialIndex.query({ x: 320, y: 120, width: 10, height: 10 })))
      .toContain('polygon-1')
    expect(new Set(spatialIndex.query({ x: 560, y: 300, width: 10, height: 10 })))
      .toContain('polyline-1')
  })

  it('rebuilding removes stale region candidates', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [rectangleRegion({ id: 'old-region' })])
    spatialIndex.rebuild(documentBounds, [rectangleRegion({ id: 'new-region' })])

    const candidates = new Set(spatialIndex.query({ x: 100, y: 100, width: 20, height: 20 }))

    expect(candidates.has('old-region')).toBe(false)
    expect(candidates.has('new-region')).toBe(true)
  })

  it('clearing removes all candidates', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [rectangleRegion()])
    spatialIndex.clear()

    expect(spatialIndex.query({ x: 100, y: 100, width: 20, height: 20 })).toEqual([])
  })

  it('skips malformed regions safely', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [
      { id: 'bad-polygon', type: 'polygon', points: [{ x: 'bad', y: 10 }] },
      { type: 'rectangle', left: 10, top: 10, right: 30, bottom: 30 },
      null,
    ])

    expect(spatialIndex.query({ x: 0, y: 0, width: 1000, height: 800 })).toEqual([])
  })

  it('leaves the index empty when document bounds are invalid', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild({ width: 0, height: 800 }, [rectangleRegion()])

    expect(spatialIndex.query({ x: 100, y: 100, width: 20, height: 20 })).toEqual([])
  })

  it('returns an empty array for invalid query bounds', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [rectangleRegion()])

    expect(spatialIndex.query({ x: 100, y: 100, width: -1, height: 20 })).toEqual([])
    expect(spatialIndex.query({ x: Number.NaN, y: 100, width: 10, height: 20 })).toEqual([])
  })

  it('supports vertical and horizontal point-region bounds', () => {
    const spatialIndex = createRegionSpatialIndex()

    spatialIndex.rebuild(documentBounds, [
      polylineRegion({
        id: 'vertical',
        points: [
          { x: 700, y: 100 },
          { x: 700, y: 220 },
        ],
      }),
      polylineRegion({
        id: 'horizontal',
        points: [
          { x: 100, y: 500 },
          { x: 240, y: 500 },
        ],
      }),
    ])

    expect(new Set(spatialIndex.query({ x: 700, y: 150, width: 0, height: 0 })))
      .toContain('vertical')
    expect(new Set(spatialIndex.query({ x: 180, y: 500, width: 0, height: 0 })))
      .toContain('horizontal')
  })

  it('deduplicates a large rectangle that crosses QuadTree leaves', () => {
    const spatialIndex = createRegionSpatialIndex({
      maxObjects: 1,
      maxLevels: 4,
    })

    spatialIndex.rebuild(documentBounds, [
      rectangleRegion({
        id: 'large-region',
        left: 100,
        top: 100,
        right: 900,
        bottom: 700,
      }),
      rectangleRegion({ id: 'small-a', left: 10, top: 10, right: 20, bottom: 20 }),
      rectangleRegion({ id: 'small-b', left: 950, top: 750, right: 960, bottom: 760 }),
    ])

    const candidates = spatialIndex.query({ x: 500, y: 400, width: 1, height: 1 })

    expect(candidates.filter((regionId) => regionId === 'large-region')).toHaveLength(1)
  })

  it('accepts optional configuration overrides', () => {
    const spatialIndex = createRegionSpatialIndex({
      maxObjects: 1,
      minLevels: 1,
      maxLevels: 2,
    })

    spatialIndex.rebuild(documentBounds, [rectangleRegion()])

    expect(new Set(spatialIndex.query({ x: 100, y: 100, width: 10, height: 10 })))
      .toContain('rectangle-1')
  })

  it('does not expose retrieval order as application order', () => {
    const spatialIndex = createRegionSpatialIndex()
    const regions = [
      rectangleRegion({ id: 'region-c', left: 10, top: 10, right: 60, bottom: 60 }),
      rectangleRegion({ id: 'region-a', left: 20, top: 20, right: 70, bottom: 70 }),
      rectangleRegion({ id: 'region-b', left: 30, top: 30, right: 80, bottom: 80 }),
    ]

    spatialIndex.rebuild(documentBounds, regions)

    expect(new Set(spatialIndex.query(queryAround({
      x: 25,
      y: 25,
      width: 1,
      height: 1,
    })))).toEqual(new Set(['region-a', 'region-b', 'region-c']))
  })
})
