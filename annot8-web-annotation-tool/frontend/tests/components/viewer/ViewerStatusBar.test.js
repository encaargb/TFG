import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerStatusBar from '../../../src/components/viewer/ViewerStatusBar.vue'

function mountStatusBar(props = {}) {
  return mount(ViewerStatusBar, {
    props: {
      selectedIndex: 2,
      totalPages: 7,
      zoomLevel: 1.25,
      zoomPercentage: 125,
      minZoomLevel: 0.25,
      maxZoomLevel: 8,
      zoomStep: 0.25,
      defaultZoomLevel: 1,
      activeTool: 'polygon',
      selectedRegion: null,
      overlappingRegionCount: 0,
      currentPageRegionCount: 4,
      mousePos: { x: 320, y: 180 },
      saveStatus: 'saved',
      ...props,
    },
  })
}

function statusItems(wrapper) {
  return wrapper.findAll('.status-item').map((item) => item.text())
}

function getButtonByLabel(wrapper, label) {
  return wrapper.find(`button[aria-label="${label}"]`)
}

function getZoomSlider(wrapper) {
  return wrapper.find('input[aria-label="Zoom level"]')
}

describe('ViewerStatusBar', () => {
  it('displays all current viewer status items in order', () => {
    const wrapper = mountStatusBar()

    const statusBar = wrapper.find('.status-bar')

    expect(statusBar.exists()).toBe(true)
    expect(statusItems(wrapper)).toEqual([
      'Page 3 / 7',
      'Mouse: (320, 180)',
      'Tool: Polygon',
      'Selected: none',
      'Regions on page: 4',
      '125%',
      'Saved',
    ])
    expect(getZoomSlider(wrapper).exists()).toBe(true)
  })

  it('updates displayed status from prop changes', async () => {
    const wrapper = mountStatusBar()

    await wrapper.setProps({
      selectedIndex: 0,
      totalPages: 2,
      zoomLevel: 0.75,
      zoomPercentage: 75,
      activeTool: 'rectangle',
      selectedRegion: { id: 'region-3', type: 'rectangle' },
      currentPageRegionCount: 0,
      mousePos: { x: 12, y: 34 },
      saveStatus: 'saving',
    })

    expect(wrapper.text()).toContain('Page 1 / 2')
    expect(wrapper.text()).toContain('75%')
    expect(wrapper.text()).not.toContain('Zoom')
    expect(wrapper.text()).toContain('Tool: Rectangle')
    expect(wrapper.text()).toContain('Selected: Rectangle region-3')
    expect(wrapper.text()).toContain('Regions on page: 0')
    expect(wrapper.text()).toContain('Mouse: (12, 34)')
    expect(wrapper.text()).toContain('Saving...')
  })

  it('renders the zoom slider with zoom configuration props', () => {
    const wrapper = mountStatusBar()
    const slider = getZoomSlider(wrapper)

    expect(slider.exists()).toBe(true)
    expect(slider.attributes()).toEqual(
      expect.objectContaining({
        min: '0.25',
        max: '8',
        step: '0.25',
      })
    )
    expect(slider.element.value).toBe('1.25')
  })

  it('renders zoom controls without a visible Zoom label or reset button', () => {
    const wrapper = mountStatusBar()

    expect(getButtonByLabel(wrapper, 'Zoom out').exists()).toBe(true)
    expect(getZoomSlider(wrapper).exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Zoom in').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Zoom')
    expect(getButtonByLabel(wrapper, 'Reset zoom').exists()).toBe(false)
  })

  it('renders a decorative default zoom marker', () => {
    const wrapper = mountStatusBar()
    const marker = wrapper.find('.statusbar-zoom-default-marker')

    expect(marker.exists()).toBe(true)
    expect(marker.attributes('aria-hidden')).toBe('true')
  })

  it('emits a numeric zoom level when the slider changes', async () => {
    const wrapper = mountStatusBar()

    await getZoomSlider(wrapper).setValue('2.5')

    expect(wrapper.emitted('update-zoom-level')).toEqual([[2.5]])
  })

  it('emits zoom button events', async () => {
    const wrapper = mountStatusBar()

    await getButtonByLabel(wrapper, 'Zoom out').trigger('click')
    await getButtonByLabel(wrapper, 'Zoom in').trigger('click')

    expect(wrapper.emitted('zoom-out')).toEqual([[]])
    expect(wrapper.emitted('zoom-in')).toEqual([[]])
  })

  it('disables zoom out at the minimum zoom', () => {
    const wrapper = mountStatusBar({
      zoomLevel: 0.25,
      zoomPercentage: 25,
    })

    expect(getButtonByLabel(wrapper, 'Zoom out').element.disabled).toBe(true)
    expect(getButtonByLabel(wrapper, 'Zoom in').element.disabled).toBe(false)
  })

  it('disables zoom in at the maximum zoom', () => {
    const wrapper = mountStatusBar({
      zoomLevel: 8,
      zoomPercentage: 800,
    })

    expect(getButtonByLabel(wrapper, 'Zoom out').element.disabled).toBe(false)
    expect(getButtonByLabel(wrapper, 'Zoom in').element.disabled).toBe(true)
  })

  it.each([
    ['rectangle', 'Rectangle region-3'],
    ['polygon', 'Polygon region-3'],
    ['polyline', 'Polyline region-3'],
  ])('displays the selected %s region label', (type, label) => {
    const wrapper = mountStatusBar({
      selectedRegion: { id: 'region-3', type },
    })

    expect(wrapper.text()).toContain(`Selected: ${label}`)
  })

  it('displays singular and plural overlap context for selected regions', async () => {
    const wrapper = mountStatusBar({
      selectedRegion: { id: 'region-3', type: 'polygon' },
      overlappingRegionCount: 1,
    })

    expect(wrapper.text()).toContain('Selected: Polygon region-3 · 1 overlapping region')

    await wrapper.setProps({ overlappingRegionCount: 2 })

    expect(wrapper.text()).toContain('Selected: Polygon region-3 · 2 overlapping regions')
    expect(getZoomSlider(wrapper).exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Zoom out').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Zoom in').exists()).toBe(true)
  })

  it('displays missing mouse position and save status labels', async () => {
    const wrapper = mountStatusBar({
      mousePos: null,
      saveStatus: 'saved',
    })

    expect(wrapper.text()).toContain('Mouse: (–, –)')
    expect(wrapper.text()).toContain('Saved')

    await wrapper.setProps({ saveStatus: 'saving' })
    expect(wrapper.text()).toContain('Saving...')

    await wrapper.setProps({ saveStatus: 'error' })
    expect(wrapper.text()).toContain('Save error')
  })

  it('warns when activeTool is outside the supported viewer tools', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mountStatusBar({ activeTool: 'freehand' })

    expect(warnSpy.mock.calls[0][0]).toContain(
      'Invalid prop: custom validator check failed for prop "activeTool"'
    )
    warnSpy.mockRestore()
  })
})
