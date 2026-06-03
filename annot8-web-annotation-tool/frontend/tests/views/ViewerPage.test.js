import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Konva from 'konva'
import { ProjectDocumentModel } from '../../src/models/ProjectDocumentModel'
import ViewerPage from '../../src/views/ViewerPage.vue'
import {
  getImageInstances,
  getLayerInstances,
  getLatestStage,
  getCircleInstances,
  getLineInstances,
  getRectInstances,
  getTransformerInstances,
  resetKonvaMocks,
} from '../setup'

const flushImageLoad = () => new Promise((resolve) => setTimeout(resolve, 0))

function getButton(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.text() === label)
}

function expectToolButtonPressed(wrapper, label, isPressed = true) {
  expect(getButton(wrapper, label).attributes('aria-pressed')).toBe(String(isPressed))
}

function expectButtonDisabled(wrapper, label, isDisabled = true) {
  expect(getButton(wrapper, label).element.disabled).toBe(isDisabled)
}

function expectCurrentThumbnail(thumbnails, index) {
  thumbnails.forEach((thumbnail, thumbnailIndex) => {
    if (thumbnailIndex === index) {
      expect(thumbnail.attributes('aria-current')).toBe('page')
    } else {
      expect(thumbnail.attributes('aria-current')).toBeUndefined()
    }
  })
}

async function createSelectedRectangle(wrapper) {
  const stage = getLatestStage()

  await getButton(wrapper, 'Rectangle').trigger('click')

  stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
  stage.trigger('mousedown')

  stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
  stage.trigger('mousemove')
  stage.trigger('mouseup')
  await wrapper.vm.$nextTick()

  await getButton(wrapper, 'Select').trigger('click')

  return getRectInstances().at(-1)
}

describe('ViewerPage', () => {
  beforeEach(() => {
    ProjectDocumentModel.regions.length = 0
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Rect.mockClear()
    Konva.Line.mockClear()
    Konva.Circle.mockClear()
    Konva.Transformer.mockClear()
  })

  it('renders the document thumbnails and highlights the first page by default', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')

    expect(thumbnails).toHaveLength(15)
    expectCurrentThumbnail(thumbnails, 0)
    expect(wrapper.text()).toContain('Page 1 / 15')
    expect(wrapper.text()).toContain('Zoom: 100%')
    expect(wrapper.text()).toContain('Regions: 0')
  })

  it('collapses and expands the page thumbnail sidebar', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    expect(wrapper.find('.sidebar').classes()).not.toContain('sidebar--collapsed')
    expect(wrapper.findAll('.thumb')).toHaveLength(15)

    stage.width.mockClear()
    await wrapper.find('button[aria-label="Hide page thumbnails"]').trigger('click')

    expect(wrapper.find('.sidebar').classes()).toContain('sidebar--collapsed')
    expect(wrapper.findAll('.thumb')).toHaveLength(0)
    expect(stage.width).toHaveBeenLastCalledWith(1000)

    await wrapper.find('button[aria-label="Show page thumbnails"]').trigger('click')

    expect(wrapper.find('.sidebar').classes()).not.toContain('sidebar--collapsed')
    expect(wrapper.findAll('.thumb')).toHaveLength(15)
  })

  it('keeps the selected page when the thumbnail sidebar is collapsed and expanded', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await wrapper.findAll('.thumb')[4].trigger('click')
    await flushImageLoad()

    expect(wrapper.text()).toContain('Page 5 / 15')

    await wrapper.find('button[aria-label="Hide page thumbnails"]').trigger('click')

    expect(wrapper.text()).toContain('Page 5 / 15')

    await wrapper.find('button[aria-label="Show page thumbnails"]').trigger('click')

    const thumbnails = wrapper.findAll('.thumb')

    expect(wrapper.text()).toContain('Page 5 / 15')
    expectCurrentThumbnail(thumbnails, 4)
  })

  it('creates the Konva stage and drawing layers when the component is mounted', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    const layers = getLayerInstances()

    expect(Konva.Stage).toHaveBeenCalledTimes(1)
    expect(Konva.Layer).toHaveBeenCalledTimes(2)
    expect(stage.config.container).toBe(wrapper.find('.konva-container').element)
    expect(stage.config.width).toBe(1000)
    expect(stage.config.height).toBe(700)
    expect(stage.add).toHaveBeenCalledWith(layers[0])
    expect(stage.add).toHaveBeenCalledWith(layers[1])
  })

  it('loads the selected page image into Konva on mount', async () => {
    mount(ViewerPage)
    await flushImageLoad()

    const layer = getLayerInstances()[0]
    const createdImages = getImageInstances()

    expect(Konva.Image).toHaveBeenCalledTimes(1)
    expect(Konva.Image).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 0,
        y: 0,
        width: 1000,
        height: 500,
      })
    )
    expect(layer.add).toHaveBeenCalledWith(createdImages[0])
    expect(layer.draw).toHaveBeenCalled()
  })

  it('renders the select, rectangle, polygon, and polyline region tools', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    expect(wrapper.find('nav[aria-label="Viewer controls"]').exists()).toBe(true)
    expect(wrapper.find('[role="toolbar"][aria-label="Viewer actions"]').exists()).toBe(true)
    expectToolButtonPressed(wrapper, 'Select')
    expectToolButtonPressed(wrapper, 'Rectangle', false)
    expectToolButtonPressed(wrapper, 'Polygon', false)
    expectToolButtonPressed(wrapper, 'Polyline', false)
    expectButtonDisabled(wrapper, 'Delete')
  })

  it('renders a bottom status bar with document state', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const statusBar = wrapper.find('.status-bar')

    expect(statusBar.exists()).toBe(true)
    expect(statusBar.text()).toContain('Page 1 / 15')
    expect(statusBar.text()).toContain('Zoom 100%')
    expect(statusBar.text()).toContain('Tool select')
    expect(statusBar.text()).toContain('Regions 0')
    expect(statusBar.text()).toContain('X 0 · Y 0')
  })

  it('updates the bottom status bar when viewer state changes', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    const statusBar = wrapper.find('.status-bar')

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 125 })
    stage.trigger('mousemove')
    await wrapper.vm.$nextTick()

    await getButton(wrapper, 'Next').trigger('click')
    await flushImageLoad()

    expect(statusBar.text()).toContain('Page 2 / 15')
    expect(statusBar.text()).toContain('Tool rectangle')
    expect(statusBar.text()).toContain('X 500 · Y 250')
  })

  it('updates the canvas cursor mode when switching region tools', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const canvasWrapper = wrapper.find('.canvas-wrapper')

    expect(canvasWrapper.classes()).toContain('canvas-wrapper--select')

    await getButton(wrapper, 'Rectangle').trigger('click')

    expect(canvasWrapper.classes()).toContain('canvas-wrapper--rectangle')

    await getButton(wrapper, 'Polygon').trigger('click')

    expect(canvasWrapper.classes()).toContain('canvas-wrapper--polygon')

    await getButton(wrapper, 'Polyline').trigger('click')

    expect(canvasWrapper.classes()).toContain('canvas-wrapper--polyline')
  })

  it('creates a rectangular region by dragging on the document', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const regions = ProjectDocumentModel.regions
    const rects = getRectInstances()
    const transformer = getTransformerInstances().at(-1)

    expect(regions).toHaveLength(1)
    expect(regions[0]).toEqual(
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
    expect(wrapper.text()).toContain('Regions: 1')
    expectToolButtonPressed(wrapper, 'Rectangle')
    expect(rects.at(-1).config).toEqual(
      expect.objectContaining({
        x: 100,
        y: 50,
        width: 150,
        height: 100,
        id: 'region-1',
        strokeScaleEnabled: false,
      })
    )
    expect(transformer.nodes).toHaveBeenLastCalledWith([])
  })

  it('does not create a region when the drag area is too small', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 101, y: 51 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions).toHaveLength(0)
    expect(wrapper.text()).toContain('Regions: 0')
  })

  it('creates a polygon region from clicked vertices and Enter', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polygon').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    const regions = ProjectDocumentModel.regions
    const lines = getLineInstances()

    expect(regions).toHaveLength(1)
    expect(regions[0]).toEqual(
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
    expect(wrapper.text()).toContain('Regions: 1')
    expectToolButtonPressed(wrapper, 'Polygon')
    expect(lines.at(-1).config).toEqual(
      expect.objectContaining({
        points: [100, 50, 250, 50, 200, 150],
        closed: true,
        id: 'region-1',
        strokeScaleEnabled: false,
      })
    )
  })

  it('does not create a polygon region with fewer than three vertices', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polygon').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions).toHaveLength(0)
    expect(wrapper.text()).toContain('Regions: 0')
  })

  it('closes a polygon when clicking near its first vertex', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polygon').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 106, y: 54 })
    stage.trigger('click')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions).toHaveLength(1)
    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        type: 'polygon',
        points: [
          { x: 200, y: 100 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
    expect(wrapper.text()).toContain('Regions: 1')
  })

  it('visually previews polygon closure near the first vertex', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polygon').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    const draftPolygonNode = getLineInstances().at(-1)

    stage.getPointerPosition.mockReturnValue({ x: 106, y: 54 })
    stage.trigger('mousemove')

    expect(draftPolygonNode.closed).toHaveBeenLastCalledWith(true)
    expect(draftPolygonNode.fill).toHaveBeenLastCalledWith('#0d6efd26')
    expect(draftPolygonNode.points).toHaveBeenLastCalledWith([100, 50, 250, 50, 200, 150])

    wrapper.unmount()
  })

  it('creates a polyline region from clicked vertices and Enter', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polyline').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    const lines = getLineInstances()

    expect(ProjectDocumentModel.regions).toHaveLength(1)
    expect(ProjectDocumentModel.regions[0]).toEqual(
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
    expectToolButtonPressed(wrapper, 'Polyline')
    expect(lines.at(-1).config).toEqual(
      expect.objectContaining({
        points: [100, 50, 250, 50, 200, 150],
        closed: false,
        fill: 'transparent',
        id: 'region-1',
        strokeScaleEnabled: false,
      })
    )
  })

  it('does not create a polyline region with fewer than two vertices', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polyline').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions).toHaveLength(0)
    expect(wrapper.text()).toContain('Regions: 0')
  })

  it('edits polyline vertices with draggable handles in select mode', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polyline').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    await getButton(wrapper, 'Select').trigger('click')

    const polylineNode = [...getLineInstances()]
      .reverse()
      .find((line) => line.config.id === 'region-1')
    const vertexHandles = getCircleInstances().slice(-2)
    const firstVertexHandle = vertexHandles[0]

    expect(vertexHandles).toHaveLength(2)

    firstVertexHandle.x(75)
    firstVertexHandle.y(90)
    firstVertexHandle.trigger('dragmove')

    expect(polylineNode.points).toHaveBeenLastCalledWith([75, 90, 250, 50])

    firstVertexHandle.trigger('dragend')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        points: [
          { x: 150, y: 180 },
          { x: 500, y: 100 },
        ],
      })
    )
  })

  it('keeps moved polygon regions inside the document boundaries', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polygon').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    const regionNode = [...getLineInstances()]
      .reverse()
      .find((line) => line.config.id === 'region-1')

    regionNode.x(-200)
    regionNode.y(9999)
    regionNode.trigger('dragend')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        points: [
          { x: 0, y: 800 },
          { x: 300, y: 800 },
          { x: 200, y: 1000 },
        ],
      })
    )
  })

  it('edits polygon vertices with draggable handles in select mode', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Polygon').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 50 })
    stage.trigger('click')
    stage.getPointerPosition.mockReturnValue({ x: 200, y: 150 })
    stage.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    await getButton(wrapper, 'Select').trigger('click')

    const polygonNode = getLineInstances().at(-1)
    const vertexHandles = getCircleInstances().slice(-3)
    const firstVertexHandle = vertexHandles[0]
    const transformer = getTransformerInstances().at(-1)

    expect(vertexHandles).toHaveLength(3)
    expect(firstVertexHandle.config).toEqual(
      expect.objectContaining({
        x: 100,
        y: 50,
        radius: 5,
        draggable: true,
        strokeScaleEnabled: false,
      })
    )
    expect(transformer.nodes).toHaveBeenLastCalledWith([])

    firstVertexHandle.x(75)
    firstVertexHandle.y(90)
    firstVertexHandle.trigger('dragmove')

    expect(polygonNode.points).toHaveBeenLastCalledWith([75, 90, 250, 50, 200, 150])

    firstVertexHandle.trigger('dragend')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        points: [
          { x: 150, y: 180 },
          { x: 500, y: 100 },
          { x: 400, y: 300 },
        ],
      })
    )
  })

  it('keeps moved regions inside the document boundaries', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const regionNode = getRectInstances().at(-1)

    regionNode.x(-20)
    regionNode.y(9999)
    regionNode.trigger('dragend')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        x: 0,
        y: 800,
        width: 300,
        height: 200,
      })
    )
  })

  it('visually stops dragged regions at the document boundaries before dropping', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const regionNode = getRectInstances().at(-1)

    regionNode.x(-20)
    regionNode.y(9999)
    regionNode.trigger('dragmove')

    expect(regionNode.x).toHaveBeenLastCalledWith(0)
    expect(regionNode.y).toHaveBeenLastCalledWith(400)
  })

  it('limits transformed regions to the visible document area', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const transformer = getTransformerInstances().at(-1)
    const clampedBox = transformer.config.boundBoxFunc(
      { x: 100, y: 50, width: 150, height: 100 },
      { x: -50, y: 600, width: 1200, height: 800 }
    )

    expect(transformer.config.flipEnabled).toBe(false)
    expect(clampedBox).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 500,
    })
  })

  it('keeps rectangle resize handles from flipping regions when dragged past the opposite edge', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const transformer = getTransformerInstances().at(-1)
    const clampedBox = transformer.config.boundBoxFunc(
      { x: 100, y: 50, width: 150, height: 100 },
      { x: 250, y: 150, width: -120, height: -80 }
    )

    expect(clampedBox).toEqual({ x: 100, y: 50, width: 150, height: 100 })
  })

  it('keeps rectangle dimensions synchronized while a transformer resize is in progress', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const regionNode = getRectInstances().at(-1)

    regionNode.scaleX(2)
    regionNode.scaleY(1.5)
    regionNode.trigger('transform')

    expect(regionNode.width).toHaveBeenLastCalledWith(300)
    expect(regionNode.height).toHaveBeenLastCalledWith(150)
    expect(regionNode.scaleX).toHaveBeenLastCalledWith(1)
    expect(regionNode.scaleY).toHaveBeenLastCalledWith(1)
    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        width: 300,
        height: 200,
      })
    )
  })

  it('updates a rectangle region when resized with transformer handles', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const regionNode = getRectInstances().at(-1)

    regionNode.scaleX(2)
    regionNode.scaleY(1.5)
    regionNode.trigger('transformend')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        x: 200,
        y: 100,
        width: 600,
        height: 300,
      })
    )
    expect(regionNode.width).toHaveBeenLastCalledWith(300)
    expect(regionNode.height).toHaveBeenLastCalledWith(150)
    expect(regionNode.scaleX).toHaveBeenLastCalledWith(1)
    expect(regionNode.scaleY).toHaveBeenLastCalledWith(1)
  })

  it('deletes the selected region from the toolbar', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions).toHaveLength(1)
    expectButtonDisabled(wrapper, 'Delete', false)

    await getButton(wrapper, 'Delete').trigger('click')

    expect(ProjectDocumentModel.regions).toHaveLength(0)
    expect(wrapper.text()).toContain('Regions: 0')
    expectButtonDisabled(wrapper, 'Delete')
  })

  it('deletes the selected region with the Delete key', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()

    await getButton(wrapper, 'Rectangle').trigger('click')

    stage.getPointerPosition.mockReturnValue({ x: 100, y: 50 })
    stage.trigger('mousedown')

    stage.getPointerPosition.mockReturnValue({ x: 250, y: 150 })
    stage.trigger('mousemove')
    stage.trigger('mouseup')
    await wrapper.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()

    expect(ProjectDocumentModel.regions).toHaveLength(0)
    expect(wrapper.text()).toContain('Regions: 0')
  })

  it('clears the current selection when clicking outside any existing region', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await createSelectedRectangle(wrapper)

    const stage = getLatestStage()
    const transformer = getTransformerInstances().at(-1)

    expectButtonDisabled(wrapper, 'Delete', false)
    expect(transformer.nodes).toHaveBeenLastCalledWith([getRectInstances().at(-1)])

    stage.trigger('click', { target: stage })
    await wrapper.vm.$nextTick()

    expectButtonDisabled(wrapper, 'Delete')
    expect(getTransformerInstances().at(-1).nodes).toHaveBeenLastCalledWith([])
  })

  it('keeps the current selection when clicking an existing region', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const selectedRectangle = await createSelectedRectangle(wrapper)
    const stage = getLatestStage()

    stage.trigger('click', { target: selectedRectangle })
    await wrapper.vm.$nextTick()

    expectButtonDisabled(wrapper, 'Delete', false)
  })

  it('clears the current selection with the Escape key', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await createSelectedRectangle(wrapper)

    expectButtonDisabled(wrapper, 'Delete', false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expectButtonDisabled(wrapper, 'Delete')
    expect(getTransformerInstances().at(-1).nodes).toHaveBeenLastCalledWith([])
  })

  it('disables Previous on the first page and enables Next', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    expectButtonDisabled(wrapper, 'Previous')
    expectButtonDisabled(wrapper, 'Next', false)
  })

  it('moves to the next page and updates the active thumbnail', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, 'Next').trigger('click')
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')

    expect(wrapper.text()).toContain('Page 2 / 15')
    expectButtonDisabled(wrapper, 'Previous', false)
    expectCurrentThumbnail(thumbnails, 1)
  })

  it('moves back to the previous page and restores the first thumbnail as active', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, 'Next').trigger('click')
    await flushImageLoad()
    await getButton(wrapper, 'Previous').trigger('click')
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')

    expect(wrapper.text()).toContain('Page 1 / 15')
    expectButtonDisabled(wrapper, 'Previous')
    expectCurrentThumbnail(thumbnails, 0)
  })

  it('selects a page when its thumbnail is clicked', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')
    await thumbnails[4].trigger('click')
    await flushImageLoad()

    expect(wrapper.text()).toContain('Page 5 / 15')
    expectCurrentThumbnail(thumbnails, 4)
  })

  it('disables Next on the last page', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')
    await thumbnails.at(-1).trigger('click')
    await flushImageLoad()

    expect(wrapper.text()).toContain('Page 15 / 15')
    expectButtonDisabled(wrapper, 'Next')
  })

  it('increases and decreases zoom using the configured step', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, '+').trigger('click')
    expect(wrapper.text()).toContain('Zoom: 125%')

    await getButton(wrapper, '-').trigger('click')
    expect(wrapper.text()).toContain('Zoom: 100%')
  })

  it('updates the Konva stage and image dimensions when zoom changes', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    const imageNode = getImageInstances()[0]

    await getButton(wrapper, '+').trigger('click')

    expect(stage.width).toHaveBeenLastCalledWith(1250)
    expect(stage.height).toHaveBeenLastCalledWith(625)
    expect(imageNode.width).toHaveBeenLastCalledWith(1250)
    expect(imageNode.height).toHaveBeenLastCalledWith(625)
  })

  it('resets zoom when the reset button is pressed', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, '+').trigger('click')
    await getButton(wrapper, 'Reset').trigger('click')

    expect(wrapper.text()).toContain('Zoom: 100%')
  })

  it('resets zoom when the page changes', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, '+').trigger('click')
    await getButton(wrapper, 'Next').trigger('click')
    await flushImageLoad()

    expect(wrapper.text()).toContain('Page 2 / 15')
    expect(wrapper.text()).toContain('Zoom: 100%')
  })

  it('does not allow zoom above the configured maximum', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    for (let i = 0; i < 30; i += 1) {
      await getButton(wrapper, '+').trigger('click')
    }

    expect(wrapper.text()).toContain('Zoom: 800%')
    expectButtonDisabled(wrapper, '+')
  })

  it('does not allow zoom below the configured minimum', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    for (let i = 0; i < 20; i += 1) {
      await getButton(wrapper, '-').trigger('click')
    }

    expect(wrapper.text()).toContain('Zoom: 25%')
    expectButtonDisabled(wrapper, '-')
  })

  it('reloads the Konva image when the selected page changes and destroys the previous node', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const firstImage = getImageInstances()[0]

    await getButton(wrapper, 'Next').trigger('click')
    await flushImageLoad()

    const images = getImageInstances()

    expect(Konva.Image).toHaveBeenCalledTimes(2)
    expect(firstImage.destroy).toHaveBeenCalledTimes(1)
    expect(images).toHaveLength(2)
  })

  it('updates the mouse coordinates using the Konva pointer position', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 125 })

    stage.trigger('mousemove')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.coords').text()).toContain('(500, 250)')
  })

  it('keeps the previous coordinates when Konva returns no pointer position', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 250, y: 125 })
    stage.trigger('mousemove')
    await wrapper.vm.$nextTick()

    stage.getPointerPosition.mockReturnValue(null)
    stage.trigger('mousemove')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.coords').text()).toContain('(500, 250)')
  })

  it('converts pointer coordinates to original document dimensions using the current zoom level', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, '+').trigger('click')

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 300, y: 180 })

    stage.trigger('mousemove')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.coords').text()).toContain('(480, 288)')
  })

  it('cleans up the Konva stage when the component is unmounted', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    wrapper.unmount()

    expect(stage.destroy).toHaveBeenCalledTimes(1)
  })
})
