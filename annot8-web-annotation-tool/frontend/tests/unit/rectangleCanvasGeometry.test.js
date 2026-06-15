import { describe, expect, it, vi } from 'vitest'
import {
  applyVisibleRectangleToNode,
  clampTransformerBox,
  clampVisibleRectangle,
  getAnchorAwareVisibleRectangle,
  getNodeVisibleRectangle,
  getTransformedRectangleEdges,
  normalizeVisibleRectangle,
} from '../../src/components/viewer/rectangleCanvasGeometry'

describe('rectangleCanvasGeometry', () => {
  it('normalizes rectangles with negative width', () => {
    expect(normalizeVisibleRectangle({
      x: 100,
      y: 50,
      width: -30,
      height: 20,
    })).toEqual({
      x: 70,
      y: 50,
      width: 30,
      height: 20,
    })
  })

  it('normalizes rectangles with negative height', () => {
    expect(normalizeVisibleRectangle({
      x: 100,
      y: 50,
      width: 30,
      height: -20,
    })).toEqual({
      x: 100,
      y: 30,
      width: 30,
      height: 20,
    })
  })

  it('clamps a rectangle inside visible bounds', () => {
    expect(clampVisibleRectangle(
      { x: 90, y: 70, width: 30, height: 40 },
      { width: 100, height: 100 }
    )).toEqual({
      x: 70,
      y: 60,
      width: 30,
      height: 40,
    })
  })

  it('enforces minimum rectangle size', () => {
    expect(clampVisibleRectangle(
      { x: 10, y: 20, width: 2, height: 3 },
      { width: 100, height: 100 },
      4
    )).toEqual({
      x: 10,
      y: 20,
      width: 4,
      height: 4,
    })
  })

  it('reads a visible rectangle from a scaled node', () => {
    const node = {
      x: vi.fn(() => 10),
      y: vi.fn(() => 20),
      width: vi.fn(() => 30),
      height: vi.fn(() => 40),
      scaleX: vi.fn(() => 2),
      scaleY: vi.fn(() => 3),
    }

    expect(getNodeVisibleRectangle(node)).toEqual({
      x: 10,
      y: 20,
      width: 60,
      height: 120,
    })
  })

  it('applies a visible rectangle to a node and resets scale', () => {
    const node = {
      x: vi.fn(),
      y: vi.fn(),
      width: vi.fn(),
      height: vi.fn(),
      scaleX: vi.fn(),
      scaleY: vi.fn(),
    }

    applyVisibleRectangleToNode(node, {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })

    expect(node.x).toHaveBeenCalledWith(10)
    expect(node.y).toHaveBeenCalledWith(20)
    expect(node.width).toHaveBeenCalledWith(30)
    expect(node.height).toHaveBeenCalledWith(40)
    expect(node.scaleX).toHaveBeenCalledWith(1)
    expect(node.scaleY).toHaveBeenCalledWith(1)
  })

  it('resizing from the left keeps the right edge fixed', () => {
    expect(getAnchorAwareVisibleRectangle(
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 5, y: 20, width: 55, height: 40 },
      'middle-left',
      { width: 100, height: 100 },
      8
    )).toEqual({
      x: 5,
      y: 20,
      width: 55,
      height: 40,
    })
  })

  it('resizing from the right keeps the left edge fixed', () => {
    expect(getAnchorAwareVisibleRectangle(
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 10, y: 20, width: 70, height: 40 },
      'middle-right',
      { width: 100, height: 100 },
      8
    )).toEqual({
      x: 10,
      y: 20,
      width: 70,
      height: 40,
    })
  })

  it('resizing from the top keeps the bottom edge fixed', () => {
    expect(getAnchorAwareVisibleRectangle(
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 10, y: 10, width: 50, height: 50 },
      'top-center',
      { width: 100, height: 100 },
      8
    )).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    })
  })

  it('resizing from the bottom keeps the top edge fixed', () => {
    expect(getAnchorAwareVisibleRectangle(
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 10, y: 20, width: 50, height: 60 },
      'bottom-center',
      { width: 100, height: 100 },
      8
    )).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 60,
    })
  })

  it('enforces minimum rectangle size while resizing from an anchor', () => {
    expect(getAnchorAwareVisibleRectangle(
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 59, y: 20, width: 1, height: 40 },
      'middle-left',
      { width: 100, height: 100 },
      8
    )).toEqual({
      x: 52,
      y: 20,
      width: 8,
      height: 40,
    })
  })

  it('respects visible bounds while resizing from an anchor', () => {
    expect(getAnchorAwareVisibleRectangle(
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 10, y: 20, width: 200, height: 40 },
      'middle-right',
      { width: 100, height: 100 },
      8
    )).toEqual({
      x: 10,
      y: 20,
      width: 90,
      height: 40,
    })
  })

  it('returns the old transformer box when the new box is below minimum size', () => {
    const oldBox = { x: 10, y: 20, width: 30, height: 40 }

    expect(clampTransformerBox(
      oldBox,
      { x: 10, y: 20, width: 4, height: 40 },
      { width: 100, height: 100 },
      8
    )).toBe(oldBox)
  })

  it('preserves the opposite rectangle edges for inactive transformer anchors', () => {
    expect(getTransformedRectangleEdges(
      { left: 10, top: 20, right: 60, bottom: 80 },
      { left: 5, top: 15, right: 60, bottom: 80 },
      'middle-left'
    )).toEqual({
      left: 5,
      top: 20,
      right: 60,
      bottom: 80,
    })
  })
})
