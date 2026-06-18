import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerPage from '../../src/views/ViewerPage.vue'
import { ProjectDocumentModel } from '../../src/models/ProjectDocumentModel'
import * as documentApi from '../../src/services/documentApi'

const updateZoomSpy = vi.fn()
let fetchProjectDocumentSpy
let loadRegionsSpy
let saveRegionsSpy
const SAVE_DELAY_MS = 500

const PageSidebarStub = {
  name: 'PageSidebar',
  props: ['pages', 'selectedIndex', 'collapsed'],
  emits: ['select-page', 'toggle-sidebar'],
  template: `
    <aside class="page-sidebar-stub">
      <span data-testid="sidebar-state">{{ selectedIndex }} {{ collapsed }} {{ pages.length }}</span>
      <button type="button" data-testid="select-page-5" @click="$emit('select-page', 4)">Select page 5</button>
      <button type="button" data-testid="select-page-negative" @click="$emit('select-page', -1)">Select page -1</button>
      <button type="button" data-testid="select-page-out-of-range" @click="$emit('select-page', pages.length)">Select page out of range</button>
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
    'toolbarColor',
  ],
  emits: [
    'previous-page',
    'next-page',
    'set-active-tool',
    'update-region-color',
    'delete-selected-region',
  ],
  template: `
    <nav class="viewer-toolbar-stub">
      <span data-testid="toolbar-state">
        {{ selectedIndex }} {{ totalPages }} {{ activeTool }} {{ regionCount }}
        {{ hasSelectedRegion }} {{ toolbarColor }}
      </span>
      <button type="button" data-testid="previous-page" @click="$emit('previous-page')">Previous</button>
      <button type="button" data-testid="next-page" @click="$emit('next-page')">Next</button>
      <button type="button" data-testid="tool-rectangle" @click="$emit('set-active-tool', 'rectangle')">Rectangle</button>
      <button type="button" data-testid="tool-select" @click="$emit('set-active-tool', 'select')">Select</button>
      <button type="button" data-testid="set-region-color" @click="$emit('update-region-color', '#ff00aa')">Set color</button>
      <button
        type="button"
        data-testid="delete-region"
        :disabled="!hasSelectedRegion"
        @click="$emit('delete-selected-region')"
      >
        Delete
      </button>
    </nav>
  `,
}

const ViewerStatusBarStub = {
  name: 'ViewerStatusBar',
  props: [
    'selectedIndex',
    'totalPages',
    'zoomPercentage',
    'activeTool',
    'selectedRegion',
    'currentPageRegionCount',
    'mousePos',
    'saveStatus',
    'zoomLevel',
    'minZoomLevel',
    'maxZoomLevel',
    'zoomStep',
    'defaultZoomLevel',
  ],
  emits: ['zoom-out', 'zoom-in', 'update-zoom-level'],
  template: `
    <footer class="viewer-status-bar-stub">
      Page {{ selectedIndex + 1 }} / {{ totalPages }}
      Zoom {{ zoomPercentage }}%
      Tool {{ activeTool }}
      Selected {{ selectedRegion ? selectedRegion.id : 'none' }}
      Page regions {{ currentPageRegionCount }}
      Mouse {{ mousePos ? mousePos.x : '-' }} {{ mousePos ? mousePos.y : '-' }}
      Save {{ saveStatus }}
      <button type="button" data-testid="zoom-in" @click="$emit('zoom-in')">Zoom in</button>
      <button type="button" data-testid="zoom-out" @click="$emit('zoom-out')">Zoom out</button>
      <button type="button" data-testid="set-zoom-slider" @click="$emit('update-zoom-level', 2)">Set zoom</button>
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
    'regionCreationColor',
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
        {{ regionCreationColor }}
      </span>
      <button
        type="button"
        data-testid="add-region"
        @click="$emit('add-region', {
          id: nextRegionId,
          pageIndex,
          type: 'rectangle',
          left: 10,
          top: 20,
          right: 40,
          bottom: 60,
          color: regionCreationColor,
          annotations: []
        })"
      >
        Add region
      </button>
      <button
        type="button"
        data-testid="add-polygon-region"
        @click="$emit('add-region', {
          id: nextRegionId,
          pageIndex,
          type: 'polygon',
          points: [
            { x: 10, y: 20 },
            { x: 40, y: 20 },
            { x: 25, y: 60 }
          ],
          color: regionCreationColor,
          annotations: []
        })"
      >
        Add polygon
      </button>
      <button
        type="button"
        data-testid="add-polyline-region"
        @click="$emit('add-region', {
          id: nextRegionId,
          pageIndex,
          type: 'polyline',
          points: [
            { x: 10, y: 20 },
            { x: 40, y: 60 }
          ],
          color: regionCreationColor,
          annotations: []
        })"
      >
        Add polyline
      </button>
      <button
        type="button"
        data-testid="update-region"
        @click="$emit('update-region', {
          id: 'region-1',
          changes: {
            left: 99,
            top: 88,
            right: 129,
            bottom: 128
          }
        })"
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
      <button
        type="button"
        data-testid="leave-document"
        @click="$emit('mouse-position-change', null)"
      >
        Leave document
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
  await Promise.resolve()
}

function getStub(wrapper, component) {
  return wrapper.findComponent(component)
}

function currentRegions(wrapper) {
  return getStub(wrapper, AnnotationCanvasStub).props('regions')
}

async function advanceSaveDelay(wrapper) {
  vi.advanceTimersByTime(SAVE_DELAY_MS)
  await wrapper.vm.$nextTick()
}

function storedRegion(overrides = {}) {
  return {
    id: 'region-7',
    pageIndex: 0,
    type: 'rectangle',
    left: 10,
    top: 20,
    right: 40,
    bottom: 60,
    color: '#0d6efd',
    annotations: [],
    ...overrides,
  }
}

describe('ViewerPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
    ProjectDocumentModel.id = 'doc1'
    ProjectDocumentModel.pages = Array.from(
      { length: 15 },
      (_, index) => `/documents/doc1/pages/pg${index + 1}.jpeg`
    )
    updateZoomSpy.mockClear()
    fetchProjectDocumentSpy = vi.spyOn(documentApi, 'fetchProjectDocument').mockResolvedValue({
      id: 'doc1',
      title: 'Sample document',
      pages: ProjectDocumentModel.pages,
      regions: [],
    })
    loadRegionsSpy = vi.spyOn(ProjectDocumentModel, 'loadRegions').mockReturnValue([])
    saveRegionsSpy = vi.spyOn(ProjectDocumentModel, 'save').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
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
        toolbarColor: '#0d6efd',
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
        regionCreationColor: '#0d6efd',
      })
    )
    expect(statusBar.text()).toContain('Page 1 / 15')
    expect(statusBar.text()).toContain('Zoom 100%')
    expect(statusBar.text()).toContain('Tool select')
    expect(statusBar.props()).toEqual(
      expect.objectContaining({
        selectedRegion: null,
        currentPageRegionCount: 0,
        mousePos: null,
        saveStatus: 'saved',
        zoomLevel: 1,
        zoomPercentage: 100,
        minZoomLevel: 0.25,
        maxZoomLevel: 8,
        zoomStep: 0.25,
        defaultZoomLevel: 1,
      })
    )
  })

  it('loads stored regions from ProjectDocumentModel.loadRegions() when the document opens', async () => {
    const storedRegions = [storedRegion()]
    loadRegionsSpy.mockReturnValue(storedRegions)

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(loadRegionsSpy).toHaveBeenCalledTimes(1)
    expect(currentRegions(wrapper)).toEqual(storedRegions)
    expect(getStub(wrapper, ViewerToolbarStub).props('regionCount')).toBe(1)
  })

  it('still loads backend document metadata and pages with fetchProjectDocument()', async () => {
    const backendPages = ['/documents/doc1/pages/backend-1.jpeg', '/documents/doc1/pages/backend-2.jpeg']
    fetchProjectDocumentSpy.mockResolvedValue({
      id: 'doc1',
      title: 'Backend document',
      pages: backendPages,
      regions: [storedRegion({ id: 'backend-region' })],
    })

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(fetchProjectDocumentSpy).toHaveBeenCalledTimes(1)
    expect(getStub(wrapper, PageSidebarStub).props('pages')).toEqual(backendPages)
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedPage')).toBe(backendPages[0])
  })

  it('does not use backend-provided regions as the active region state', async () => {
    const localRegions = [storedRegion({ id: 'local-region' })]
    const backendRegions = [storedRegion({ id: 'backend-region' })]
    loadRegionsSpy.mockReturnValue(localRegions)
    fetchProjectDocumentSpy.mockResolvedValue({
      id: 'doc1',
      title: 'Backend document',
      pages: ProjectDocumentModel.pages,
      regions: backendRegions,
    })

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(currentRegions(wrapper)).toEqual(localRegions)
    expect(currentRegions(wrapper)).not.toEqual(backendRegions)
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
    expect(getStub(wrapper, ViewerStatusBarStub).props('currentPageRegionCount')).toBe(0)

    await wrapper.find('[data-testid="toggle-sidebar"]').trigger('click')

    expect(getStub(wrapper, PageSidebarStub).props('collapsed')).toBe(true)
    expect(updateZoomSpy).toHaveBeenCalledTimes(1)
  })

  it('wires toolbar navigation and tool events, and status bar zoom events to child props', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="next-page"]').trigger('click')
    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="zoom-in"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 1,
        activeTool: 'rectangle',
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 1,
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

    await wrapper.find('[data-testid="previous-page"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 0,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        zoomLevel: 1,
        zoomPercentage: 100,
      })
    )
  })

  it('clears selected region, mouse coordinates, and zoom when navigating to next page', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="move-mouse"]').trigger('click')
    await wrapper.find('[data-testid="set-zoom-slider"]').trigger('click')
    await wrapper.find('[data-testid="next-page"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 1,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        pageIndex: 1,
        selectedRegionId: null,
        zoomLevel: 1,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        selectedRegion: null,
        mousePos: null,
        zoomLevel: 1,
      })
    )
  })

  it('clears selected region when navigating to previous page', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="next-page"]').trigger('click')
    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="previous-page"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 0,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        pageIndex: 0,
        selectedRegionId: null,
      })
    )
    expect(currentRegions(wrapper)).toHaveLength(1)
  })

  it('clears selected region when selecting a page from the sidebar', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="select-page-5"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        selectedIndex: 4,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe(null)
    expect(currentRegions(wrapper)).toHaveLength(1)
  })

  it('disables delete after navigating away from a selected region', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-region"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="next-page"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-region"]').attributes('disabled')).toBeDefined()
  })

  it('does not delete a previous-page region when delete is triggered after navigation', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="next-page"]').trigger('click')
    getStub(wrapper, ViewerToolbarStub).vm.$emit('delete-selected-region')
    await wrapper.vm.$nextTick()

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
      }),
    ])
  })

  it('rejects invalid page navigation targets without changing the current page', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="set-zoom-slider"]').trigger('click')
    await wrapper.find('[data-testid="move-mouse"]').trigger('click')
    await wrapper.find('[data-testid="select-page-negative"]').trigger('click')

    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        pageIndex: 0,
        zoomLevel: 2,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props('mousePos')).toEqual({ x: 321, y: 654 })

    await wrapper.find('[data-testid="select-page-out-of-range"]').trigger('click')

    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        pageIndex: 0,
        zoomLevel: 2,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props('mousePos')).toEqual({ x: 321, y: 654 })
  })

  it('updates zoom from the status bar slider and clamps it to configured limits', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="set-zoom-slider"]').trigger('click')

    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        zoomLevel: 2,
        zoomPercentage: 200,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props('zoomLevel')).toBe(2)

    getStub(wrapper, ViewerStatusBarStub).vm.$emit('update-zoom-level', 99)
    await wrapper.vm.$nextTick()

    expect(getStub(wrapper, ViewerStatusBarStub).props('zoomLevel')).toBe(8)

    getStub(wrapper, ViewerStatusBarStub).vm.$emit('update-zoom-level', -1)
    await wrapper.vm.$nextTick()

    expect(getStub(wrapper, ViewerStatusBarStub).props('zoomLevel')).toBe(0.25)
  })

  it('stores regions emitted by the canvas and updates selected-region state', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
      }),
    ])
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saving')
    expect(saveRegionsSpy).not.toHaveBeenCalled()
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(currentRegions(wrapper))
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saved')
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        regionCount: 1,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        selectedRegionId: null,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        selectedRegion: null,
        currentPageRegionCount: 1,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props('nextRegionId')).toBe('region-2')

    await wrapper.find('[data-testid="select-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(true)
    expect(getStub(wrapper, ViewerToolbarStub).props('toolbarColor')).toBe('#0d6efd')
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe('region-1')
    expect(getStub(wrapper, ViewerStatusBarStub).props('selectedRegion')).toEqual(
      expect.objectContaining({
        id: 'region-1',
        type: 'rectangle',
      })
    )

    await wrapper.find('[data-testid="clear-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(false)
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe(null)
    expect(getStub(wrapper, ViewerStatusBarStub).props('selectedRegion')).toBe(null)
  })

  it('debounces local saves and stores the latest region state once', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saving')
    expect(saveRegionsSpy).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(SAVE_DELAY_MS - 1)
    expect(saveRegionsSpy).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="add-polygon-region"]').trigger('click')

    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1)
    expect(saveRegionsSpy).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="add-polyline-region"]').trigger('click')

    const latestRegions = currentRegions(wrapper)
    expect(vi.getTimerCount()).toBe(1)

    await advanceSaveDelay(wrapper)

    expect(saveRegionsSpy).toHaveBeenCalledTimes(1)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(latestRegions)
    expect(latestRegions).toEqual([
      expect.objectContaining({ id: 'region-1', type: 'rectangle' }),
      expect.objectContaining({ id: 'region-2', type: 'polygon' }),
      expect.objectContaining({ id: 'region-3', type: 'polyline' }),
    ])
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saved')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('allows a later local save retry after a storage error', async () => {
    const error = new Error('save failed')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    saveRegionsSpy.mockImplementationOnce(() => {
      throw error
    })
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await advanceSaveDelay(wrapper)

    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(error)

    await wrapper.find('[data-testid="add-polygon-region"]').trigger('click')
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saving')

    await advanceSaveDelay(wrapper)

    expect(saveRegionsSpy).toHaveBeenCalledTimes(2)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(currentRegions(wrapper))
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saved')

    consoleErrorSpy.mockRestore()
  })

  it('saves immediately on unmount when a local save is pending', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    const latestRegions = currentRegions(wrapper)

    expect(vi.getTimerCount()).toBe(1)

    wrapper.unmount()

    expect(saveRegionsSpy).toHaveBeenCalledTimes(1)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(latestRegions)
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(SAVE_DELAY_MS)

    expect(saveRegionsSpy).toHaveBeenCalledTimes(1)
  })

  it('does not save on unmount when no local save is pending', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    wrapper.unmount()

    expect(saveRegionsSpy).not.toHaveBeenCalled()
  })

  it('requests local persistence for add, update, color, and delete operations', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await advanceSaveDelay(wrapper)

    await wrapper.find('[data-testid="update-region"]').trigger('click')
    await advanceSaveDelay(wrapper)

    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="set-region-color"]').trigger('click')
    await advanceSaveDelay(wrapper)

    await wrapper.find('[data-testid="delete-region"]').trigger('click')
    await advanceSaveDelay(wrapper)

    expect(saveRegionsSpy).toHaveBeenCalledTimes(4)
  })

  it('returns to select mode without selecting new polygon and polyline regions', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="add-polygon-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        type: 'polygon',
      }),
    ])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        selectedRegionId: null,
        nextRegionId: 'region-2',
      })
    )

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="add-polyline-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        type: 'polygon',
      }),
      expect.objectContaining({
        id: 'region-2',
        type: 'polyline',
      }),
    ])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        selectedRegionId: null,
        nextRegionId: 'region-3',
      })
    )
  })

  it('updates, deletes, and persists region state from child component events', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="update-region"]').trigger('click')

    expect(currentRegions(wrapper)[0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        left: 99,
        top: 88,
        right: 129,
        bottom: 128,
      })
    )
    expect(saveRegionsSpy).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="delete-selected"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([])
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith([])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        regionCount: 0,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        selectedRegion: null,
        currentPageRegionCount: 0,
      })
    )
  })

  it('stores the selected creation color and passes it to the toolbar and canvas when no region is selected', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(getStub(wrapper, ViewerToolbarStub).props('toolbarColor')).toBe('#0d6efd')
    expect(getStub(wrapper, AnnotationCanvasStub).props('regionCreationColor')).toBe('#0d6efd')

    await wrapper.find('[data-testid="set-region-color"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('toolbarColor')).toBe('#ff00aa')
    expect(getStub(wrapper, AnnotationCanvasStub).props('regionCreationColor')).toBe('#ff00aa')
  })

  it('uses the selected creation color for new regions without recoloring existing regions', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(currentRegions(wrapper)[0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        color: '#0d6efd',
      })
    )

    await wrapper.find('[data-testid="set-region-color"]').trigger('click')

    expect(currentRegions(wrapper)[0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        color: '#0d6efd',
      })
    )

    await wrapper.find('[data-testid="select-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        hasSelectedRegion: true,
        toolbarColor: '#0d6efd',
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props('regionCreationColor')).toBe('#ff00aa')

    await wrapper.find('[data-testid="clear-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        hasSelectedRegion: false,
        toolbarColor: '#ff00aa',
      })
    )

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="add-polygon-region"]').trigger('click')
    await wrapper.find('[data-testid="add-polyline-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        color: '#0d6efd',
      }),
      expect.objectContaining({
        id: 'region-2',
        type: 'rectangle',
        color: '#ff00aa',
      }),
      expect.objectContaining({
        id: 'region-3',
        type: 'polygon',
        color: '#ff00aa',
      }),
      expect.objectContaining({
        id: 'region-4',
        type: 'polyline',
        color: '#ff00aa',
      }),
    ])
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(currentRegions(wrapper))
  })

  it('edits a selected region color without overwriting the creation color', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        hasSelectedRegion: true,
        toolbarColor: '#0d6efd',
      })
    )

    await wrapper.find('[data-testid="set-region-color"]').trigger('click')

    expect(currentRegions(wrapper)[0]).toEqual(
      expect.objectContaining({
        id: 'region-1',
        color: '#ff00aa',
      })
    )
    expect(getStub(wrapper, ViewerToolbarStub).props('toolbarColor')).toBe('#ff00aa')
    expect(getStub(wrapper, AnnotationCanvasStub).props('regionCreationColor')).toBe('#0d6efd')
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(currentRegions(wrapper))

    await wrapper.find('[data-testid="clear-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        hasSelectedRegion: false,
        toolbarColor: '#0d6efd',
      })
    )
    expect(currentRegions(wrapper)[0]).toEqual(
      expect.objectContaining({
        color: '#ff00aa',
      })
    )

    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        color: '#ff00aa',
      }),
      expect.objectContaining({
        id: 'region-2',
        color: '#0d6efd',
      }),
    ])
  })

  it('deletes the selected region from toolbar delete events', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-region"]').trigger('click')
    await wrapper.find('[data-testid="delete-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([])
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith([])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        regionCount: 0,
        hasSelectedRegion: false,
      })
    )
  })

  it('sets save status to error when persistence fails', async () => {
    const error = new Error('save failed')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    saveRegionsSpy.mockImplementationOnce(() => {
      throw error
    })
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')

    await advanceSaveDelay(wrapper)
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(error)

    consoleErrorSpy.mockRestore()
  })

  it('updates status information from canvas mouse-position events', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="move-mouse"]').trigger('click')

    const statusBar = getStub(wrapper, ViewerStatusBarStub)

    expect(statusBar.text()).toContain('Tool rectangle')
    expect(statusBar.text()).toContain('Mouse 321 654')

    await wrapper.find('[data-testid="leave-document"]').trigger('click')

    expect(statusBar.props('mousePos')).toBe(null)
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

  it('does not select the last created region when switching to select tool', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        selectedRegionId: null,
      })
    )
  })
})
