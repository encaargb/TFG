import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Konva from 'konva'
import AnnotationCanvas from '../../../src/components/viewer/AnnotationCanvas.vue'
import {
  getImageInstances,
  getLayerInstances,
  getLatestStage,
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
      regions: [
        {
          id: 'region-1',
          pageIndex: 0,
          type: 'rectangle',
          x: 200,
          y: 100,
          width: 300,
          height: 200,
          color: '#0d6efd',
        },
      ],
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

  it('emits selection and update events for existing regions', async () => {
    const wrapper = mountCanvas({
      selectedRegionId: 'region-1',
      regions: [
        {
          id: 'region-1',
          pageIndex: 0,
          type: 'rectangle',
          x: 200,
          y: 100,
          width: 300,
          height: 200,
          color: '#0d6efd',
        },
      ],
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

  it('renders point regions with vertex handles when selected in select mode', async () => {
    mountCanvas({
      selectedRegionId: 'region-1',
      regions: [
        {
          id: 'region-1',
          pageIndex: 0,
          type: 'polygon',
          points: [
            { x: 200, y: 100 },
            { x: 500, y: 100 },
            { x: 400, y: 300 },
          ],
          color: '#0d6efd',
        },
      ],
    })
    await flushImageLoad()

    const polygon = getLineInstances().find((line) => line.config.id === 'region-1')

    expect(polygon.config).toEqual(
      expect.objectContaining({
        points: [100, 50, 250, 50, 200, 150],
        closed: true,
        strokeWidth: 3,
      })
    )
  })
})
