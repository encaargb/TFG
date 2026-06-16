import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerStatusBar from '../../../src/components/viewer/ViewerStatusBar.vue'

function mountStatusBar(props = {}) {
  return mount(ViewerStatusBar, {
    props: {
      selectedIndex: 2,
      totalPages: 7,
      zoomPercentage: 125,
      activeTool: 'polygon',
      selectedRegion: null,
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
      'Zoom 125%',
      'Save: Saved',
    ])
  })

  it('updates displayed status from prop changes', async () => {
    const wrapper = mountStatusBar()

    await wrapper.setProps({
      selectedIndex: 0,
      totalPages: 2,
      zoomPercentage: 75,
      activeTool: 'rectangle',
      selectedRegion: { id: 'region-3', type: 'rectangle' },
      currentPageRegionCount: 0,
      mousePos: { x: 12, y: 34 },
      saveStatus: 'saving',
    })

    expect(wrapper.text()).toContain('Page 1 / 2')
    expect(wrapper.text()).toContain('Zoom 75%')
    expect(wrapper.text()).toContain('Tool: Rectangle')
    expect(wrapper.text()).toContain('Selected: Rectangle region-3')
    expect(wrapper.text()).toContain('Regions on page: 0')
    expect(wrapper.text()).toContain('Mouse: (12, 34)')
    expect(wrapper.text()).toContain('Save: Saving...')
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

  it('displays missing mouse position and save status labels', async () => {
    const wrapper = mountStatusBar({
      mousePos: null,
      saveStatus: 'saved',
    })

    expect(wrapper.text()).toContain('Mouse: (–, –)')
    expect(wrapper.text()).toContain('Save: Saved')

    await wrapper.setProps({ saveStatus: 'saving' })
    expect(wrapper.text()).toContain('Save: Saving...')

    await wrapper.setProps({ saveStatus: 'error' })
    expect(wrapper.text()).toContain('Save: Save error')
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
