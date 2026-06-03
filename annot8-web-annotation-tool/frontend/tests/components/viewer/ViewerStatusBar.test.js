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
      regionCount: 4,
      mousePos: { x: 320, y: 180 },
      ...props,
    },
  })
}

describe('ViewerStatusBar', () => {
  it('displays the current viewer status', () => {
    const wrapper = mountStatusBar()

    const statusBar = wrapper.find('.status-bar')

    expect(statusBar.exists()).toBe(true)
    expect(statusBar.text()).toContain('Page 3 / 7')
    expect(statusBar.text()).toContain('Zoom 125%')
    expect(statusBar.text()).toContain('Tool polygon')
    expect(statusBar.text()).toContain('Regions 4')
    expect(statusBar.text()).toContain('X 320 · Y 180')
  })

  it('updates displayed status from prop changes', async () => {
    const wrapper = mountStatusBar()

    await wrapper.setProps({
      selectedIndex: 0,
      totalPages: 2,
      zoomPercentage: 75,
      activeTool: 'rectangle',
      regionCount: 0,
      mousePos: { x: 12, y: 34 },
    })

    expect(wrapper.text()).toContain('Page 1 / 2')
    expect(wrapper.text()).toContain('Zoom 75%')
    expect(wrapper.text()).toContain('Tool rectangle')
    expect(wrapper.text()).toContain('Regions 0')
    expect(wrapper.text()).toContain('X 12 · Y 34')
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
