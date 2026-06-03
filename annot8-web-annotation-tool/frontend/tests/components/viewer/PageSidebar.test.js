import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PageSidebar from '../../../src/components/viewer/PageSidebar.vue'

const pages = ['/pages/pg1.jpeg', '/pages/pg2.jpeg', '/pages/pg3.jpeg']

function mountSidebar(props = {}) {
  return mount(PageSidebar, {
    props: {
      pages,
      selectedIndex: 0,
      collapsed: false,
      ...props,
    },
  })
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

describe('PageSidebar', () => {
  it('renders document page thumbnails', () => {
    const wrapper = mountSidebar()

    const thumbnails = wrapper.findAll('.thumb')

    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.text()).toContain('Pages')
    expect(thumbnails).toHaveLength(3)
    expect(thumbnails[0].find('img').attributes('src')).toBe('/pages/pg1.jpeg')
    expect(thumbnails[1].find('img').attributes('src')).toBe('/pages/pg2.jpeg')
    expect(thumbnails[2].text()).toContain('3')
  })

  it('marks the selected page thumbnail', () => {
    const wrapper = mountSidebar({ selectedIndex: 1 })

    expectCurrentThumbnail(wrapper.findAll('.thumb'), 1)
  })

  it('emits the selected page index when a thumbnail is clicked', async () => {
    const wrapper = mountSidebar()

    await wrapper.findAll('.thumb')[2].trigger('click')

    expect(wrapper.emitted('select-page')).toEqual([[2]])
  })

  it('emits a sidebar toggle event from the expanded state', async () => {
    const wrapper = mountSidebar()

    expect(wrapper.find('.sidebar').classes()).not.toContain('sidebar--collapsed')
    expect(wrapper.find('button[aria-label="Hide page thumbnails"]').exists()).toBe(true)

    await wrapper.find('button[aria-label="Hide page thumbnails"]').trigger('click')

    expect(wrapper.emitted('toggle-sidebar')).toEqual([[]])
  })

  it('emits a sidebar toggle event and hides thumbnails when collapsed', async () => {
    const wrapper = mountSidebar({ collapsed: true })

    expect(wrapper.find('.sidebar').classes()).toContain('sidebar--collapsed')
    expect(wrapper.findAll('.thumb')).toHaveLength(0)
    expect(wrapper.find('button[aria-label="Show page thumbnails"]').exists()).toBe(true)

    await wrapper.find('button[aria-label="Show page thumbnails"]').trigger('click')

    expect(wrapper.emitted('toggle-sidebar')).toEqual([[]])
  })
})
