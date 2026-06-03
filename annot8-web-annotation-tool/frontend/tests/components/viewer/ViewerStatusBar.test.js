import { describe, expect, it } from 'vitest'
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
})
