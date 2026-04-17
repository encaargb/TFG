import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Konva from 'konva'
import ViewerPage from '../../src/views/ViewerPage.vue'
import {
  getImageInstances,
  getLatestLayer,
  getLatestStage,
  resetKonvaMocks,
} from '../setup'

const flushImageLoad = () => new Promise((resolve) => setTimeout(resolve, 0))

function getButton(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.text() === label)
}

describe('ViewerPage', () => {
  beforeEach(() => {
    resetKonvaMocks()
    Konva.Stage.mockClear()
    Konva.Layer.mockClear()
    Konva.Image.mockClear()
  })

  it('renders the document thumbnails and highlights the first page by default', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const thumbnails = wrapper.findAll('.thumb')

    expect(thumbnails).toHaveLength(15)
    expect(thumbnails[0].classes()).toContain('active')
    expect(wrapper.text()).toContain('Page 1 / 15')
    expect(wrapper.text()).toContain('Zoom: 100%')
  })

  it('creates the Konva stage and layer when the component is mounted', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    const layer = getLatestLayer()

    expect(Konva.Stage).toHaveBeenCalledTimes(1)
    expect(Konva.Layer).toHaveBeenCalledTimes(1)
    expect(stage.config.container).toBe(wrapper.find('.konva-container').element)
    expect(stage.config.width).toBe(1000)
    expect(stage.config.height).toBe(700)
    expect(stage.add).toHaveBeenCalledWith(layer)
  })

  it('loads the selected page image into Konva on mount', async () => {
    mount(ViewerPage)
    await flushImageLoad()

    const layer = getLatestLayer()
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

  it('increases and decreases zoom using the configured factor', async () => {
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

    for (let i = 0; i < 20; i += 1) {
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

    expect(wrapper.find('.coords').text()).toContain('(250, 125)')
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

    expect(wrapper.find('.coords').text()).toContain('(250, 125)')
  })

  it('converts pointer coordinates using the current zoom level', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    await getButton(wrapper, '+').trigger('click')

    const stage = getLatestStage()
    stage.getPointerPosition.mockReturnValue({ x: 300, y: 180 })

    stage.trigger('mousemove')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.coords').text()).toContain('(240, 144)')
  })

  it('cleans up the Konva stage when the component is unmounted', async () => {
    const wrapper = mount(ViewerPage)
    await flushImageLoad()

    const stage = getLatestStage()
    wrapper.unmount()

    expect(stage.destroy).toHaveBeenCalledTimes(1)
  })
})
