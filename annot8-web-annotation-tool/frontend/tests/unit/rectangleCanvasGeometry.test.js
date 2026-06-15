import { describe, expect, it, vi } from 'vitest'
import {
  applyVisibleRectangleToNode,
  clampVisibleRectangle,
  getNodeVisibleRectangle,
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
})
