import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Konva from 'konva'
import { ProjectDocumentModel } from '../../src/models/ProjectDocumentModel'
import ViewerPage from '../../src/views/ViewerPage.vue'
import {
  getImageInstances,
  getLayerInstances,
  getLatestStage,
  getRectInstances,
  getTransformerInstances,
  resetKonvaMocks,
} from '../setup'

const flushImageLoad = () => new Promise((resolve) => setTimeout(resolve, 0))

function getButton(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.text() === label)
}

describe('ViewerPage', () => {
  beforeEach(() => {
    ProjectDocumentModel.regions.length = 0
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
    Konva.Rect.mockClear()
    Konva.Transformer.mockClear()
  })

  it('renders the document thumbnails and highlights the first page by default', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')

    expect(thumbnails).toHaveLength(15)
    expect(thumbnails[0].classes()).toContain('active')
    expect(wrapper.text()).toContain('Page 1 / 15')
    expect(wrapper.text()).toContain('Zoom: 100%')
    expect(wrapper.text()).toContain('Regions: 0')
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

  it('renders the select and rectangle region tools', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    expect(getButton(wrapper, 'Select').classes()).toContain('btn-primary')
    expect(getButton(wrapper, 'Rectangle').classes()).toContain('btn-outline-secondary')
    expect(getButton(wrapper, 'Delete').element.disabled).toBe(true)
  })

  it('updates the canvas cursor mode when switching region tools', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const canvasWrapper = wrapper.find('.canvas-wrapper')

    expect(canvasWrapper.classes()).toContain('canvas-wrapper--select')

    await getButton(wrapper, 'Rectangle').trigger('click')

    expect(canvasWrapper.classes()).toContain('canvas-wrapper--rectangle')
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
    expect(getButton(wrapper, 'Rectangle').classes()).toContain('btn-primary')
    expect(rects.at(-1).config).toEqual(
      expect.objectContaining({
        x: 100,
        y: 50,
        width: 150,
        height: 100,
        id: 'region-1',
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

    expect(clampedBox).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 500,
    })
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
    expect(getButton(wrapper, 'Delete').element.disabled).toBe(false)

    await getButton(wrapper, 'Delete').trigger('click')

    expect(ProjectDocumentModel.regions).toHaveLength(0)
    expect(wrapper.text()).toContain('Regions: 0')
    expect(getButton(wrapper, 'Delete').element.disabled).toBe(true)
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

  it('disables Previous on the first page and enables Next', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    expect(getButton(wrapper, 'Previous').element.disabled).toBe(true)
    expect(getButton(wrapper, 'Next').element.disabled).toBe(false)
  })

  it('moves to the next page and updates the active thumbnail', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, 'Next').trigger('click')
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')

    expect(wrapper.text()).toContain('Page 2 / 15')
    expect(getButton(wrapper, 'Previous').element.disabled).toBe(false)
    expect(thumbnails[1].classes()).toContain('active')
    expect(thumbnails[0].classes()).not.toContain('active')
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
    expect(getButton(wrapper, 'Previous').element.disabled).toBe(true)
    expect(thumbnails[0].classes()).toContain('active')
  })

  it('selects a page when its thumbnail is clicked', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')
    await thumbnails[4].trigger('click')
    await flushImageLoad()

    expect(wrapper.text()).toContain('Page 5 / 15')
    expect(thumbnails[4].classes()).toContain('active')
  })

  it('disables Next on the last page', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')
    await thumbnails.at(-1).trigger('click')
    await flushImageLoad()

    expect(wrapper.text()).toContain('Page 15 / 15')
    expect(getButton(wrapper, 'Next').element.disabled).toBe(true)
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
    expect(getButton(wrapper, '+').element.disabled).toBe(true)
  })

  it('does not allow zoom below the configured minimum', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    for (let i = 0; i < 20; i += 1) {
      await getButton(wrapper, '-').trigger('click')
    }

    expect(wrapper.text()).toContain('Zoom: 25%')
    expect(getButton(wrapper, '-').element.disabled).toBe(true)
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
