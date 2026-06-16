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
      toolbarColor: '#123abc',
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

function getRegionColorInput(wrapper) {
  return wrapper.find('input[aria-label="Region color"]')
}

describe('ViewerToolbar', () => {
  it('renders navigation, tool, delete, and color controls', () => {
    const wrapper = mountToolbar()

    expect(wrapper.find('nav[aria-label="Viewer controls"]').exists()).toBe(true)
    expect(wrapper.find('[role="toolbar"][aria-label="Viewer actions"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Page')
    expect(wrapper.text()).toContain('Tools')
    expect(wrapper.text()).not.toContain('View')
    expect(getButtonByLabel(wrapper, 'Previous page').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Next page').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select rectangle tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select polygon tool').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Select polyline tool').exists()).toBe(true)
    expect(getRegionColorInput(wrapper).exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Delete selected region').exists()).toBe(true)
    expect(getButtonByLabel(wrapper, 'Zoom out').exists()).toBe(false)
    expect(getButtonByLabel(wrapper, 'Reset zoom').exists()).toBe(false)
    expect(getButtonByLabel(wrapper, 'Zoom in').exists()).toBe(false)
  })

  it('reflects disabled states from the current viewer state', () => {
    const wrapper = mountToolbar({
      selectedIndex: 0,
      hasSelectedRegion: false,
    })

    expectButtonDisabled(wrapper, 'Previous page')
    expectButtonDisabled(wrapper, 'Next page', false)
    expectButtonDisabled(wrapper, 'Delete selected region')
    expect(getRegionColorInput(wrapper).element.disabled).toBe(false)
  })

  it('disables next at the last page', () => {
    const wrapper = mountToolbar({
      selectedIndex: 3,
    })

    expectButtonDisabled(wrapper, 'Previous page', false)
    expectButtonDisabled(wrapper, 'Next page')
  })

  it('keeps delete enabled when a region is selected', () => {
    const wrapper = mountToolbar({ hasSelectedRegion: true })

    expectButtonDisabled(wrapper, 'Delete selected region', false)
  })

  it('uses the existing color control for the toolbar color', () => {
    const wrapper = mountToolbar({
      toolbarColor: '#ff00aa',
    })

    expect(getRegionColorInput(wrapper).element.value).toBe('#ff00aa')
    expect(getRegionColorInput(wrapper).element.disabled).toBe(false)
  })

  it('renders only one toolbar color control', () => {
    const wrapper = mountToolbar()

    expect(wrapper.findAll('input[type="color"]')).toHaveLength(1)
  })

  it('emits region color changes from the color input', async () => {
    const wrapper = mountToolbar({
      toolbarColor: '#123abc',
    })

    await getRegionColorInput(wrapper).setValue('#00ff88')

    expect(wrapper.emitted('update-region-color')).toEqual([['#00ff88']])
  })

  it('emits color changes even when no region is selected', async () => {
    const wrapper = mountToolbar({
      hasSelectedRegion: false,
      toolbarColor: '#123abc',
    })

    await getRegionColorInput(wrapper).setValue('#00ff88')

    expect(wrapper.emitted('update-region-color')).toEqual([['#00ff88']])
  })

  it('uses contextual color input titles', () => {
    const selectedWrapper = mountToolbar({ hasSelectedRegion: true })
    const creationWrapper = mountToolbar({ hasSelectedRegion: false })

    expect(getRegionColorInput(selectedWrapper).attributes('title')).toBe('Selected region color')
    expect(getRegionColorInput(creationWrapper).attributes('title')).toBe('New region color')
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

  it('emits delete events', async () => {
    const wrapper = mountToolbar()

    await getButtonByLabel(wrapper, 'Delete selected region').trigger('click')

    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
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
