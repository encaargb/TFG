import { describe, expect, it, vi } from 'vitest'
import { useCanvasCursor } from '../../src/components/viewer/useCanvasCursor'

function createCursor({ activeTool = 'select', regions = [{ id: 'region-1' }] } = {}) {
  const container = { style: { cursor: 'default' } }
  const stage = { container: vi.fn(() => container) }
  const cursor = useCanvasCursor({
    getStage: () => stage,
    getActiveTool: () => activeTool,
    getCurrentPageRegions: () => regions,
  })

  return {
    container,
    cursor,
  }
}

describe('useCanvasCursor', () => {
  it('sets hovered region and grab cursor on mouse enter in select mode', () => {
    const { container, cursor } = createCursor()

    cursor.handleRegionMouseEnter('region-1')

    expect(cursor.getHoveredRegionId()).toBe('region-1')
    expect(container.style.cursor).toBe('grab')
  })

  it('sets dragged region and grabbing cursor on region drag start in select mode', () => {
    const { container, cursor } = createCursor()

    cursor.beginRegionDrag('region-1')

    expect(cursor.getDraggedRegionId()).toBe('region-1')
    expect(container.style.cursor).toBe('grabbing')
  })

  it('returns to grab after region drag end when the region is still hovered', () => {
    const { container, cursor } = createCursor()

    cursor.handleRegionMouseEnter('region-1')
    cursor.beginRegionDrag('region-1')
    cursor.endRegionDrag('region-1')

    expect(cursor.getDraggedRegionId()).toBe(null)
    expect(container.style.cursor).toBe('grab')
  })

  it('resets the cursor on region mouse leave when not dragging', () => {
    const { container, cursor } = createCursor()

    cursor.handleRegionMouseEnter('region-1')
    cursor.handleRegionMouseLeave('region-1')

    expect(cursor.getHoveredRegionId()).toBe(null)
    expect(container.style.cursor).toBe('default')
  })

  it('clears stale hover when moving over a target that is not a current page region', () => {
    const { container, cursor } = createCursor()

    cursor.handleRegionMouseEnter('region-1')
    cursor.resetStaleRegionCursor({
      target: { config: { id: 'region-2' } },
    })

    expect(cursor.getHoveredRegionId()).toBe(null)
    expect(container.style.cursor).toBe('default')
  })
})
