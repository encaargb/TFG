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
      schemaPublications: [],
      ...props,
    },
  })
}

const sampleSchemaPublications = [
  {
    id: '58',
    name: 'VLT: Morphology: Framing Structure (v.2)',
    annotations: {
      children: [
        {
          id: 'annotation-class-1',
          name: 'Attentional Types',
          type: 'ANNOTATION-CLASS',
          children: [
            {
              id: 'annotation-1',
              name: 'Macro',
              type: 'ANNOTATION',
              'taxonomy-path': '58/annotation-class-1/annotation-1',
              children: [],
            },
          ],
        },
      ],
    },
  },
]

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
    annotations: [],
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
    annotations: [],
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
    annotations: [],
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

async function drawPointRegionWithDoubleClick(activeTool, props = {}) {
  const wrapper = mountCanvas({ activeTool, ...props })
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

async function changeCanvasPage(wrapper, pageIndex = 1) {
  await wrapper.setProps({
    selectedPage: `/page-${pageIndex + 1}.png`,
    pageIndex,
  })
  await flushImageLoad()
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

function createContextMenuEvent(overrides = {}) {
  return {
    evt: {
      clientX: 150,
      clientY: 52,
      preventDefault: vi.fn(),
      ...overrides,
    },
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
      regions: [rectangleRegion({ color: '#ff00aa' })],
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
        anchorStroke: '#ff00aa',
        anchorStrokeWidth: 2,
        borderStroke: '#ff00aa',
      })
    )
  })

  it('adds region bodies in ascending z-index order', async () => {
    mountCanvas({
      regions: [
        rectangleRegion({ id: 'front-region', zIndex: 20 }),
        rectangleRegion({ id: 'back-region', zIndex: 2 }),
        rectangleRegion({ id: 'middle-region', zIndex: 10 }),
      ],
    })
    await flushImageLoad()

    const addedRegionIds = getLayerInstances().at(-1).add.mock.calls
      .map(([node]) => node.config?.id)
      .filter(Boolean)

    expect(addedRegionIds).toEqual(['back-region', 'middle-region', 'front-region'])
  })

  it('uses array order as the visual fallback for equal z-index values', async () => {
    mountCanvas({
      regions: [
        rectangleRegion({ id: 'earlier-region', zIndex: 4 }),
        rectangleRegion({ id: 'later-region', zIndex: 4 }),
      ],
    })
    await flushImageLoad()

    const addedRegionIds = getLayerInstances().at(-1).add.mock.calls
      .map(([node]) => node.config?.id)
      .filter(Boolean)

    expect(addedRegionIds).toEqual(['earlier-region', 'later-region'])
  })

  it('keeps selected polygon vertex handles above every body node', async () => {
    mountCanvas({
      selectedRegionId: 'selected-region',
      regions: [
        rectangleRegion({ id: 'top-body', zIndex: 10 }),
        fourPointPolygonRegion({ id: 'selected-region', zIndex: 1 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances().at(-1)
    const addedNodes = regionLayer.add.mock.calls.map(([node]) => node)
    const selectedBodyIndex = addedNodes.findIndex((node) => node.config?.id === 'selected-region')
    const topBodyIndex = addedNodes.findIndex((node) => node.config?.id === 'top-body')
    const firstHandleIndex = addedNodes.findIndex((node) => getCircleInstances().includes(node))

    expect(selectedBodyIndex).toBeLessThan(firstHandleIndex)
    expect(topBodyIndex).toBeLessThan(firstHandleIndex)
  })

  it('keeps the rectangle transformer above every body node', async () => {
    mountCanvas({
      selectedRegionId: 'selected-region',
      regions: [
        rectangleRegion({ id: 'top-body', zIndex: 10 }),
        rectangleRegion({ id: 'selected-region', zIndex: 1 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances().at(-1)
    const addedNodes = regionLayer.add.mock.calls.map(([node]) => node)
    const transformer = getTransformerInstances().at(-1)
    const transformerIndex = addedNodes.indexOf(transformer)
    const bodyIndexes = addedNodes
      .map((node, index) => (node.config?.id ? index : -1))
      .filter((index) => index !== -1)

    expect(Math.max(...bodyIndexes)).toBeLessThan(transformerIndex)
  })

  it('does not mutate the regions prop while sorting for render', async () => {
    const regions = [
      rectangleRegion({ id: 'front-region', zIndex: 20 }),
      rectangleRegion({ id: 'back-region', zIndex: 2 }),
    ]
    const originalRegions = structuredClone(regions)

    mountCanvas({ regions })
    await flushImageLoad()

    expect(regions).toEqual(originalRegions)
  })

  it('selects and cycles precise overlapping hits from front to back', async () => {
    const wrapper = mountCanvas({
      regions: [
        rectangleRegion({ id: 'rectangle-low', zIndex: 1 }),
        polylineRegion({
          id: 'polyline-middle',
          zIndex: 2,
          points: [
            { x: 200, y: 150 },
            { x: 500, y: 150 },
          ],
        }),
        fourPointPolygonRegion({ id: 'polygon-high', zIndex: 3 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })

    stage.trigger('click')
    stage.trigger('click')
    stage.trigger('click')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['polygon-high'],
      ['polyline-middle'],
      ['rectangle-low'],
      ['polygon-high'],
    ])
    expect(wrapper.emitted('selection-overlap-change')).toEqual([[2], [2], [2], [2]])
  })

  it('uses z-index and equal-value fallback rather than candidate retrieval order', async () => {
    const wrapper = mountCanvas({
      regions: [
        rectangleRegion({ id: 'earlier-equal', zIndex: 4 }),
        rectangleRegion({ id: 'later-equal', zIndex: 4 }),
        rectangleRegion({ id: 'highest', zIndex: 8 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })

    stage.trigger('click')
    stage.trigger('click')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['highest'],
      ['later-equal'],
      ['earlier-equal'],
    ])
  })

  it('resets cycling when the click position or precise hit set changes', async () => {
    const wrapper = mountCanvas({
      regions: [
        rectangleRegion({ id: 'back', zIndex: 1 }),
        rectangleRegion({ id: 'front', zIndex: 2 }),
        rectangleRegion({ id: 'separate', zIndex: 3, left: 800, top: 100, right: 900, bottom: 200 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    stage.trigger('click')
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 156, y: 75 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 425, y: 75 })
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['front'],
      ['back'],
      ['front'],
      ['separate'],
    ])
  })

  it('clears selection and overlap context when clicking empty canvas', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion({ zIndex: 0 })],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 10, y: 10 })
    stage.trigger('click')

    expect(wrapper.emitted('selection-overlap-change')).toEqual([[0]])
    expect(wrapper.emitted('clear-selected-region')).toEqual([[]])
  })

  it('rejects polygon and polyline bounding-box false positives', async () => {
    const wrapper = mountCanvas({
      regions: [
        polygonRegion({ id: 'polygon-1', zIndex: 2 }),
        threePointPolylineRegion({
          id: 'polyline-1',
          zIndex: 1,
          points: [
            { x: 900, y: 100 },
            { x: 1200, y: 100 },
            { x: 1200, y: 300 },
          ],
        }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 110, y: 140 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 525, y: 100 })
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toBeUndefined()
    expect(wrapper.emitted('clear-selected-region')).toEqual([[], []])
  })

  it('selects polygon edges and keeps polyline tolerance visually consistent across zoom', async () => {
    const polygonWrapper = mountCanvas({
      regions: [fourPointPolygonRegion({ id: 'polygon-1', zIndex: 1 })],
    })
    await flushImageLoad()

    let stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 50 })
    stage.trigger('click')

    expect(polygonWrapper.emitted('select-region')).toEqual([['polygon-1']])

    polygonWrapper.unmount()
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Line.mockClear()
    Konva.Transformer.mockClear()
    Konva.Circle.mockClear()

    const polylineWrapper = mountCanvas({
      zoomLevel: 2,
      regions: [polylineRegion({ id: 'polyline-1', zIndex: 1 })],
    })
    await flushImageLoad()

    stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 300, y: 107 })
    stage.trigger('click')

    expect(polylineWrapper.emitted('select-region')).toEqual([['polyline-1']])
  })

  it('returns a large cross-quadrant candidate only once in the selection set', async () => {
    const wrapper = mountCanvas({
      regions: [
        rectangleRegion({
          id: 'large-region',
          zIndex: 1,
          left: 100,
          top: 100,
          right: 1900,
          bottom: 900,
        }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 500, y: 250 })
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['large-region']])
    expect(wrapper.emitted('selection-overlap-change')).toEqual([[0]])
  })

  it('uses updated page geometry after page and region changes', async () => {
    const wrapper = mountCanvas({
      regions: [
        rectangleRegion({ id: 'page-0-region', pageIndex: 0, zIndex: 1 }),
        rectangleRegion({ id: 'page-1-region', pageIndex: 1, zIndex: 1 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    stage.trigger('click')

    await changeCanvasPage(wrapper, 1)
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    stage.trigger('click')

    await wrapper.setProps({
      regions: [
        rectangleRegion({ id: 'page-0-region', pageIndex: 0, zIndex: 1 }),
        rectangleRegion({ id: 'page-1-region', pageIndex: 1, zIndex: 1, left: 800, right: 900 }),
      ],
    })
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['page-0-region'],
      ['page-1-region'],
    ])
    expect(wrapper.emitted('clear-selected-region')).toEqual([[]])
  })

  it('uses colour, z-index, and zoom changes without rebuilding spatial geometry', async () => {
    const wrapper = mountCanvas({
      regions: [
        rectangleRegion({ id: 'back', zIndex: 1, color: '#0d6efd' }),
        rectangleRegion({ id: 'front', zIndex: 2, color: '#ff00aa' }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    stage.trigger('click')

    await wrapper.setProps({
      regions: [
        rectangleRegion({ id: 'back', zIndex: 5, color: '#00ff88' }),
        rectangleRegion({ id: 'front', zIndex: 2, color: '#ff00aa' }),
      ],
    })
    stage.trigger('click')

    await wrapper.setProps({ zoomLevel: 1.25 })
    stage.getPointerPosition.mockReturnValue({ x: 187.5, y: 93.75 })
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['front'],
      ['back'],
      ['back'],
    ])
  })

  it('does not advance cycling on drag, transform, or vertex drag interactions', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'polygon-front',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        fourPointPolygonRegion({ id: 'polygon-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')
    const polygon = getLineInstances().find((line) => line.config.id === 'polygon-front')
    const vertexHandle = getCircleInstances().at(0)

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    stage.trigger('click')
    rectangle.trigger('dragstart')
    rectangle.trigger('dragend')
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')
    polygon.trigger('dragstart')
    polygon.trigger('dragend')
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')
    vertexHandle.trigger('dragstart')
    vertexHandle.trigger('dragend')
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['polygon-front'],
      ['rectangle-back'],
      ['polygon-front'],
      ['polygon-front'],
      ['polygon-front'],
      ['polygon-front'],
    ])
  })

  it('selects the exact unselected rectangle on dragstart without advancing cycling', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    stage.trigger('mousedown')
    rectangleBack.trigger('dragstart')
    rectangleBack.trigger('dragend')

    expect(wrapper.emitted('select-region')).toEqual([['rectangle-back']])
    expect(wrapper.emitted('selection-overlap-change')).toEqual([[0]])
  })

  it('defers full rendering while an unselected dragged rectangle becomes selected', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')
    const rectangleFront = getRectInstances().find((rect) => rect.config.id === 'rectangle-front')
    const bodyOrderBeforeDrag = getRectInstances()
      .map((rect) => rect.config.id)
      .filter(Boolean)
    const oldTransformer = getTransformerInstances().at(-1)
    regionLayer.destroyChildren.mockClear()

    rectangleBack.trigger('dragstart')
    await wrapper.setProps({ selectedRegionId: 'rectangle-back' })

    expect(wrapper.emitted('select-region')).toEqual([['rectangle-back']])
    expect(rectangleFront.strokeWidth).toHaveBeenLastCalledWith(2)
    expect(rectangleBack.strokeWidth).toHaveBeenLastCalledWith(3)
    expect(oldTransformer.nodes).toHaveBeenLastCalledWith([])
    expect(oldTransformer.destroy).toHaveBeenCalledTimes(1)
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()
    expect(regionLayer.batchDraw).toHaveBeenCalled()
    expect(rectangleBack.destroy).not.toHaveBeenCalled()
    expect(rectangleFront.destroy).not.toHaveBeenCalled()
    expect(getRectInstances().map((rect) => rect.config.id).filter(Boolean)).toEqual(
      bodyOrderBeforeDrag
    )
    expect(getTransformerInstances()).toHaveLength(1)

    rectangleBack.x(130)
    rectangleBack.y(90)
    rectangleBack.trigger('dragmove')
    expect(rectangleBack.x()).toBe(130)
    expect(rectangleBack.y()).toBe(90)
    rectangleBack.trigger('dragend')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'rectangle-back',
      changes: {
        left: 260,
        top: 180,
        right: 560,
        bottom: 380,
      },
    })
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    await wrapper.setProps({
      regions: [
        rectangleRegion({
          id: 'rectangle-back',
          zIndex: 1,
          left: 260,
          top: 180,
          right: 560,
          bottom: 380,
        }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
    expect(getTransformerInstances().at(-1)).not.toBe(oldTransformer)
    expect(
      [...getRectInstances()].reverse().find((rect) => rect.config.id === 'rectangle-back').config
    ).toEqual(expect.objectContaining({ strokeWidth: 3 }))
    expect(wrapper.props('selectedRegionId')).toBe('rectangle-back')
  })

  it('coalesces repeated render requests during an active rectangle drag', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')
    regionLayer.destroyChildren.mockClear()

    rectangleBack.trigger('dragstart')
    await wrapper.setProps({ selectedRegionId: 'rectangle-back' })
    await wrapper.setProps({
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1, color: '#ff00aa' }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    rectangleBack.trigger('dragend')
    await wrapper.setProps({
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1, color: '#ff00aa' }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('keeps the dragged rectangle selected and allows the first later intentional click', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    rectangleBack.trigger('dragstart')
    rectangleBack.trigger('dragend')
    await wrapper.setProps({ selectedRegionId: 'rectangle-back' })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['rectangle-back'],
      ['rectangle-front'],
    ])
  })

  it('allows the first intentional click after polygon dragging', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        fourPointPolygonRegion({ id: 'polygon-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygonBack = getLineInstances().find((line) => line.config.id === 'polygon-back')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    polygonBack.trigger('dragstart')
    polygonBack.trigger('dragend')
    await wrapper.setProps({ selectedRegionId: 'polygon-back' })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['polygon-back'],
      ['rectangle-front'],
    ])
  })

  it('allows the first intentional click after polyline dragging', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        polylineRegion({ id: 'polyline-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polylineBack = getLineInstances().find((line) => line.config.id === 'polyline-back')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polylineBack.trigger('dragstart')
    polylineBack.trigger('dragend')
    await wrapper.setProps({ selectedRegionId: 'polyline-back' })
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['polyline-back'],
      ['rectangle-front'],
    ])
  })

  it('allows the first intentional click after rectangle transformation', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-back',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 75 })
    rectangleBack.trigger('transformstart')
    rectangleBack.trigger('transformend')
    stage.trigger('mousedown')
    stage.trigger('mouseup')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['rectangle-front']])
  })

  it('selects the exact unselected polygon on dragstart and resets overlap context', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'polygon-front',
      regions: [
        fourPointPolygonRegion({ id: 'polygon-back', zIndex: 1 }),
        rectangleRegion({ id: 'polygon-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const polygonBack = getLineInstances().find((line) => line.config.id === 'polygon-back')

    polygonBack.trigger('dragstart')

    expect(wrapper.emitted('select-region')).toEqual([['polygon-back']])
    expect(wrapper.emitted('selection-overlap-change')).toEqual([[0]])
  })

  it('defers full rendering during polygon body dragging', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        fourPointPolygonRegion({ id: 'polygon-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const polygonBack = getLineInstances().find((line) => line.config.id === 'polygon-back')
    const transformerBeforeDrag = getTransformerInstances().at(-1)
    regionLayer.destroyChildren.mockClear()

    polygonBack.trigger('dragstart')
    await wrapper.setProps({ selectedRegionId: 'polygon-back' })

    expect(transformerBeforeDrag.destroy).toHaveBeenCalledTimes(1)
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    polygonBack.x(20)
    polygonBack.y(10)
    polygonBack.trigger('dragmove')
    polygonBack.trigger('dragend')
    await wrapper.setProps({
      regions: [
        fourPointPolygonRegion({
          id: 'polygon-back',
          zIndex: 1,
          points: [
            { x: 240, y: 120 },
            { x: 540, y: 120 },
            { x: 540, y: 320 },
            { x: 240, y: 320 },
          ],
        }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
    expect(getCircleInstances().slice(-4)).toHaveLength(4)
  })

  it('removes old polygon handles without creating new handles during another polygon body drag', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'polygon-a',
      regions: [
        fourPointPolygonRegion({ id: 'polygon-a', zIndex: 2 }),
        fourPointPolygonRegion({ id: 'polygon-b', zIndex: 1 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const polygonA = getLineInstances().find((line) => line.config.id === 'polygon-a')
    const polygonB = getLineInstances().find((line) => line.config.id === 'polygon-b')
    const oldHandles = getCircleInstances().slice(-4)
    regionLayer.destroyChildren.mockClear()

    polygonB.trigger('dragstart')
    await wrapper.setProps({ selectedRegionId: 'polygon-b' })

    oldHandles.forEach((handle) => {
      expect(handle.destroy).toHaveBeenCalledTimes(1)
    })
    expect(polygonA.strokeWidth).toHaveBeenLastCalledWith(2)
    expect(polygonB.strokeWidth).toHaveBeenLastCalledWith(3)
    expect(getCircleInstances()).toHaveLength(4)
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()
    expect(polygonB.destroy).not.toHaveBeenCalled()

    polygonB.x(20)
    polygonB.y(10)
    polygonB.trigger('dragmove')
    polygonB.trigger('dragend')
    await wrapper.setProps({
      regions: [
        fourPointPolygonRegion({ id: 'polygon-a', zIndex: 2 }),
        fourPointPolygonRegion({
          id: 'polygon-b',
          zIndex: 1,
          points: [
            { x: 240, y: 120 },
            { x: 540, y: 120 },
            { x: 540, y: 320 },
            { x: 240, y: 320 },
          ],
        }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
    expect(getCircleInstances()).toHaveLength(8)
    expect(getCircleInstances().slice(-4)).not.toEqual(oldHandles)
  })

  it('selects the exact unselected polyline on dragstart', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        polylineRegion({ id: 'polyline-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const polylineBack = getLineInstances().find((line) => line.config.id === 'polyline-back')

    polylineBack.trigger('dragstart')

    expect(wrapper.emitted('select-region')).toEqual([['polyline-back']])
    expect(wrapper.emitted('selection-overlap-change')).toEqual([[0]])
  })

  it('destroys selected polygon handles when a rectangle body starts dragging', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'polygon-a',
      regions: [
        fourPointPolygonRegion({ id: 'polygon-a', zIndex: 2 }),
        rectangleRegion({ id: 'rectangle-b', zIndex: 1 }),
      ],
    })
    await flushImageLoad()

    const rectangleB = getRectInstances().find((rect) => rect.config.id === 'rectangle-b')
    const oldHandles = getCircleInstances().slice(-4)

    rectangleB.trigger('dragstart')

    oldHandles.forEach((handle) => {
      expect(handle.destroy).toHaveBeenCalledTimes(1)
    })
    expect(wrapper.emitted('select-region')).toEqual([['rectangle-b']])
  })

  it('defers full rendering during polyline body dragging', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        polylineRegion({ id: 'polyline-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const polylineBack = getLineInstances().find((line) => line.config.id === 'polyline-back')
    const transformerBeforeDrag = getTransformerInstances().at(-1)
    regionLayer.destroyChildren.mockClear()

    polylineBack.trigger('dragstart')
    await wrapper.setProps({ selectedRegionId: 'polyline-back' })

    expect(transformerBeforeDrag.destroy).toHaveBeenCalledTimes(1)
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    polylineBack.trigger('dragend')
    await wrapper.setProps({
      regions: [
        polylineRegion({
          id: 'polyline-back',
          zIndex: 1,
          points: [
            { x: 200, y: 100 },
            { x: 500, y: 100 },
          ],
        }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('clears a selected point from another region when dragging a point region', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'polyline-a',
      regions: [
        threePointPolylineRegion({ id: 'polyline-a', zIndex: 1 }),
        threePointPolylineRegion({ id: 'polyline-b', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]
    const polylineB = getLineInstances().find((line) => line.config.id === 'polyline-b')

    firstVertexHandle.trigger('click')
    polylineB.trigger('dragstart')
    polylineB.trigger('dragend')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('click')
    stage.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([
      ['polyline-a'],
      ['polyline-b'],
    ])
    expect(wrapper.emitted('update-region')).toHaveLength(1)
    expect(wrapper.emitted('update-region')[0][0].id).toBe('polyline-b')
  })

  it('keeps an already selected dragged region selected and does not change visual order', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-back',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionIdsBeforeDrag = getRectInstances()
      .map((rect) => rect.config.id)
      .filter(Boolean)
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')
    const transformerBeforeDrag = getTransformerInstances().at(-1)

    rectangleBack.trigger('dragstart')

    const regionIdsAfterDrag = getRectInstances()
      .map((rect) => rect.config.id)
      .filter(Boolean)

    expect(wrapper.emitted('select-region')).toEqual([['rectangle-back']])
    expect(rectangleBack.strokeWidth).toHaveBeenLastCalledWith(3)
    expect(transformerBeforeDrag.destroy).toHaveBeenCalledTimes(1)
    expect(regionIdsAfterDrag).toEqual(regionIdsBeforeDrag)
    expect(wrapper.props('regions').map((region) => region.zIndex)).toEqual([1, 2])
  })

  it('defers full rendering while dragging an already selected region', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-back',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')
    regionLayer.destroyChildren.mockClear()

    rectangleBack.trigger('dragstart')
    await wrapper.setProps({
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1, color: '#ff00aa' }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    rectangleBack.trigger('dragend')
    await wrapper.setProps({
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1, color: '#ff00aa' }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('normal clicks still render selection changes immediately', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: null,
      regions: [rectangleRegion({ id: 'rectangle-1', zIndex: 0 })],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'rectangle-1')
    regionLayer.destroyChildren.mockClear()

    rectangle.trigger('click')
    await wrapper.setProps({ selectedRegionId: 'rectangle-1' })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('renders geometry changes immediately outside an active interaction', async () => {
    const wrapper = mountCanvas({
      regions: [rectangleRegion({ id: 'rectangle-1', zIndex: 0 })],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    regionLayer.destroyChildren.mockClear()

    await wrapper.setProps({
      regions: [rectangleRegion({ id: 'rectangle-1', zIndex: 0, left: 300, right: 600 })],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('defers full rendering during rectangle transformation', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-1',
      regions: [rectangleRegion({ id: 'rectangle-1', zIndex: 0 })],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'rectangle-1')
    const transformer = getTransformerInstances().at(-1)
    regionLayer.destroyChildren.mockClear()
    transformer.destroy.mockClear()

    rectangle.trigger('transformstart')
    await wrapper.setProps({
      regions: [rectangleRegion({ id: 'rectangle-1', zIndex: 0, color: '#ff00aa' })],
    })

    expect(transformer.destroy).not.toHaveBeenCalled()
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    rectangle.trigger('transformend')
    await wrapper.setProps({
      regions: [rectangleRegion({ id: 'rectangle-1', zIndex: 0, color: '#ff00aa' })],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('defers full rendering during vertex dragging', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'polygon-1',
      regions: [fourPointPolygonRegion({ id: 'polygon-1', zIndex: 0 })],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const vertexHandle = getCircleInstances().slice(-4)[0]
    regionLayer.destroyChildren.mockClear()

    vertexHandle.trigger('dragstart')
    await wrapper.setProps({
      regions: [fourPointPolygonRegion({ id: 'polygon-1', zIndex: 0, color: '#ff00aa' })],
    })

    expect(vertexHandle.destroy).not.toHaveBeenCalled()
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    vertexHandle.trigger('dragend')
    await wrapper.setProps({
      regions: [fourPointPolygonRegion({ id: 'polygon-1', zIndex: 0, color: '#ff00aa' })],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
  })

  it('clears pending region renders on page change', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'rectangle-front',
      regions: [
        rectangleRegion({ id: 'rectangle-back', zIndex: 1 }),
        rectangleRegion({ id: 'rectangle-front', zIndex: 2 }),
      ],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangleBack = getRectInstances().find((rect) => rect.config.id === 'rectangle-back')
    regionLayer.destroyChildren.mockClear()

    rectangleBack.trigger('dragstart')
    await wrapper.setProps({ selectedRegionId: 'rectangle-back' })
    await changeCanvasPage(wrapper, 1)

    expect(regionLayer.destroyChildren).toHaveBeenCalled()
  })

  it('updates selected rectangle transformer colors when the region color changes', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion({ color: '#ff00aa' })],
    })
    await flushImageLoad()

    expect(getTransformerInstances().at(-1).config).toEqual(
      expect.objectContaining({
        anchorStroke: '#ff00aa',
        borderStroke: '#ff00aa',
      })
    )

    await wrapper.setProps({
      regions: [rectangleRegion({ color: '#00ff88' })],
    })

    expect(getTransformerInstances().at(-1).config).toEqual(
      expect.objectContaining({
        anchorStroke: '#00ff88',
        borderStroke: '#00ff88',
      })
    )
  })

  it('uses the fallback transformer color when no rectangle is selected', async () => {
    mountCanvas({
      selectedRegionId: null,
      regions: [rectangleRegion({ color: '#ff00aa' })],
    })
    await flushImageLoad()

    expect(getTransformerInstances().at(-1).config).toEqual(
      expect.objectContaining({
        anchorStroke: '#0d6efd',
        borderStroke: '#0d6efd',
      })
    )
  })

  it('uses the fallback transformer color when the selected rectangle has no valid color', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion({ color: 'not-a-color' })],
    })
    await flushImageLoad()

    expect(getTransformerInstances().at(-1).config).toEqual(
      expect.objectContaining({
        anchorStroke: '#0d6efd',
        borderStroke: '#0d6efd',
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

  it.each(['rectangle', 'polygon', 'polyline'])(
    'sets the creation cursor inside the visible document for the %s tool',
    async (activeTool) => {
      mountCanvas({ activeTool })
      await flushImageLoad()

      const stage = getLatestStage()

      stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
      stage.trigger('mousemove')

      expect(stage.container().style.cursor).toBe('crosshair')
    }
  )

  it('resets the creation cursor outside the visible document', async () => {
    mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousemove')

    expect(stage.container().style.cursor).toBe('crosshair')

    stage.getPointerPosition.mockReturnValue({ x: 1200, y: 50 })
    stage.trigger('mousemove')

    expect(stage.container().style.cursor).toBe('default')
  })

  it('resets the creation cursor when the pointer leaves the canvas', async () => {
    mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousemove')
    stage.trigger('mouseleave')

    expect(stage.container().style.cursor).toBe('default')
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
        annotations: [],
      })
    )
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('x')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('y')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('width')
    expect(wrapper.emitted('add-region')[0][0]).not.toHaveProperty('height')
    expect(wrapper.emitted('select-region')).toBeUndefined()
  })

  it('uses the selected creation color for rectangle drafts and created rectangles', async () => {
    const wrapper = mountCanvas({
      activeTool: 'rectangle',
      regionCreationColor: '#ff00aa',
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    expect(draftRectangle.config).toEqual(
      expect.objectContaining({
        fill: '#ff00aa26',
        stroke: '#ff00aa',
      })
    )

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'rectangle',
        color: '#ff00aa',
      })
    )
  })

  it('falls back to the default region color for invalid creation colors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountCanvas({
      activeTool: 'rectangle',
      regionCreationColor: 'not-a-color',
    })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    expect(draftRectangle.config).toEqual(
      expect.objectContaining({
        fill: '#0d6efd26',
        stroke: '#0d6efd',
      })
    )

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        color: '#0d6efd',
      })
    )

    warnSpy.mockRestore()
  })

  it('uses the selected creation color for polygon drafts and created polygons', async () => {
    const wrapper = mountCanvas({
      activeTool: 'polygon',
      regionCreationColor: '#ff00aa',
    })
    await flushImageLoad()

    const stage = getLatestStage()

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown', { evt: { detail: 1 } })
    stage.trigger('click', { evt: { detail: 1 } })

    const draftPolygon = getLineInstances().at(-1)

    expect(draftPolygon.config).toEqual(
      expect.objectContaining({
        fill: '#ff00aa12',
        stroke: '#ff00aa',
      })
    )

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousedown', { evt: { detail: 1 } })
    stage.trigger('click', { evt: { detail: 1 } })

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('mousedown', { evt: { detail: 1 } })
    stage.trigger('click', { evt: { detail: 1 } })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polygon',
        color: '#ff00aa',
      })
    )
  })

  it('uses the selected creation color for polyline drafts and created polylines', async () => {
    const wrapper = await drawPointRegionWithDoubleClick('polyline', {
      regionCreationColor: '#ff00aa',
    })

    const draftPolyline = getLineInstances().find((line) => line.config.dash)

    expect(draftPolyline.config).toEqual(
      expect.objectContaining({
        fill: 'transparent',
        stroke: '#ff00aa',
      })
    )
    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        type: 'polyline',
        color: '#ff00aa',
      })
    )
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

  it('emits a rectangle that reaches the minimum visible size at high zoom', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle', zoomLevel: 10 })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 104, y: 54 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')

    expect(wrapper.emitted('add-region')[0][0]).toEqual(
      expect.objectContaining({
        left: 20,
        top: 10,
        right: 21,
        bottom: 11,
      })
    )
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

  it('destroys and recreates the transformer while dragging a selected rectangle body', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')
    const transformer = getTransformerInstances().at(-1)
    regionLayer.destroyChildren.mockClear()

    rectangle.trigger('dragstart')

    expect(transformer.nodes).toHaveBeenLastCalledWith([])
    expect(transformer.destroy).toHaveBeenCalledTimes(1)
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    rectangle.trigger('dragend')
    await wrapper.setProps({
      regions: [
        rectangleRegion({
          left: 200,
          top: 100,
          right: 500,
          bottom: 300,
        }),
      ],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
    expect(getTransformerInstances().at(-1)).not.toBe(transformer)
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

  it('cancels an unfinished rectangle when the page changes', async () => {
    const wrapper = mountCanvas({ activeTool: 'rectangle' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    const draftRectangle = getRectInstances().at(-1)

    await changeCanvasPage(wrapper)
    stage.trigger('mouseup')

    expect(draftRectangle.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.props('activeTool')).toBe('rectangle')
  })

  it('cancels an unfinished polygon when the page changes', async () => {
    const wrapper = mountCanvas({ activeTool: 'polygon' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown', { evt: { detail: 1 } })
    stage.trigger('click', { evt: { detail: 1 } })
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('mousemove')

    const draftPolygon = getLineInstances().at(-1)

    await changeCanvasPage(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(draftPolygon.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.props('activeTool')).toBe('polygon')
  })

  it('cancels an unfinished polyline when the page changes', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown', { evt: { detail: 1 } })
    stage.trigger('click', { evt: { detail: 1 } })

    const draftPolyline = getLineInstances().at(-1)

    await changeCanvasPage(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(draftPolyline.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('add-region')).toBeUndefined()
    expect(wrapper.props('activeTool')).toBe('polyline')
  })

  it('clears pending point-region drag state when the page changes', async () => {
    const wrapper = mountCanvas({ activeTool: 'polyline' })
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown', { evt: { detail: 1 } })

    await changeCanvasPage(wrapper)

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mouseup')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('add-region')).toBeUndefined()
  })

  it('clears selected point-region vertices when the page changes', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const vertexHandle = getCircleInstances().slice(-4)[0]
    vertexHandle.trigger('click')

    await changeCanvasPage(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(wrapper.emitted('update-region')).toBeUndefined()
    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
  })

  it('clears pending polyline endpoint extension state when the page changes', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]
    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('mousemove')

    const previewLine = getLineInstances().find((line) => line.config.listening === false)

    await changeCanvasPage(wrapper)
    stage.getPointerPosition.mockReturnValue({ x: 70, y: 130 })
    stage.trigger('click')

    expect(previewLine.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('clears temporary hover cursor state when the page changes', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const vertexHandle = getCircleInstances().slice(-3)[0]
    vertexHandle.trigger('mouseenter')

    expect(stage.container().style.cursor).toBe('grab')

    await changeCanvasPage(wrapper)

    expect(stage.container().style.cursor).toBe('default')
  })

  it('keeps completed regions stored and renders only regions for the new page after a page change', async () => {
    const pageOneRegion = rectangleRegion({ id: 'page-one-region', pageIndex: 0 })
    const pageTwoRegion = rectangleRegion({ id: 'page-two-region', pageIndex: 1 })
    const wrapper = mountCanvas({
      regions: [pageOneRegion, pageTwoRegion],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    regionLayer.add.mockClear()

    await changeCanvasPage(wrapper)

    const renderedRegionIds = regionLayer.add.mock.calls
      .map(([node]) => node?.config?.id)
      .filter(Boolean)

    expect(wrapper.props('regions')).toEqual([pageOneRegion, pageTwoRegion])
    expect(renderedRegionIds).toContain('page-two-region')
    expect(renderedRegionIds).not.toContain('page-one-region')
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

  it('destroys and recreates selected polygon handles while dragging the whole region', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-3)
    regionLayer.destroyChildren.mockClear()

    polygon.trigger('dragstart')

    vertexHandles.forEach((handle) => {
      expect(handle.destroy).toHaveBeenCalledTimes(1)
    })
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    polygon.trigger('dragend')
    await wrapper.setProps({
      regions: [polygonRegion()],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
    expect(getCircleInstances().slice(-3)).not.toEqual(vertexHandles)
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

  it('shows Add point when right-clicking a selected polygon segment', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')
    const event = createContextMenuEvent()

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('contextmenu', event)
    await wrapper.vm.$nextTick()

    expect(event.evt.preventDefault).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.annotation-context-menu').text()).toContain('Add point')
    expect(wrapper.find('.annotation-context-menu').text()).toContain('Delete region')
    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
  })

  it('inserts Add point at the saved segment and pointer position', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()

    stage.getPointerPosition.mockReturnValue({ x: 900, y: 400 })
    await wrapper.find('.annotation-context-menu__item').trigger('click')

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
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(false)
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
    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.find('.annotation-context-menu__item').trigger('click')

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
    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.find('.annotation-context-menu__item').trigger('click')

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
    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.find('.annotation-context-menu__item').trigger('click')

    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 208, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('does not add a point when double-clicking a selected polygon segment', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('dblclick')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('shows only Delete region when right-clicking inside a selected polygon far from an edge', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 183, y: 83 })
    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()

    const menu = wrapper.find('.annotation-context-menu')
    expect(menu.text()).not.toContain('Add point')
    expect(menu.text()).toContain('Delete region')
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('shows Delete point when right-clicking a polygon vertex handle', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-4)[0]
    const event = createContextMenuEvent()

    firstVertexHandle.trigger('contextmenu', event)
    await wrapper.vm.$nextTick()

    expect(event.cancelBubble).toBe(true)
    expect(event.evt.preventDefault).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.find('.annotation-context-menu').text()).toContain('Delete point')
    expect(wrapper.find('.annotation-context-menu').text()).toContain('Delete region')
    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('deletes a point from the context menu when the point region stays valid', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-4)[0]

    firstVertexHandle.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('.annotation-context-menu__item')
      .find((button) => button.text() === 'Delete point')
      .trigger('click')

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
  })

  it('disables Delete point when a point region has the minimum number of points', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polylineRegion()],
    })
    await flushImageLoad()

    const firstVertexHandle = getCircleInstances().slice(-2)[0]

    firstVertexHandle.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()

    const deletePointButton = wrapper
      .findAll('.annotation-context-menu__item')
      .find((button) => button.text() === 'Delete point')

    expect(deletePointButton.attributes('disabled')).toBeDefined()
  })

  it('closes the context menu on outside click and Escape', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(true)

    window.dispatchEvent(new MouseEvent('click'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(false)

    polygon.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.annotation-context-menu').exists()).toBe(false)
  })

  it('deletes a region from the context menu', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('.annotation-context-menu__item')
      .find((button) => button.text() === 'Delete region')
      .trigger('click')

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(false)
  })

  it('shows loaded schema publications in the region context menu', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
      schemaPublications: sampleSchemaPublications,
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()

    const menu = wrapper.find('.annotation-context-menu')
    expect(menu.text()).toContain('Add annotation')

    await wrapper.findAll('.annotation-context-menu__item').find((button) => {
      return button.text() === 'Add annotation'
    }).trigger('click')

    expect(wrapper.find('.annotation-taxonomy-panel').text()).toContain(
      'VLT: Morphology: Framing Structure (v.2)'
    )
  })

  it('keeps annotation class nodes as navigation items without assigning them', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
      schemaPublications: sampleSchemaPublications,
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.annotation-context-menu__item').find((button) => {
      return button.text() === 'Add annotation'
    }).trigger('click')
    await wrapper.findAll('.annotation-taxonomy__item').find((button) => {
      return button.text().includes('Attentional Types')
    }).trigger('click')

    expect(wrapper.emitted('update-region')).toBeUndefined()
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(true)
    expect(wrapper.find('.annotation-taxonomy-panel').text()).toContain('Macro')
  })

  it('assigns an annotation to the context-menu region and closes the menu', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [rectangleRegion()],
      schemaPublications: sampleSchemaPublications,
    })
    await flushImageLoad()

    const rectangle = getRectInstances().find((rect) => rect.config.id === 'region-1')

    rectangle.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.annotation-context-menu__item').find((button) => {
      return button.text() === 'Add annotation'
    }).trigger('click')
    await wrapper.findAll('.annotation-taxonomy__item').find((button) => {
      return button.text().includes('Attentional Types')
    }).trigger('click')
    await wrapper.findAll('.annotation-taxonomy__item').find((button) => {
      return button.text() === 'Macro'
    }).trigger('click')

    expect(wrapper.emitted('update-region')[0][0]).toEqual({
      id: 'region-1',
      changes: {
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: 'annotation-1',
            taxonomyPath: '58/annotation-class-1/annotation-1',
          },
        ],
      },
    })
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(false)
  })

  it('does not block the native context menu outside a region', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polygonRegion()],
    })
    await flushImageLoad()

    const event = createContextMenuEvent()

    getLatestStage().trigger('contextmenu', event)
    await wrapper.vm.$nextTick()

    expect(event.evt.preventDefault).not.toHaveBeenCalled()
    expect(wrapper.find('.annotation-context-menu').exists()).toBe(false)
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

  it('destroys and recreates selected polyline handles while dragging the whole region', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [polylineRegion()],
    })
    await flushImageLoad()

    const regionLayer = getLayerInstances()[1]
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-2)
    regionLayer.destroyChildren.mockClear()

    polyline.trigger('dragstart')

    vertexHandles.forEach((handle) => {
      expect(handle.destroy).toHaveBeenCalledTimes(1)
    })
    expect(regionLayer.destroyChildren).not.toHaveBeenCalled()

    polyline.trigger('dragend')
    await wrapper.setProps({
      regions: [polylineRegion()],
    })

    expect(regionLayer.destroyChildren).toHaveBeenCalledTimes(1)
    expect(getCircleInstances().slice(-2)).not.toEqual(vertexHandles)
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

  it('adds a point to a selected polyline segment from the context menu', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.find('.annotation-context-menu__item').trigger('click')

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
    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
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
    polyline.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.find('.annotation-context-menu__item').trigger('click')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('shows Add point after right-clicking to select a polyline', async () => {
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
    polyline.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select-region')).toEqual([['region-1'], ['region-1']])
    expect(wrapper.find('.annotation-context-menu').text()).toContain('Add point')
    expect(wrapper.emitted('update-region')).toBeUndefined()
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

  it('shows a dashed preview line from the pointer to the first selected polyline endpoint', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('mousemove')

    const previewLine = getLineInstances().find((line) => line.config.listening === false)

    expect(previewLine.config).toEqual(
      expect.objectContaining({
        dash: [6, 4],
        listening: false,
        stroke: '#0d6efd',
      })
    )
    expect(previewLine.points).toHaveBeenLastCalledWith([80, 140, 100, 50])

    stage.getPointerPosition.mockReturnValue({ x: 90, y: 150 })
    stage.trigger('mousemove')

    expect(previewLine.points).toHaveBeenLastCalledWith([90, 150, 100, 50])
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

  it('shows a dashed preview line from the last selected polyline endpoint to the pointer', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const lastVertexHandle = getCircleInstances().slice(-3).at(-1)

    lastVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 260, y: 180 })
    stage.trigger('mousemove')

    const previewLine = getLineInstances().find((line) => line.config.listening === false)

    expect(previewLine.config).toEqual(
      expect.objectContaining({
        dash: [6, 4],
        listening: false,
        stroke: '#0d6efd',
      })
    )
    expect(previewLine.points).toHaveBeenLastCalledWith([200, 150, 260, 180])
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

  it('does not show an endpoint extension preview when a middle polyline point is selected', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('mousemove')

    expect(getLineInstances().some((line) => line.config.listening === false)).toBe(false)
  })

  it('does not show an endpoint extension preview for selected polygon points', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-4)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('mousemove')

    expect(getLineInstances().some((line) => line.config.listening === false)).toBe(false)
  })

  it('clears the endpoint extension preview after clicking to extend the polyline', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('mousemove')

    const previewLine = getLineInstances().find((line) => line.config.listening === false)

    stage.trigger('click')

    expect(previewLine.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 160, y: 280 },
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 400, y: 300 },
    ])
  })

  it('clears the endpoint extension preview when Escape clears selection', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const firstVertexHandle = getCircleInstances().slice(-3)[0]

    firstVertexHandle.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 80, y: 140 })
    stage.trigger('mousemove')

    const previewLine = getLineInstances().find((line) => line.config.listening === false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(previewLine.destroy).toHaveBeenCalledTimes(1)
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
    polyline.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()
    await wrapper.find('.annotation-context-menu__item').trigger('click')

    expect(wrapper.emitted('update-region')[0][0].changes.points).toEqual([
      { x: 200, y: 100 },
      { x: 500, y: 100 },
      { x: 450, y: 200 },
      { x: 400, y: 300 },
    ])
  })

  it('does not add a point when double-clicking a selected polyline segment', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 150, y: 52 })
    polyline.trigger('dblclick')

    expect(wrapper.emitted('update-region')).toBeUndefined()
  })

  it('shows only Delete region when right-clicking far from all selected polyline segments', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const stage = getLatestStage()
    const polyline = getLineInstances().find((line) => line.config.id === 'region-1')

    stage.getPointerPosition.mockReturnValue({ x: 10, y: 200 })
    polyline.trigger('contextmenu', createContextMenuEvent())
    await wrapper.vm.$nextTick()

    const menu = wrapper.find('.annotation-context-menu')
    expect(menu.text()).not.toContain('Add point')
    expect(menu.text()).toContain('Delete region')
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

  it('does not add a point when clicking an existing polyline vertex handle', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion()],
    })
    await flushImageLoad()

    const middleVertexHandle = getCircleInstances().slice(-3)[1]

    middleVertexHandle.trigger('click')

    expect(wrapper.emitted('select-region')).toEqual([['region-1']])
    expect(wrapper.emitted('update-region')).toBeUndefined()
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

  it('keeps polygon and polyline vertex handles using their region colors', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [fourPointPolygonRegion({ color: '#ff00aa' })],
    })
    await flushImageLoad()

    const polygonHandle = getCircleInstances().slice(-4)[0]

    expect(polygonHandle.config).toEqual(
      expect.objectContaining({
        fill: '#ffffff',
        stroke: '#ff00aa',
      })
    )

    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Rect.mockClear()
    Konva.Line.mockClear()
    Konva.Transformer.mockClear()
    Konva.Circle.mockClear()

    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [threePointPolylineRegion({ color: '#00ff88' })],
    })
    await flushImageLoad()

    const polylineHandle = getCircleInstances().slice(-3)[0]

    expect(polylineHandle.config).toEqual(
      expect.objectContaining({
        fill: '#ffffff',
        stroke: '#00ff88',
      })
    )
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
    expect(polygonWrapper.emitted('add-region')[0][0].annotations).toEqual([])
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
    expect(polylineWrapper.emitted('add-region')[0][0].annotations).toEqual([])
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
