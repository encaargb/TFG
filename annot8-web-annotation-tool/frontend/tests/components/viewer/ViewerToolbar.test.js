import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerToolbar from '../../../src/components/viewer/ViewerToolbar.vue'

function mountToolbar(props = {}) {
  return mount(ViewerToolbar, {
    props: {
      selectedIndex: 1,
      totalPages: 4,
      activeTool: 'select',
      regionCount: 2,
      hasSelectedRegion: true,
      zoomLevel: 1,
      minZoom: 0.25,
      maxZoom: 8,
      zoomPercentage: 100,
      mousePos: { x: 12, y: 34 },
      ...props,
    },
  })
}

function getButtonByLabel(wrapper, label) {
  return wrapper.find(`button[aria-label="${label}"]`)
}

function expectButtonDisabled(wrapper, label, isDisabled = true) {
  expect(getButtonByLabel(wrapper, label).element.disabled).toBe(isDisabled)
}

function expectToolButtonPressed(wrapper, label, isPressed = true) {
  expect(getButtonByLabel(wrapper, label).attributes('aria-pressed')).toBe(String(isPressed))
}

describe('ViewerToolbar', () => {
  it('renders navigation, tool, delete, zoom, and status controls', () => {
    const wrapper = mountToolbar()

    expect(wrapper.find('nav[aria-label="Viewer controls"]').exists()).toBe(true)
    expect(wrapper.find('[role="toolbar"][aria-label="Viewer actions"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Page')
    expect(wrapper.text()).toContain('Tools')
    expect(wrapper.text()).toContain('View')
    expect(getButtonByLabel(wrapper, 'Previous page').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Next page').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select rectangle tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select polygon tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select polyline tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Delete selected region').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Reset zoom').exists()).toBe(true)
  })

  it('reflects disabled states from the current viewer state', () => {
    const wrapper = mountToolbar({
      selectedIndex: 0,
      hasSelectedRegion: false,
      zoomLevel: 0.25,
    })

    expectButtonDisabled(wrapper, 'Previous page')
    expectButtonDisabled(wrapper, 'Next page', false)
    expectButtonDisabled(wrapper, 'Delete selected region')
    expectButtonDisabled(wrapper, 'Zoom out')
    expectButtonDisabled(wrapper, 'Zoom in', false)
  })

  it('disables next and zoom in at their upper bounds', () => {
    const wrapper = mountToolbar({
      selectedIndex: 3,
      zoomLevel: 8,
    })

    expectButtonDisabled(wrapper, 'Previous page', false)
    expectButtonDisabled(wrapper, 'Next page')
    expectButtonDisabled(wrapper, 'Zoom in')
  })

  it('keeps delete enabled when a region is selected', () => {
    const wrapper = mountToolbar({ hasSelectedRegion: true })

    expectButtonDisabled(wrapper, 'Delete selected region', false)
  })

  it('marks the active annotation tool', () => {
    const tools = [
      ['select', 'Select tool'],
      ['rectangle', 'Select rectangle tool'],
      ['polygon', 'Select polygon tool'],
      ['polyline', 'Select polyline tool'],
    ]

    tools.forEach(([activeTool, activeLabel]) => {
      const wrapper = mountToolbar({ activeTool })

      tools.forEach(([, label]) => {
        expectToolButtonPressed(wrapper, label, label === activeLabel)
      })
    })
  })

  it('emits navigation events', async () => {
    const wrapper = mountToolbar()

    await getButtonByLabel(wrapper, 'Previous page').trigger('click')
    await getButtonByLabel(wrapper, 'Next page').trigger('click')

    expect(wrapper.emitted('previous-page')).toEqual([[]])
    expect(wrapper.emitted('next-page')).toEqual([[]])
  })

  it('emits tool selection events with each annotation tool', async () => {
    const wrapper = mountToolbar()

    await getButtonByLabel(wrapper, 'Select rectangle tool').trigger('click')
    await getButtonByLabel(wrapper, 'Select polygon tool').trigger('click')
    await getButtonByLabel(wrapper, 'Select polyline tool').trigger('click')
    await getButtonByLabel(wrapper, 'Select tool').trigger('click')

    expect(wrapper.emitted('set-active-tool')).toEqual([
      ['rectangle'],
      ['polygon'],
      ['polyline'],
      ['select'],
    ])
  })

  it('emits delete and zoom events', async () => {
    const wrapper = mountToolbar()

    await getButtonByLabel(wrapper, 'Delete selected region').trigger('click')
    await getButtonByLabel(wrapper, 'Zoom out').trigger('click')
    await getButtonByLabel(wrapper, 'Reset zoom').trigger('click')
    await getButtonByLabel(wrapper, 'Zoom in').trigger('click')

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('zoom-out')).toEqual([[]])
    expect(wrapper.emitted('reset-zoom')).toEqual([[]])
    expect(wrapper.emitted('zoom-in')).toEqual([[]])
  })

  it('warns when activeTool is outside the supported viewer tools', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mountToolbar({ activeTool: 'freehand' })

    expect(warnSpy.mock.calls[0][0]).toContain(
      'Invalid prop: custom validator check failed for prop "activeTool"'
    )
    warnSpy.mockRestore()
  })
})
