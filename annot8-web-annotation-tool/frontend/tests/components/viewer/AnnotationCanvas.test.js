import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Konva from 'konva'
import AnnotationCanvas from '../../../src/components/viewer/AnnotationCanvas.vue'
import {
  getImageInstances,
  getLayerInstances,
  getLatestStage,
  getCircleInstances,
  getLineInstances,
  getRectInstances,
  getTransformerInstances,
  resetKonvaMocks,
} from '../../setup'

const flushImageLoad = () => new Promise((resolve) => setTimeout(resolve, 0))

function mountCanvas(props = {}) {
  return mount(AnnotationCanvas, {
    props: {
      selectedPage: '/page-1.png',
      pageIndex: 0,
      regions: [],
      selectedRegionId: null,
      activeTool: 'select',
      zoomLevel: 1,
      nextRegionId: 'region-1',
      ...props,
    },
  })
}

function rectangleRegion(overrides = {}) {
  return {
    id: 'region-1',
    pageIndex: 0,
    type: 'rectangle',
    left: 200,
    top: 100,
    right: 500,
    bottom: 300,
    color: '#0d6efd',
    ...overrides,
  }
}

async function mountSelectedRectangleCanvas() {
  const wrapper = mountCanvas({
    selectedRegionId: 'region-1',
    regions: [rectangleRegion()],
  })
  await flushImageLoad()

  return {
    wrapper,
    rectangle: [...getRectInstances()].reverse().find((rect) => rect.config.id === 'region-1'),
    transformer: getTransformerInstances().at(-1),
  }
}

function polygonRegion(overrides = {}) {
  return {
    id: 'region-1',
    pageIndex: 0,
    type: 'polygon',
    points: [
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ],
    color: '#0d6efd',
    ...overrides,
  }
}

function fourPointPolygonRegion(overrides = {}) {
  return polygonRegion({
    points: [
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 500, y: 300 },
      { x: 200, y: 300 },
    ],
    ...overrides,
  })
}

function polylineRegion(overrides = {}) {
  return {
    id: 'region-1',
    pageIndex: 0,
    type: 'polyline',
    points: [
      { x: 200, y: 100 },
      { x: 500, y: 100 },
    ],
    color: '#0d6efd',
    ...overrides,
  }
}

function threePointPolylineRegion(overrides = {}) {
  return polylineRegion({
    points: [
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ],
    ...overrides,
  })
}

async function drawPointRegionWithDoubleClick(activeTool) {
  const wrapper = mountCanvas({ activeTool })
  await flushImageLoad()

  const stage = getLatestStage()

  stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
  stage.trigger('mousedown', { evt: { detail: 1 } })
  stage.trigger('click', { evt: { detail: 1 } })

  stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
  stage.trigger('mousedown', { evt: { detail: 1 } })
  stage.trigger('click', { evt: { detail: 1 } })

  stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
  stage.trigger('mousedown', { evt: { detail: 1 } })
  stage.trigger('click', { evt: { detail: 1 } })

  stage.trigger('mousedown', { evt: { detail: 2 } })
  stage.trigger('click', { evt: { detail: 2 } })
  stage.trigger('dblclick')

  return wrapper
}

function mockCanvasWrapperBounds(wrapper, bounds = {}) {
  const element = wrapper.find('.canvas-wrapper').element
  const rect = {
    left: 0,
    top: 0,
    right: 300,
    bottom: 200,
    ...bounds,
  }

  element.scrollLeft = 0
  element.scrollTop = 0
  element.getBoundingClientRect = vi.fn(() => ({
    ...rect,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
  }))

  return element
}

describe('AnnotationCanvas', () => {
  beforeEach(() => {
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Rect.mockClear()
    Konva.Line.mockClear()
    Konva.Transformer.mockClear()
  })

  it('creates the Konva stage, layers, and selected page image', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const stage = getLatestStage()
    const layers = getLayerInstances()

    expect(Konva.Stage).toHaveBeenCalledTimes(1)
    expect(Konva.Layer).toHaveBeenCalledTimes(2)
    expect(stage.config.container).toBe(wrapper.find('.konva-container').element)
    expect(stage.add).toHaveBeenCalledWith(layers[0])
    expect(stage.add).toHaveBeenCalledWith(layers[1])
    expect(Konva.Image).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 0,
        y: 0,
        width: 1000,
        height: 500,
      })
    )
  })

  it('renders rectangle regions and attaches the transformer to the selected rectangle', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')
    const transformer = getTransformerInstances().at(-1)

    expect(rectangle.config).toEqual(
      expect.objectContaining({
        id: 'region-1',
        x: 100,
        y: 50,
        width: 150,
        height: 100,
        strokeWidth: 3,
        draggable: true,
      })
    )
    expect(transformer.nodes).toHaveBeenLastCalledWith([rectangle])
    expect(transformer.config).toEqual(
      expect.objectContaining({
        anchorSize: 8,
        anchorCornerRadius: 4,
        anchorFill: '#ffffff',
        anchorStroke: '#0d6efd',
        anchorStrokeWidth: 2,
      })
    )
  })

  it('emits mouse coordinates in document space', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 125 })

    stage.trigger('mousemove')

    expect(wrapper.emitted('mouse-position-change')).toEqual([[
      { x: 500, y: 250 },
    ]])
  })

  it('clears mouse coordinates each time the pointer leaves the document', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const stage = getLatestStage()

    stage.trigger('mouseleave')
    stage.trigger('mouseleave')

    expect(wrapper.emitted('mouse-position-change')).toEqual([[null], [null]])
  })

  it('does not auto-scroll during normal hover in select mode', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const stage = getLatestStage()
    const canvasWrapper = mockCanvasWrapperBounds(wrapper)

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousemove', { evt: { clientX: 295, clientY: 100 } })

    expect(canvasWrapper.scrollLeft).toBe(0)
    expect(canvasWrapper.scrollTop).toBe(0)
  })

  it('auto-scrolls right while drawing near the wrapper edge', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    const canvasWrapper = mockCanvasWrapperBounds(wrapper)

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove', { evt: { clientX: 295, clientY: 100 } })

    expect(canvasWrapper.scrollLeft).toBe(12)
  })

  it('auto-scrolls down while drawing near the wrapper edge', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    const canvasWrapper = mockCanvasWrapperBounds(wrapper)

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove', { evt: { clientX: 150, clientY: 195 } })

    expect(canvasWrapper.scrollTop).toBe(12)
  })

  it('emits a new rectangle region after dragging on the canvas', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
        left: 200,
        top: 100,
        right: 500,
        bottom: 300,
      })
    )
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('x')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('y')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('width')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('height')
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('normalizes rectangle creation when dragging from bottom-right to top-left', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
        left: 200,
        top: 100,
        right: 500,
        bottom: 300,
      })
    )
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('x')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('y')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('width')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('height')
  })

  it('keeps the live rectangle draft inside the right and bottom page bounds', async () => {
    mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 9999, y: 9999 })
    stage.trigger('mousemove')

    expect(draftRectangle.x).toHaveBeenLastCalledWith(100)
    expect(draftRectangle.y).toHaveBeenLastCalledWith(50)
    expect(draftRectangle.width).toHaveBeenLastCalledWith(900)
    expect(draftRectangle.height).toHaveBeenLastCalledWith(450)
  })

  it('keeps the live rectangle draft inside the left and top page bounds', async () => {
    mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: -100, y: -80 })
    stage.trigger('mousemove')

    expect(draftRectangle.x).toHaveBeenLastCalledWith(0)
    expect(draftRectangle.y).toHaveBeenLastCalledWith(0)
    expect(draftRectangle.width).toHaveBeenLastCalledWith(250)
    expect(draftRectangle.height).toHaveBeenLastCalledWith(150)
  })

  it('emits a clamped rectangle when mouseup happens outside the page bounds', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 9999, y: 9999 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        left: 200,
        top: 100,
        right: 2000,
        bottom: 1000,
      })
    )
  })

  it('does not create out-of-bounds rectangle coordinates after fast pointer movement', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 10000, y: 10000 })
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        left: 200,
        top: 100,
        right: 2000,
        bottom: 1000,
      })
    )
  })

  it('creates a rectangle after leaving the right and bottom bounds and returning inside', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 9999, y: 9999 })
    stage.trigger('mousemove')

    expect(draftRectangle.destroy).not.toHaveBeenCalled()

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        left: 200,
        top: 100,
        right: 500,
        bottom: 300,
      })
    )
  })

  it('creates a rectangle after leaving the left and top bounds and returning inside', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: -100, y: -80 })
    stage.trigger('mousemove')

    expect(draftRectangle.destroy).not.toHaveBeenCalled()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        left: 200,
        top: 100,
        right: 500,
        bottom: 300,
      })
    )
  })

  it('does not emit a rectangle when the drag area is too small', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 101, y: 51 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('cancels an active rectangle draft with Escape', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(draftRectangle.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('add-region')).toBeUndefined()

    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('emits the selected rectangle id when clicking an existing rectangle', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: null,
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
  })

  it('sets the grab cursor when hovering a rectangle region in select mode', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')

    expect(stage.container().style.cursor).toBe('grab')
  })

  it('sets the grabbing cursor while dragging a rectangle region', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('dragstart')

    expect(stage.container().style.cursor).toBe('grabbing')
  })

  it('returns to grab after dragging when the pointer is still over a rectangle region', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')
    rectangle.trigger('dragstart')
    rectangle.trigger('dragend')

    expect(stage.container().style.cursor).toBe('grab')
  })

  it('resets the cursor after dragging when the pointer is no longer over a rectangle region', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')
    rectangle.trigger('dragstart')
    rectangle.trigger('mouseleave')
    rectangle.trigger('dragend')

    expect(stage.container().style.cursor).toBe('default')
  })

  it('resets the cursor when leaving a rectangle region', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')
    rectangle.trigger('mouseleave')

    expect(stage.container().style.cursor).toBe('default')
  })

  it('resets the cursor when moving from a rectangle region to empty canvas', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')
    stage.trigger('mousemove', { target: stage })

    expect(stage.container().style.cursor).toBe('default')
  })

  it('does not reset the grabbing cursor while dragging over empty canvas', async () => {
    mountCanvas({
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')
    rectangle.trigger('dragstart')
    stage.trigger('mousemove', { target: stage })

    expect(stage.container().style.cursor).toBe('grabbing')
  })

  it('does not set the grab cursor when hovering a rectangle region in drawing mode', async () => {
    mountCanvas({
      activeTool: 'rectangle',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('mouseenter')

    expect(stage.container().style.cursor).not.toBe('grab')
  })

  it('resets the cursor when moving from a polygon region to empty canvas', async () => {
    mountCanvas({
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    polygon.trigger('mouseenter')
    stage.trigger('mousemove', { target: stage })

    expect(stage.container().style.cursor).toBe('default')
  })

  it('emits clear-selected-region when clicking empty canvas in select mode', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.trigger('click')

    expect(wrapper.emitted('clear-selected-region')).toEqual([[]])
  })

  it('emits selection and update events for existing regions', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('click')
    rectangle.x(120)
    rectangle.y(80)
    rectangle.trigger('dragend')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 240,
        top: 160,
        right: 540,
        bottom: 360,
      },
    })
  })

  it('hides and restores the transformer while dragging a selected rectangle', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')
    const transformer = getTransformerInstances().at(-1)

    rectangle.trigger('dragstart')

    expect(transformer.visible).toHaveBeenLastCalledWith(false)

    rectangle.trigger('dragend')

    expect(transformer.visible).toHaveBeenLastCalledWith(true)
    expect(transformer.forceUpdate).toHaveBeenCalledTimes(1)
  })

  it('visually clamps dragged rectangles inside the visible document bounds', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.x(-20)
    rectangle.y(9999)
    rectangle.trigger('dragmove')

    expect(rectangle.x).toHaveBeenLastCalledWith(0)
    expect(rectangle.y).toHaveBeenLastCalledWith(400)
  })

  it('emits clamped rectangle updates after dragging outside document bounds', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.x(-20)
    rectangle.y(9999)
    rectangle.trigger('dragend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 0,
        top: 800,
        right: 300,
        bottom: 1000,
      },
    })
  })

  it('keeps rectangle dimensions synchronized while transformer resizing is in progress', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.scaleX(2)
    rectangle.scaleY(1.5)
    rectangle.trigger('transform')

    expect(rectangle.width).toHaveBeenLastCalledWith(300)
    expect(rectangle.height).toHaveBeenLastCalledWith(150)
    expect(rectangle.scaleX).toHaveBeenLastCalledWith(1)
    expect(rectangle.scaleY).toHaveBeenLastCalledWith(1)
  })

  it('emits rectangle update events after transformer resizing', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.scaleX(2)
    rectangle.scaleY(1.5)
    rectangle.trigger('transformend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 200,
        top: 100,
        right: 800,
        bottom: 400,
      },
    })
    expect(rectangle.scaleX).toHaveBeenLastCalledWith(1)
    expect(rectangle.scaleY).toHaveBeenLastCalledWith(1)
  })

  it('prevents invalid negative rectangle dimensions from transformer resizing', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const transformer = getTransformerInstances().at(-1)
    const clampedBox = transformer.config.boundBoxFunc(
      { x: 100, y: 50, width: 150, height: 100 },
      { x: 250, y: 150, width: -120, height: -80 }
    )

    expect(transformer.config.flipEnabled).toBe(false)
    expect(clampedBox).toEqual({ x: 100, y: 50, width: 150, height: 100 })
  })

  it('keeps transformed rectangles inside the visible document bounds', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const transformer = getTransformerInstances().at(-1)
    const clampedBox = transformer.config.boundBoxFunc(
      { x: 100, y: 50, width: 150, height: 100 },
      { x: -50, y: 600, width: 1200, height: 800 }
    )

    expect(clampedBox).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 500,
    })
  })

  it('keeps the visual left edge fixed while resizing the right edge beyond bounds', async () => {
    const { rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'middle-right')

    rectangle.width(1200)
    rectangle.trigger('transform')

    expect(rectangle.x).toHaveBeenLastCalledWith(100)
    expect(rectangle.y).toHaveBeenLastCalledWith(50)
    expect(rectangle.width).toHaveBeenLastCalledWith(900)
    expect(rectangle.height).toHaveBeenLastCalledWith(100)
  })

  it('keeps the visual right edge fixed while resizing the left edge beyond bounds', async () => {
    const { rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'middle-left')

    rectangle.x(-50)
    rectangle.width(300)
    rectangle.trigger('transform')

    expect(rectangle.x).toHaveBeenLastCalledWith(0)
    expect(rectangle.y).toHaveBeenLastCalledWith(50)
    expect(rectangle.width).toHaveBeenLastCalledWith(250)
    expect(rectangle.height).toHaveBeenLastCalledWith(100)
  })

  it('keeps the visual top edge fixed while resizing the bottom edge beyond bounds', async () => {
    const { rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'bottom-center')

    rectangle.height(1000)
    rectangle.trigger('transform')

    expect(rectangle.x).toHaveBeenLastCalledWith(100)
    expect(rectangle.y).toHaveBeenLastCalledWith(50)
    expect(rectangle.width).toHaveBeenLastCalledWith(150)
    expect(rectangle.height).toHaveBeenLastCalledWith(450)
  })

  it('keeps the visual bottom edge fixed while resizing the top edge beyond bounds', async () => {
    const { rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'top-center')

    rectangle.y(-80)
    rectangle.height(230)
    rectangle.trigger('transform')

    expect(rectangle.x).toHaveBeenLastCalledWith(100)
    expect(rectangle.y).toHaveBeenLastCalledWith(0)
    expect(rectangle.width).toHaveBeenLastCalledWith(150)
    expect(rectangle.height).toHaveBeenLastCalledWith(150)
  })

  it('keeps the opposite visual corner fixed while resizing a corner beyond bounds', async () => {
    const { rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'bottom-right')

    rectangle.width(1200)
    rectangle.height(800)
    rectangle.trigger('transform')

    expect(rectangle.x).toHaveBeenLastCalledWith(100)
    expect(rectangle.y).toHaveBeenLastCalledWith(50)
    expect(rectangle.width).toHaveBeenLastCalledWith(900)
    expect(rectangle.height).toHaveBeenLastCalledWith(450)

    const secondCanvas = await mountSelectedRectangleCanvas()
    secondCanvas.transformer.getActiveAnchor = vi.fn(() => 'top-left')

    secondCanvas.rectangle.x(-100)
    secondCanvas.rectangle.y(-60)
    secondCanvas.rectangle.width(300)
    secondCanvas.rectangle.height(220)
    secondCanvas.rectangle.trigger('transform')

    expect(secondCanvas.rectangle.x).toHaveBeenLastCalledWith(0)
    expect(secondCanvas.rectangle.y).toHaveBeenLastCalledWith(0)
    expect(secondCanvas.rectangle.width).toHaveBeenLastCalledWith(250)
    expect(secondCanvas.rectangle.height).toHaveBeenLastCalledWith(150)
  })

  it('keeps the left edge fixed when resizing the right edge beyond document bounds', async () => {
    const { wrapper, rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'middle-right')

    rectangle.width(1200)
    rectangle.trigger('transformend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 200,
        top: 100,
        right: 2000,
        bottom: 300,
      },
    })
  })

  it('keeps the right edge fixed when resizing the left edge beyond document bounds', async () => {
    const { wrapper, rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'middle-left')

    rectangle.x(-50)
    rectangle.width(300)
    rectangle.trigger('transformend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 0,
        top: 100,
        right: 500,
        bottom: 300,
      },
    })
  })

  it('keeps the top edge fixed when resizing the bottom edge beyond document bounds', async () => {
    const { wrapper, rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'bottom-center')

    rectangle.height(1000)
    rectangle.trigger('transformend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 200,
        top: 100,
        right: 500,
        bottom: 1000,
      },
    })
  })

  it('keeps the bottom edge fixed when resizing the top edge beyond document bounds', async () => {
    const { wrapper, rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'top-center')

    rectangle.y(-80)
    rectangle.height(230)
    rectangle.trigger('transformend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 200,
        top: 0,
        right: 500,
        bottom: 300,
      },
    })
  })

  it('keeps the opposite corner fixed when resizing a corner beyond document bounds', async () => {
    const { wrapper, rectangle, transformer } = await mountSelectedRectangleCanvas()
    transformer.getActiveAnchor = vi.fn(() => 'bottom-right')

    rectangle.width(1200)
    rectangle.height(800)
    rectangle.trigger('transformend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 200,
        top: 100,
        right: 2000,
        bottom: 1000,
      },
    })

    wrapper.unmount()

    const secondCanvas = await mountSelectedRectangleCanvas()
    secondCanvas.transformer.getActiveAnchor = vi.fn(() => 'top-left')

    secondCanvas.rectangle.x(-100)
    secondCanvas.rectangle.y(-60)
    secondCanvas.rectangle.width(300)
    secondCanvas.rectangle.height(220)
    secondCanvas.rectangle.trigger('transformend')

    expect(secondCanvas.wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
      },
    })
  })

  it('updates stage and image dimensions when zoom changes', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const stage = getLatestStage()
    const imageNode = getImageInstances()[0]

    await wrapper.setProps({ zoomLevel: 1.25 })

    expect(stage.width).toHaveBeenLastCalledWith(1250)
    expect(stage.height).toHaveBeenLastCalledWith(625)
    expect(imageNode.width).toHaveBeenLastCalledWith(1250)
    expect(imageNode.height).toHaveBeenLastCalledWith(625)
  })

  it('reloads the Konva image when the selected page changes', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const firstImage = getImageInstances()[0]

    await wrapper.setProps({ selectedPage: '/page-2.png' })
    await flushImageLoad()

    expect(Konva.Image).toHaveBeenCalledTimes(2)
    expect(firstImage.destroy).toHaveBeenCalledTimes(1)
    expect(getImageInstances()).toHaveLength(2)
  })

  it('ignores stale image loads after the selected page changes quickly', async () => {
    const OriginalImage = window.Image
    const deferredImages = []

    window.Image = class {
      constructor() {
        this.width = 2000
        this.height = 1000
        deferredImages.push(this)
      }

      set src(value) {
        this._src = value
      }

      get src() {
        return this._src
      }
    }

    try {
      const wrapper = mountCanvas({ selectedPage: '/page-1.png' })

      await wrapper.setProps({ selectedPage: '/page-2.png' })

      deferredImages[0].onload()

      expect(Konva.Image).not.toHaveBeenCalled()

      deferredImages[1].onload()

      expect(Konva.Image).toHaveBeenCalledTimes(1)
      expect(Konva.Image).toHaveBeenCalledWith(
        expect.objectContaining({
          image: deferredImages[1],
          width: 1000,
          height: 500,
        })
      )
    } finally {
      window.Image = OriginalImage
    }
  })

  it('destroys the Konva stage when unmounted', async () => {
    const wrapper = mountCanvas()
    await flushImageLoad()

    const stage = getLatestStage()

    wrapper.unmount()

    expect(stage.destroy).toHaveBeenCalledTimes(1)
  })

  it('emits a polygon region after multiple clicks and Enter', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    expect(wrapper.emitted('add-region')).toBeUndefined()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('starts a polygon draft on mouse down before mouse up', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftPolygon = getLineInstances().at(-1)

    expect(draftPolygon).toBeTruthy()
    expect(wrapper.emitted('add-region')).toBeUndefined()
  })

  it('updates the polygon draft preview after mouse down and mouse move', async () => {
    mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftPolygon = getLineInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousemove')

    expect(draftPolygon.points).toHaveBeenLastCalledWith([100, 50, 250, 50])
  })

  it('keeps polygon draft updates while auto-scrolling near the wrapper edge', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()
    const canvasWrapper = mockCanvasWrapperBounds(wrapper)

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftPolygon = getLineInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousemove', { evt: { clientX: 295, clientY: 100 } })

    expect(canvasWrapper.scrollLeft).toBe(12)
    expect(draftPolygon.points).toHaveBeenLastCalledWith([100, 50, 250, 50])
  })

  it('adds a second polygon point when releasing after dragging', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
  })

  it('does not duplicate polygon points during normal clicks', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
  })

  it('does not add a second polygon point when the visible segment is below 4 px', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 103, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')).toBeUndefined()
  })

  it('adds a polygon point when the visible segment is at least 4 px', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 104, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 208, y: 100 },
          { x: 500, y: 300 },
        ],
      })
    )
  })

  it('clamps the point-region draft preview inside page bounds', async () => {
    mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    const draftPolygon = getLineInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 9999, y: 9999 })
    stage.trigger('mousemove')

    expect(draftPolygon.points).toHaveBeenLastCalledWith([100, 50, 1000, 500])
  })

  it('does not add a duplicate polygon point when finishing with double click', async () => {
    const wrapper = await drawPointRegionWithDoubleClick('polygon')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
  })

  it('cancels an active polygon draft with Escape', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    const draftPolygon = getLineInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(draftPolygon.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('add-region')).toBeUndefined()
  })

  it('rejects polygon drafts with fewer than three points', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('closes a polygon when clicking near the first point', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 106, y: 54 })
    stage.trigger('click')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
  })

  it('renders point regions with vertex handles when selected in select mode', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-3)

    expect(polygon.config).toEqual(
      expect.objectContaining({
        points: [100, 50, 250, 50, 200, 150],
        closed: true,
        strokeWidth: 3,
      })
    )
    expect(vertexHandles).toHaveLength(3)
    expect(vertexHandles[0].config).toEqual(
      expect.objectContaining({
        x: 100,
        y: 50,
        radius: 4,
        draggable: true,
        strokeScaleEnabled: false,
      })
    )
  })

  it('sets the grab cursor when hovering a polygon vertex handle', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const vertexHandle = getCircleInstances().slice(-3)[0]

    vertexHandle.trigger('mouseenter')

    expect(stage.container().style.cursor).toBe('grab')
  })

  it('sets the grabbing cursor when dragging a polygon vertex handle', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const vertexHandle = getCircleInstances().slice(-3)[0]

    vertexHandle.trigger('mouseenter')
    vertexHandle.trigger('dragstart')

    expect(stage.container().style.cursor).toBe('grabbing')
  })

  it('auto-scrolls while dragging a polygon vertex handle near the wrapper edge', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const canvasWrapper = mockCanvasWrapperBounds(wrapper)
    const vertexHandle = getCircleInstances().slice(-3)[0]

    vertexHandle.trigger('dragstart')
    vertexHandle.trigger('dragmove', { evt: { clientX: 295, clientY: 100 } })

    expect(canvasWrapper.scrollLeft).toBe(12)
  })

  it('resets the cursor when leaving a polygon vertex handle', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const vertexHandle = getCircleInstances().slice(-3)[0]

    vertexHandle.trigger('mouseenter')
    vertexHandle.trigger('mouseleave')

    expect(stage.container().style.cursor).toBe('default')
  })

  it('updates the last polygon vertex after finishing with double click', async () => {
    const wrapper = await drawPointRegionWithDoubleClick('polygon')
    const region = wrapper.emitted('add-region')[0][0]

    await wrapper.setProps({
      activeTool: 'select',
      selectedRegionId: 'region-1',
      regions: [region],
    })

    const polygon = [...getLineInstances()].reverse().find((line) => line.config.id === 'region-1')
    const lastVertexHandle = getCircleInstances().slice(-3).at(-1)

    lastVertexHandle.x(210)
    lastVertexHandle.y(175)
    lastVertexHandle.trigger('dragmove')

    expect(polygon.points).toHaveBeenLastCalledWith([100, 50, 250, 50, 210, 175])

    lastVertexHandle.trigger('dragend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 420, y: 350 },
        ],
      },
    })
  })

  it('does not commit a polygon vertex drag that creates a segment below 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')
    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.x(103)
    middleVertexHandle.y(50)
    middleVertexHandle.trigger('dragmove')

    expect(polygon.points).toHaveBeenLastCalledWith([100, 50, 103, 50, 200, 150])

    middleVertexHandle.trigger('dragend')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('does not commit a polygon vertex drag that makes the closing segment below 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const lastVertexHandle = getCircleInstances().slice(-3).at(-1)

    lastVertexHandle.x(103)
    lastVertexHandle.y(50)
    lastVertexHandle.trigger('dragmove')
    lastVertexHandle.trigger('dragend')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('hides and restores selected polygon vertex handles while dragging the whole region', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-3)

    polygon.trigger('dragstart')

    vertexHandles.forEach((handle) => {
      expect(handle.visible).toHaveBeenLastCalledWith(false)
    })

    polygon.trigger('dragend')

    vertexHandles.forEach((handle) => {
      expect(handle.visible).toHaveBeenLastCalledWith(true)
    })
  })

  it('does not add a point on single click of a selected polygon edge', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('adds a point to a selected polygon edge on double-click', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 300, y: 104 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
  })

  it('does not insert a polygon segment point that would create a segment below 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 101, y: 50 })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('adds a point on the first double-click after selecting a polygon', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: null,
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    polygon.trigger('click', { evt: { detail: 1 } })
    await wrapper.setProps({ selectedRegionId: 'region-1' })

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('click', { evt: { detail: 1 } })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 300, y: 104 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
  })

  it('inserts a selected polygon edge point at the correct normal segment position', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 225, y: 100 })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 450, y: 200 },
      { x: 400, y: 300 },
    ])
  })

  it('inserts a selected polygon edge point at the end for the closing segment', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 100 })
    polygon.trigger('dblclick')

    const points = wrapper.emitted('update-region')[0][0].changes.points

    expect(points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
      { x: 300, y: 200 },
    ])
    expect(points.at(-1)).not.toEqual(points[0])
  })

  it('allows polygon segment insertion when resulting segments are at least 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 104, y: 50 })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 208, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('does not add a point when double-clicking an unselected polygon', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: null,
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('click', { evt: { detail: 1 } })
    await wrapper.setProps({ selectedRegionId: 'region-1' })
    polygon.trigger('click', { evt: { detail: 2 } })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('select-region')).toEqual([['region-1'], ['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('does not add a point when double-clicking inside a selected polygon far from an edge', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 183, y: 83 })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('does not add a point when clicking or double-clicking an existing polygon vertex handle', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-3)[0]
    const event = {}

    firstVertexHandle.trigger('click', event)
    firstVertexHandle.trigger('dblclick')

    expect(event.cancelBubble).toBe(true)
    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('emits a polyline region after multiple clicks and Enter', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    expect(wrapper.emitted('add-region')).toBeUndefined()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('starts a polyline draft on mouse down before mouse up', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftPolyline = getLineInstances().at(-1)

    expect(draftPolyline).toBeTruthy()
    expect(wrapper.emitted('add-region')).toBeUndefined()
  })

  it('does not duplicate point-region points during normal clicks', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
        ],
      })
    )
  })

  it('adds a second polyline point when releasing after dragging', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
        ],
      })
    )
  })

  it('does not add a drag-release point for tiny point-region movement', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 104, y: 53 })
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
        ],
      })
    )
  })

  it('does not add a second polyline point when the visible segment is below 4 px', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 103, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
        ],
      })
    )
  })

  it('adds a polyline point when the visible segment is at least 4 px', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 104, y: 50 })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 208, y: 100 },
        ],
      })
    )
  })

  it('does not add a duplicate polyline point when finishing with double click', async () => {
    const wrapper = await drawPointRegionWithDoubleClick('polyline')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'polyline',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
  })

  it('cancels an active polyline draft with Escape', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    const draftPolyline = getLineInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(draftPolyline.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('add-region')).toBeUndefined()
  })

  it('rejects polyline drafts with fewer than two points', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('renders selected polyline vertex handles', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polylineRegion()],
    })
    await flushImageLoad()

    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-2)

    expect(polyline.config).toEqual(
      expect.objectContaining({
        points: [100, 50, 250, 50],
        closed: false,
        fill: 'transparent',
        strokeWidth: 3,
      })
    )
    expect(vertexHandles).toHaveLength(2)
    expect(vertexHandles[0].config).toEqual(
      expect.objectContaining({
        x: 100,
        y: 50,
        radius: 4,
        draggable: true,
        strokeScaleEnabled: false,
      })
    )
  })

  it('updates the last polyline vertex after finishing with double click', async () => {
    const wrapper = await drawPointRegionWithDoubleClick('polyline')
    const region = wrapper.emitted('add-region')[0][0]

    await wrapper.setProps({
      activeTool: 'select',
      selectedRegionId: 'region-1',
      regions: [region],
    })

    const polyline = [...getLineInstances()]
      .reverse()
      .find((line) => line.config.id === 'region-1')
    const lastVertexHandle = getCircleInstances().slice(-3).at(-1)

    lastVertexHandle.x(210)
    lastVertexHandle.y(175)
    lastVertexHandle.trigger('dragmove')

    expect(polyline.points).toHaveBeenLastCalledWith([100, 50, 250, 50, 210, 175])

    lastVertexHandle.trigger('dragend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 420, y: 350 },
        ],
      },
    })
  })

  it('does not commit a polyline vertex drag that creates a segment below 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')
    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.x(103)
    middleVertexHandle.y(50)
    middleVertexHandle.trigger('dragmove')

    expect(polyline.points).toHaveBeenLastCalledWith([100, 50, 103, 50, 200, 150])

    middleVertexHandle.trigger('dragend')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('hides and restores selected polyline vertex handles while dragging the whole region', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polylineRegion()],
    })
    await flushImageLoad()

    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-2)

    polyline.trigger('dragstart')

    vertexHandles.forEach((handle) => {
      expect(handle.visible).toHaveBeenLastCalledWith(false)
    })

    polyline.trigger('dragend')

    vertexHandles.forEach((handle) => {
      expect(handle.visible).toHaveBeenLastCalledWith(true)
    })
  })

  it('emits updated polyline points after vertex editing', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polylineRegion()],
    })
    await flushImageLoad()

    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')
    const firstVertexHandle = getCircleInstances().slice(-2)[0]

    firstVertexHandle.x(75)
    firstVertexHandle.y(90)
    firstVertexHandle.trigger('dragmove')

    expect(polyline.points).toHaveBeenLastCalledWith([75, 90, 250, 50])

    firstVertexHandle.trigger('dragend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 150, y: 180 },
          { x: 500, y: 100 },
        ],
      },
    })
  })

  it('does not add a point on single click of a selected polyline segment', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('adds a point to the double-clicked segment of an already selected polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 300, y: 104 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('does not insert a polyline segment point that would create a segment below 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 101, y: 50 })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('adds a point on the first double-click after selecting a polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: null,
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    polyline.trigger('click', { evt: { detail: 1 } })
    await wrapper.setProps({ selectedRegionId: 'region-1' })

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('click', { evt: { detail: 1 } })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 300, y: 104 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
  })

  it('adds a point before the first point when the first polyline endpoint is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 160, y: 280 },
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
  })

  it('does not extend a selected polyline endpoint when the new segment is below 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 99, y: 50 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('allows selected polyline endpoint extension at 4 visible px', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 96, y: 50 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 192, y: 100 },
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('adds a point after the last point when the last polyline endpoint is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const lastVertexHandle = getCircleInstances().slice(-3).at(-1)

    lastVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 260, y: 180 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
          { x: 520, y: 360 },
        ],
      },
    })
  })

  it('does not add an endpoint point when a middle polyline point is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')).toBeUndefined()
    expect(wrapper.emitted('clear-selected-region')).toEqual([[]])
  })

  it('selects an endpoint before allowing a later document click to extend the polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('inserts a new polyline point between the correct segment endpoints', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 225, y: 100 })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 450, y: 200 },
      { x: 400, y: 300 },
    ])
  })

  it('does not add a point when double-clicking a non-selected polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: null,
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('click', { evt: { detail: 1 } })
    await wrapper.setProps({ selectedRegionId: 'region-1' })
    polyline.trigger('click', { evt: { detail: 2 } })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('select-region')).toEqual([['region-1'], ['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('does not add a point when double-clicking far from all selected polyline segments', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 10, y: 200 })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('does not add an endpoint point outside the visible document', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: -10, y: 50 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')).toBeUndefined()
    expect(wrapper.emitted('clear-selected-region')).toEqual([[]])
  })

  it('does not add an endpoint point after dragging the selected polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    firstVertexHandle.trigger('click')
    polyline.trigger('dragstart')
    polyline.trigger('dragend')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('click')

    expect(wrapper.emitted('update-region')).toHaveLength(1)
    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('does not add a point when clicking or double-clicking an existing polyline vertex handle', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.trigger('click')
    middleVertexHandle.trigger('dblclick')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('does not add a point after dragging the selected polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('dragstart')
    polyline.trigger('dragend')
    polyline.trigger('dblclick')

    expect(wrapper.emitted('update-region')).toHaveLength(1)
    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('does not add a point after dragging the selected polygon', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('dragstart')
    polygon.trigger('dragend')
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')).toHaveLength(1)
    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('selects a polyline vertex handle without bubbling to the canvas', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const middleVertexHandle = getCircleInstances().slice(-3)[1]
    const event = {}

    middleVertexHandle.trigger('click', event)

    expect(event.cancelBubble).toBe(true)
    expect(middleVertexHandle.fill).toHaveBeenLastCalledWith('#0d6efd')
  })

  it('selects a polygon vertex handle without bubbling to the canvas', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const secondVertexHandle = getCircleInstances().slice(-4)[1]
    const event = {}

    secondVertexHandle.trigger('click', event)

    expect(event.cancelBubble).toBe(true)
    expect(secondVertexHandle.fill).toHaveBeenLastCalledWith('#0d6efd')
  })

  it('selects a different polyline vertex handle when dragging starts', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-3)

    vertexHandles[0].trigger('click')
    vertexHandles[2].trigger('mousedown')
    vertexHandles[2].x(210)
    vertexHandles[2].y(175)
    vertexHandles[2].trigger('dragmove')
    vertexHandles[2].trigger('dragend')

    expect(vertexHandles[0].fill).toHaveBeenLastCalledWith('#ffffff')
    expect(vertexHandles[2].fill).toHaveBeenLastCalledWith('#0d6efd')
    expect(polyline.points).toHaveBeenLastCalledWith([100, 50, 250, 50, 210, 175])
    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 420, y: 350 },
        ],
      },
    })
  })

  it('selects a different polygon vertex handle when dragging starts', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-4)

    vertexHandles[0].trigger('click')
    vertexHandles[2].trigger('mousedown')
    vertexHandles[2].x(260)
    vertexHandles[2].y(170)
    vertexHandles[2].trigger('dragmove')
    vertexHandles[2].trigger('dragend')

    expect(vertexHandles[0].fill).toHaveBeenLastCalledWith('#ffffff')
    expect(vertexHandles[2].fill).toHaveBeenLastCalledWith('#0d6efd')
    expect(polygon.points).toHaveBeenLastCalledWith([100, 50, 250, 50, 260, 170, 100, 150])
    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 520, y: 340 },
          { x: 200, y: 300 },
        ],
      },
    })
  })

  it('removes a selected polyline point with Delete', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
    expect(wrapper.emitted('delete-selected-region')).toBeUndefined()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
  })

  it('removes a selected polyline point with Backspace', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      },
    })
    expect(wrapper.emitted('delete-selected-region')).toBeUndefined()
  })

  it('removes a selected polygon point with Delete', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const secondVertexHandle = getCircleInstances().slice(-4)[1]

    secondVertexHandle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 300 },
          { x: 200, y: 300 },
        ],
      },
    })
    expect(wrapper.emitted('delete-selected-region')).toBeUndefined()
  })

  it('removes a selected polygon point with Backspace', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-4)[0]

    firstVertexHandle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        points: [
          { x: 500, y: 100 },
          { x: 500, y: 300 },
          { x: 200, y: 300 },
        ],
      },
    })
    expect(wrapper.emitted('delete-selected-region')).toBeUndefined()
  })

  it('deletes the whole polyline when deleting a selected point from a two-point polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polylineRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-2)[0]

    firstVertexHandle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('deletes the whole polygon when deleting a selected point from a three-point polygon', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('keeps deleting the selected region when no polyline point is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('keeps deleting the selected region when no polygon point is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('clears the selected point-region point when another region is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [
        threePointPolylineRegion(),
        rectangleRegion({ id: 'region-2' }),
      ],
    })
    await flushImageLoad()

    const middleVertexHandle = getCircleInstances().slice(-3)[1]
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-2')

    middleVertexHandle.trigger('click')
    rectangle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('select-region')).toEqual([['region-1'], ['region-2']])
    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('clears the selected polygon point when another region is selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [
        fourPointPolygonRegion(),
        rectangleRegion({ id: 'region-2' }),
      ],
    })
    await flushImageLoad()

    const secondVertexHandle = getCircleInstances().slice(-4)[1]
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-2')

    secondVertexHandle.trigger('click')
    rectangle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('select-region')).toEqual([['region-1'], ['region-2']])
    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('emits clear-selected-region when Escape is pressed in select mode', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('clear-selected-region')).toEqual([[]])
  })

  it('cancels active point-region drafts when Escape is pressed', async () => {
    const polygonWrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    let stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(polygonWrapper.emitted('add-region')).toBeUndefined()

    polygonWrapper.unmount()
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Line.mockClear()
    Konva.Transformer.mockClear()

    const polylineWrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(polylineWrapper.emitted('add-region')).toBeUndefined()
  })

  it('confirms active polygon and polyline drafts when Enter is pressed', async () => {
    const polygonWrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    let stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(polygonWrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({ type: 'polygon' })
    )
    expect(polygonWrapper.emitted('select-region')).toBeUndefined()

    polygonWrapper.unmount()
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Line.mockClear()
    Konva.Transformer.mockClear()

    const polylineWrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(polylineWrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({ type: 'polyline' })
    )
    expect(polylineWrapper.emitted('select-region')).toBeUndefined()
  })

  it('emits delete-selected-region when Delete is pressed', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
  })

  it('emits delete-selected-region when Backspace is pressed', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
  })

  it('warns when activeTool is outside the supported viewer tools', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mountCanvas({ activeTool: 'freehand' })

    expect(warnSpy.mock.calls[0][0]).toContain(
      'Invalid prop: custom validator check failed for prop "activeTool"'
    )
    warnSpy.mockRestore()
  })
})
