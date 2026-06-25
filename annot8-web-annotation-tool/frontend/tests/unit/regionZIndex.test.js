import { describe, expect, it } from 'vitest'
import {
  compareRegionsBackToFront,
  compareRegionsFrontToBack,
  getNextRegionZIndex,
  isValidRegionZIndex,
  normalizeRegionZIndexes,
} from '../../src/utils/regionZIndex'

function region(overrides = {}) {
  return {
    id: 'region-1',
    pageIndex: 0,
    type: 'rectangle',
    zIndex: 0,
    ...overrides,
  }
}

function withIndexes(regions) {
  return regions.map((entry, index) => ({
    region: entry,
    index,
  }))
}

describe('regionZIndex', () => {
  it('accepts only non-negative integer z-index values', () => {
    expect(isValidRegionZIndex(0)).toBe(true)
    expect(isValidRegionZIndex(3)).toBe(true)
    expect(isValidRegionZIndex(-1)).toBe(false)
    expect(isValidRegionZIndex(1.5)).toBe(false)
    expect(isValidRegionZIndex(Number.NaN)).toBe(false)
  })

  it('returns zero for the first region on an empty page', () => {
    expect(getNextRegionZIndex([], 0)).toBe(0)
    expect(getNextRegionZIndex([region({ pageIndex: 1, zIndex: 8 })], 0)).toBe(0)
  })

  it('uses max plus one and does not reuse deleted gaps', () => {
    expect(getNextRegionZIndex([
      region({ id: 'region-1', zIndex: 0 }),
      region({ id: 'region-3', zIndex: 2 }),
    ], 0)).toBe(3)
  })

  it('keeps separate pages independent', () => {
    const regions = [
      region({ pageIndex: 0, zIndex: 4 }),
      region({ pageIndex: 1, zIndex: 1 }),
    ]

    expect(getNextRegionZIndex(regions, 0)).toBe(5)
    expect(getNextRegionZIndex(regions, 1)).toBe(2)
    expect(getNextRegionZIndex(regions, 2)).toBe(0)
  })

  it('preserves valid unique z-indexes when no page requires normalisation', () => {
    const regions = [
      region({ id: 'region-1', zIndex: 3 }),
      region({ id: 'region-2', zIndex: 9 }),
    ]

    expect(normalizeRegionZIndexes(regions)).toEqual(regions)
  })

  it('normalises missing, negative and decimal indexes deterministically', () => {
    expect(normalizeRegionZIndexes([
      region({ id: 'valid', zIndex: 3 }),
      region({ id: 'missing', zIndex: undefined }),
      region({ id: 'negative', zIndex: -1 }),
      region({ id: 'decimal', zIndex: 2.5 }),
    ])).toEqual([
      expect.objectContaining({ id: 'valid', zIndex: 0 }),
      expect.objectContaining({ id: 'missing', zIndex: 1 }),
      expect.objectContaining({ id: 'negative', zIndex: 2 }),
      expect.objectContaining({ id: 'decimal', zIndex: 3 }),
    ])
  })

  it('resolves duplicate indexes using original array order as a stable fallback', () => {
    expect(normalizeRegionZIndexes([
      region({ id: 'first', zIndex: 1 }),
      region({ id: 'second', zIndex: 1 }),
      region({ id: 'third', zIndex: 4 }),
    ])).toEqual([
      expect.objectContaining({ id: 'first', zIndex: 0 }),
      expect.objectContaining({ id: 'second', zIndex: 2 }),
      expect.objectContaining({ id: 'third', zIndex: 1 }),
    ])
  })

  it('normalises pages independently', () => {
    expect(normalizeRegionZIndexes([
      region({ id: 'page-0-a', pageIndex: 0, zIndex: 1 }),
      region({ id: 'page-1-a', pageIndex: 1, zIndex: 5 }),
      region({ id: 'page-0-b', pageIndex: 0, zIndex: 1 }),
      region({ id: 'page-1-b', pageIndex: 1, zIndex: 8 }),
    ])).toEqual([
      expect.objectContaining({ id: 'page-0-a', pageIndex: 0, zIndex: 0 }),
      expect.objectContaining({ id: 'page-1-a', pageIndex: 1, zIndex: 5 }),
      expect.objectContaining({ id: 'page-0-b', pageIndex: 0, zIndex: 1 }),
      expect.objectContaining({ id: 'page-1-b', pageIndex: 1, zIndex: 8 }),
    ])
  })

  it('returns new region objects without mutating the originals', () => {
    const regions = [
      region({ id: 'region-1', zIndex: 1 }),
      region({ id: 'region-2', zIndex: 1 }),
    ]
    const original = structuredClone(regions)
    const normalized = normalizeRegionZIndexes(regions)

    expect(regions).toEqual(original)
    expect(normalized[0]).not.toBe(regions[0])
    expect(normalized[1]).not.toBe(regions[1])
  })

  it('sorts regions back to front for rendering', () => {
    const entries = withIndexes([
      region({ id: 'middle', zIndex: 4 }),
      region({ id: 'back', zIndex: 1 }),
      region({ id: 'front', zIndex: 7 }),
    ])

    expect([...entries].sort(compareRegionsBackToFront).map(({ region }) => region.id))
      .toEqual(['back', 'middle', 'front'])
  })

  it('sorts regions front to back for future selection', () => {
    const entries = withIndexes([
      region({ id: 'middle', zIndex: 4 }),
      region({ id: 'back', zIndex: 1 }),
      region({ id: 'front', zIndex: 7 }),
    ])

    expect([...entries].sort(compareRegionsFrontToBack).map(({ region }) => region.id))
      .toEqual(['front', 'middle', 'back'])
  })

  it('uses matching equal-value fallbacks for visual stacking', () => {
    const entries = withIndexes([
      region({ id: 'earlier', zIndex: 2 }),
      region({ id: 'later', zIndex: 2 }),
    ])

    expect([...entries].sort(compareRegionsBackToFront).map(({ region }) => region.id))
      .toEqual(['earlier', 'later'])
    expect([...entries].sort(compareRegionsFrontToBack).map(({ region }) => region.id))
      .toEqual(['later', 'earlier'])
  })
})
