import { beforeEach, describe, expect, it } from 'vitest'
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
    x: 200,
    y: 100,
    width: 300,
    height: 200,
    color: '#0d6efd',
    ...overrides,
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
        x: 200,
        y: 100,
        width: 300,
        height: 200,
      })
    )
    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
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
        x: 200,
        y: 100,
        width: 300,
        height: 200,
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
        x: 240,
        y: 160,
        width: 300,
        height: 200,
      },
    })
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
        x: 0,
        y: 800,
        width: 300,
        height: 200,
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
        x: 200,
        y: 100,
        width: 600,
        height: 300,
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
    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
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
        radius: 5,
        draggable: true,
        strokeScaleEnabled: false,
      })
    )
  })
})
