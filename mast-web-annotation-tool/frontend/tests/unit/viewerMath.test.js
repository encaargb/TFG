import { describe, expect, it } from 'vitest'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getNextZoom,
  getPreviousZoom,
  getVisibleDimensions,
  getZoomPercentage,
} from '../../src/utils/viewerMath'

describe('viewerMath', () => {
  it('converts a zoom level into a percentage', () => {
    expect(getZoomPercentage(1)).toBe(100)
    expect(getZoomPercentage(1.2)).toBe(120)
    expect(getZoomPercentage(0.5)).toBe(50)
  })

  it('increases zoom by the configured factor without exceeding the maximum', () => {
    expect(getNextZoom(1, 1.25, 8)).toBe(1.25)
    expect(getNextZoom(6.5, 1.25, 8)).toBe(8)
    expect(getNextZoom(8, 1.25, 8)).toBe(8)
  })

  it('decreases zoom by the configured factor without going below the minimum', () => {
    expect(getPreviousZoom(1, 1.25, 0.25)).toBe(0.8)
    expect(getPreviousZoom(0.3, 1.25, 0.25)).toBe(0.25)
    expect(getPreviousZoom(0.25, 1.25, 0.25)).toBe(0.25)
  })

  it('fits an image into the viewer area while preserving aspect ratio', () => {
    expect(getFittedDimensions(2000, 1000, 1000, 700)).toEqual({
      width: 1000,
      height: 500,
      scale: 0.5,
    })

    expect(getFittedDimensions(1000, 2000, 1000, 700)).toEqual({
      width: 350,
      height: 700,
      scale: 0.35,
    })
  })

  it('calculates the visible dimensions after zoom is applied', () => {
    expect(getVisibleDimensions(1000, 500, 1)).toEqual({
      width: 1000,
      height: 500,
    })

    expect(getVisibleDimensions(1000, 500, 1.25)).toEqual({
      width: 1250,
      height: 625,
    })
  })

  it('returns null document coordinates when there is no pointer position', () => {
    expect(getDocumentCoordinates(null, 1, 1000, 500)).toBeNull()
  })

  it('converts pointer coordinates back to document coordinates using the current zoom', () => {
    expect(getDocumentCoordinates({ x: 300, y: 180 }, 1.25, 1000, 500)).toEqual({
      x: 240,
      y: 144,
    })
  })

  it('clamps document coordinates to the fitted page boundaries', () => {
    expect(getDocumentCoordinates({ x: -20, y: 900 }, 1, 1000, 500)).toEqual({
      x: 0,
      y: 500,
    })
  })
})
