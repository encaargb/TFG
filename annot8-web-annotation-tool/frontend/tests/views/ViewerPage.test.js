import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerPage from '../../src/views/ViewerPage.vue'
import { ProjectDocumentModel } from '../../src/models/ProjectDocumentModel'

const updateZoomSpy = vi.fn()

const PageSidebarStub = {
  name: 'PageSidebar',
  props: ['pages', 'selectedIndex', 'collapsed'],
  emits: ['select-page', 'toggle-sidebar'],
  template: `
    <aside class="page-sidebar-stub">
      <span data-testid="sidebar-state">{{ selectedIndex }} {{ collapsed }} {{ pages.length }}</span>
      <button type="button" data-testid="select-page-5" @click="$emit('select-page', 4)">Select page 5</button>
      <button type="button" data-testid="toggle-sidebar" @click="$emit('toggle-sidebar')">Toggle sidebar</button>
    </aside>
  `,
}

const ViewerToolbarStub = {
  name: 'ViewerToolbar',
  props: [
    'selectedIndex',
    'totalPages',
    'activeTool',
    'regionCount',
    'hasSelectedRegion',
    'zoomLevel',
    'minZoom',
    'maxZoom',
    'zoomPercentage',
    'mousePos',
  ],
  emits: [
    'previous-page',
    'next-page',
    'set-active-tool',
    'delete-selected-region',
    'zoom-out',
    'reset-zoom',
    'zoom-in',
  ],
  template: `
    <nav class="viewer-toolbar-stub">
      <span data-testid="toolbar-state">
        {{ selectedIndex }} {{ totalPages }} {{ activeTool }} {{ regionCount }}
        {{ hasSelectedRegion }} {{ zoomLevel }} {{ zoomPercentage }}
      </span>
      <button type="button" data-testid="previous-page" @click="$emit('previous-page')">Previous</button>
      <button type="button" data-testid="next-page" @click="$emit('next-page')">Next</button>
      <button type="button" data-testid="tool-rectangle" @click="$emit('set-active-tool', 'rectangle')">Rectangle</button>
      <button type="button" data-testid="tool-select" @click="$emit('set-active-tool', 'select')">Select</button>
      <button type="button" data-testid="delete-region" @click="$emit('delete-selected-region')">Delete</button>
      <button type="button" data-testid="zoom-in" @click="$emit('zoom-in')">Zoom in</button>
      <button type="button" data-testid="zoom-out" @click="$emit('zoom-out')">Zoom out</button>
      <button type="button" data-testid="reset-zoom" @click="$emit('reset-zoom')">Reset</button>
    </nav>
  `,
}

const ViewerStatusBarStub = {
  name: 'ViewerStatusBar',
  props: ['selectedIndex', 'totalPages', 'zoomPercentage', 'activeTool', 'regionCount', 'mousePos'],
  template: `
    <footer class="viewer-status-bar-stub">
      Page {{ selectedIndex + 1 }} / {{ totalPages }}
      Zoom {{ zoomPercentage }}%
      Tool {{ activeTool }}
      Regions {{ regionCount }}
      X {{ mousePos.x }} Y {{ mousePos.y }}
    </footer>
  `,
}

const AnnotationCanvasStub = {
  name: 'AnnotationCanvas',
  props: [
    'selectedPage',
    'pageIndex',
    'regions',
    'selectedRegionId',
    'activeTool',
    'zoomLevel',
    'nextRegionId',
  ],
  emits: [
    'add-region',
    'update-region',
    'select-region',
    'clear-selected-region',
    'delete-selected-region',
    'mouse-position-change',
  ],
  setup(_, { expose }) {
    expose({ updateZoom: updateZoomSpy })
  },
  template: `
    <section class="annotation-canvas-stub">
      <span data-testid="canvas-state">
        {{ selectedPage }} {{ pageIndex }} {{ regions.length }}
        {{ selectedRegionId }} {{ activeTool }} {{ zoomLevel }} {{ nextRegionId }}
      </span>
      <button
        type="button"
        data-testid="add-region"
        @click="$emit('add-region', {
          id: nextRegionId,
          pageIndex,
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 30,
          height: 40,
          color: '#0d6efd',
          annotations: []
        })"
      >
        Add region
      </button>
      <button
        type="button"
        data-testid="update-region"
        @click="$emit('update-region', { id: 'region-1', changes: { x: 99, y: 88 } })"
      >
        Update region
      </button>
      <button type="button" data-testid="select-region" @click="$emit('select-region', 'region-1')">Select region</button>
      <button type="button" data-testid="clear-region" @click="$emit('clear-selected-region')">Clear region</button>
      <button type="button" data-testid="delete-selected" @click="$emit('delete-selected-region')">Delete selected</button>
      <button
        type="button"
        data-testid="move-mouse"
        @click="$emit('mouse-position-change', { x: 321, y: 654 })"
      >
        Move mouse
      </button>
    </section>
  `,
}

function mountViewerPage() {
  return mount(ViewerPage, {
    global: {
      stubs: {
        PageSidebar: PageSidebarStub,
        ViewerToolbar: ViewerToolbarStub,
        ViewerStatusBar: ViewerStatusBarStub,
        AnnotationCanvas: AnnotationCanvasStub,
      },
    },
  })
}

async function flushMountedFetch() {
  await Promise.resolve()
}

function getStub(wrapper, component) {
  return wrapper.findComponent(component)
}

describe('ViewerPage', () => {
  beforeEach(() => {
    ProjectDocumentModel.id = 'doc1'
    ProjectDocumentModel.pages = Array.from(
      { length: 15 },
      (_, index) => `/documents/doc1/pages/pg${index + 1}.jpeg`
    )
    ProjectDocumentModel.regions = []
    updateZoomSpy.mockClear()
  })

  it('passes initial viewer state to the extracted child components', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    const sidebar = getStub(wrapper, PageSidebarStub)
    const toolbar = getStub(wrapper, ViewerToolbarStub)
    const canvas = getStub(wrapper, AnnotationCanvasStub)
    const statusBar = getStub(wrapper, ViewerStatusBarStub)

    expect(sidebar.props()).toEqual(
      expect.objectContaining({
        pages: ProjectDocumentModel.pages,
        selectedIndex: 0,
        collapsed: false,
      })
    )
    expect(toolbar.props()).toEqual(
      expect.objectContaining({
        selectedIndex: 0,
        totalPages: 15,
        activeTool: 'select',
        regionCount: 0,
        hasSelectedRegion: false,
        zoomLevel: 1,
        zoomPercentage: 100,
      })
    )
    expect(canvas.props()).toEqual(
      expect.objectContaining({
        selectedPage: '/documents/doc1/pages/pg1.jpeg',
        pageIndex: 0,
        regions: [],
        selectedRegionId: null,
        activeTool: 'select',
        zoomLevel: 1,
        nextRegionId: 'region-1',
      })
    )
    expect(statusBar.text()).toContain('Page 1 / 15')
    expect(statusBar.text()).toContain('Zoom 100%')
    expect(statusBar.text()).toContain('Tool select')
    expect(statusBar.text()).toContain('Regions 0')
  })

  it('wires sidebar page selection and collapse events to parent state', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    await wrapper.find('[data-testid="select-page-5"]').trigger('click')

    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        selectedPage: '/documents/doc1/pages/pg5.jpeg',
        pageIndex: 4,
        zoomLevel: 1,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).text()).toContain('Page 5 / 15')

    await wrapper.find('[data-testid="toggle-sidebar"]').trigger('click')

    expect(getStub(wrapper, PageSidebarStub).props('collapsed')).toBe(true)
    expect(updateZoomSpy).toHaveBeenCalledTimes(1)
  })

  it('wires toolbar navigation, tool, and zoom events to child props', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="next-page"]').trigger('click')
    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="zoom-in"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 1,
        activeTool: 'rectangle',
        zoomLevel: 1.25,
        zoomPercentage: 125,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        pageIndex: 1,
        activeTool: 'rectangle',
        zoomLevel: 1.25,
      })
    )

    await wrapper.find('[data-testid="reset-zoom"]').trigger('click')
    await wrapper.find('[data-testid="previous-page"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 0,
        zoomLevel: 1,
        zoomPercentage: 100,
      })
    )
  })

  it('stores regions emitted by the canvas and updates selected-region state', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(ProjectDocumentModel.regions).toEqual([
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
      }),
    ])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        regionCount: 1,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props('nextRegionId')).toBe('region-2')

    await wrapper.find('[data-testid="select-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(true)
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe('region-1')

    await wrapper.find('[data-testid="clear-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(false)
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe(null)
  })

  it('updates, deletes, and persists region state from child component events', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="update-region"]').trigger('click')

    expect(ProjectDocumentModel.regions[0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        x: 99,
        y: 88,
        width: 30,
        height: 40,
      })
    )

    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="delete-selected"]').trigger('click')

    expect(ProjectDocumentModel.regions).toEqual([])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        regionCount: 0,
        hasSelectedRegion: false,
      })
    )
  })

  it('updates status information from canvas mouse-position events', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="move-mouse"]').trigger('click')

    const statusBar = getStub(wrapper, ViewerStatusBarStub)

    expect(statusBar.text()).toContain('Tool rectangle')
    expect(statusBar.text()).toContain('X 321 Y 654')
  })

  it('clears the selected region when switching to a drawing tool', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(true)

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(false)
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'rectangle',
        selectedRegionId: null,
      })
    )
  })
})
