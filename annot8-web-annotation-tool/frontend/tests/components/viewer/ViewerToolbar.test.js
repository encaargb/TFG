import { describe, expect, it } from 'vitest'
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

function getButton(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.text() === label)
}

function expectButtonDisabled(wrapper, label, isDisabled = true) {
  expect(getButton(wrapper, label).element.disabled).toBe(isDisabled)
}

function expectToolButtonPressed(wrapper, label, isPressed = true) {
  expect(getButton(wrapper, label).attributes('aria-pressed')).toBe(String(isPressed))
}

describe('ViewerToolbar', () => {
  it('renders navigation, tool, delete, zoom, and status controls', () => {
    const wrapper = mountToolbar()

    expect(wrapper.find('nav[aria-label="Viewer controls"]').exists()).toBe(true)
    expect(wrapper.find('[role="toolbar"][aria-label="Viewer actions"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Page 2 / 4')
    expect(wrapper.text()).toContain('Regions: 2')
    expect(wrapper.text()).toContain('Zoom: 100%')
    expect(wrapper.text()).toContain('(12, 34)')
    expect(getButton(wrapper, 'Previous').exists()).toBe(true)
    expect(getButton(wrapper, 'Next').exists()).toBe(true)
    expect(getButton(wrapper, 'Delete').exists()).toBe(true)
    expect(getButton(wrapper, 'Reset').exists()).toBe(true)
  })

  it('reflects disabled states from the current viewer state', () => {
    const wrapper = mountToolbar({
      selectedIndex: 0,
      hasSelectedRegion: false,
      zoomLevel: 0.25,
    })

    expectButtonDisabled(wrapper, 'Previous')
    expectButtonDisabled(wrapper, 'Next', false)
    expectButtonDisabled(wrapper, 'Delete')
    expectButtonDisabled(wrapper, '-')
    expectButtonDisabled(wrapper, '+', false)
  })

  it('disables next and zoom in at their upper bounds', () => {
    const wrapper = mountToolbar({
      selectedIndex: 3,
      zoomLevel: 8,
    })

    expectButtonDisabled(wrapper, 'Previous', false)
    expectButtonDisabled(wrapper, 'Next')
    expectButtonDisabled(wrapper, '+')
  })

  it('marks the active annotation tool', () => {
    const wrapper = mountToolbar({ activeTool: 'polygon' })

    expectToolButtonPressed(wrapper, 'Select', false)
    expectToolButtonPressed(wrapper, 'Rectangle', false)
    expectToolButtonPressed(wrapper, 'Polygon')
    expectToolButtonPressed(wrapper, 'Polyline', false)
  })

  it('emits toolbar action events', async () => {
    const wrapper = mountToolbar()

    await getButton(wrapper, 'Previous').trigger('click')
    await getButton(wrapper, 'Next').trigger('click')
    await getButton(wrapper, 'Rectangle').trigger('click')
    await getButton(wrapper, 'Polygon').trigger('click')
    await getButton(wrapper, 'Polyline').trigger('click')
    await getButton(wrapper, 'Select').trigger('click')
    await getButton(wrapper, 'Delete').trigger('click')
    await getButton(wrapper, '-').trigger('click')
    await getButton(wrapper, 'Reset').trigger('click')
    await getButton(wrapper, '+').trigger('click')

    expect(wrapper.emitted('previous-page')).toEqual([[]])
    expect(wrapper.emitted('next-page')).toEqual([[]])
    expect(wrapper.emitted('set-active-tool')).toEqual([
      ['rectangle'],
      ['polygon'],
      ['polyline'],
      ['select'],
    ])
    expect(wrapper.emitted('delete-selected-region')).toEqual([[]])
    expect(wrapper.emitted('zoom-out')).toEqual([[]])
    expect(wrapper.emitted('reset-zoom')).toEqual([[]])
    expect(wrapper.emitted('zoom-in')).toEqual([[]])
  })
})
