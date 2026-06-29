import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const contextMenuMock = vi.hoisted(() => ({
  showContextMenu: vi.fn(),
  closeContextMenu: vi.fn(),
}))

vi.mock('@imengyu/vue3-context-menu', () => ({
  default: contextMenuMock,
}))

import ViewerPage from '../../src/views/ViewerPage.vue'
import AnnotationSidebar from '../../src/components/viewer/AnnotationSidebar.vue'
import * as projectDocumentModel from '../../src/models/ProjectDocumentModel'
import * as documentApi from '../../src/services/documentApi'

const updateZoomSpy = vi.fn()
let fetchProjectDocumentSpy
let createProjectDocumentModelSpy
let loadRegionsSpy
let saveRegionsSpy
const SAVE_DELAY_MS = 500
const samplePages = Array.from(
  { length: 15 },
  (_, index) => `/documents/doc1/pages/pg${index + 1}.jpeg`
)
const sampleSchemaPublications = [
  {
    id: '58',
    name: 'VLT: Morphology: Framing Structure (v.2)',
    annotations: {
      children: [
        {
          id: 'annotation-class-1',
          name: 'Activity',
          type: 'ANNOTATION-CLASS',
          children: [
            {
              id: 'annotation-1',
              name: 'Active entity',
              type: 'ANNOTATION',
              'taxonomy-path': '58/annotation-class-1/annotation-1',
              children: [],
            },
            {
              id: 'annotation-2',
              name: 'Passive entity',
              type: 'ANNOTATION',
              'taxonomy-path': '58/annotation-class-1/annotation-2',
              children: [],
            },
          ],
        },
      ],
    },
  },
]

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
      <button type="button" data-testid="tool-polygon" @click="$emit('set-active-tool', 'polygon')">Polygon</button>
      <button type="button" data-testid="tool-polyline" @click="$emit('set-active-tool', 'polyline')">Polyline</button>
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
    'overlappingRegionCount',
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
      Overlaps {{ overlappingRegionCount }}
      Page regions {{ currentPageRegionCount }}
      Mouse {{ mousePos ? mousePos.x : '-' }} {{ mousePos ? mousePos.y : '-' }}
      Save {{ saveStatus }}
      <button type="button" data-testid="zoom-in" @click="$emit('zoom-in')">Zoom in</button>
      <button type="button" data-testid="zoom-out" @click="$emit('zoom-out')">Zoom out</button>
      <button type="button" data-testid="set-zoom-slider" @click="$emit('update-zoom-level', 2)">Set zoom</button>
    </footer>
  `,
}

const BModalStub = {
  name: 'BModal',
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template: `
    <section v-if="modelValue" class="b-modal-stub">
      <h2 data-testid="modal-title">{{ title }}</h2>
      <div data-testid="modal-body"><slot /></div>
      <div data-testid="modal-footer"><slot name="footer" /></div>
    </section>
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
    'schemaPublications',
  ],
  emits: [
    'add-region',
    'update-region',
    'select-region',
    'selection-overlap-change',
    'clear-selected-region',
    'delete-selected-region',
    'mouse-position-change',
  ],
  methods: {
    emitOverlapSelection() {
      this.$emit('select-region', 'region-1')
      this.$emit('selection-overlap-change', 2)
    },
  },
  setup(_, { expose }) {
    expose({ updateZoom: updateZoomSpy })
  },
  template: `
    <section class="annotation-canvas-stub">
      <span data-testid="canvas-state">
        {{ selectedPage }} {{ pageIndex }} {{ regions.length }}
        {{ selectedRegionId }} {{ activeTool }} {{ zoomLevel }} {{ nextRegionId }}
        {{ regionCreationColor }} {{ schemaPublications.length }}
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
      <button type="button" data-testid="select-overlap-region" @click="emitOverlapSelection">Select overlap region</button>
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
        BModal: BModalStub,
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

function latestContextMenuItems() {
  return contextMenuMock.showContextMenu.mock.calls.at(-1)?.[0]?.items ?? []
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

function annotatedStoredRegion(overrides = {}) {
  return storedRegion({
    annotations: [
      {
        schemaPublicationId: '58',
        annotationId: 'annotation-1',
        taxonomyPath: '58/annotation-class-1/annotation-1',
      },
      {
        schemaPublicationId: '58',
        annotationId: 'annotation-2',
        taxonomyPath: '58/annotation-class-1/annotation-2',
      },
    ],
    ...overrides,
  })
}

describe('ViewerPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
    updateZoomSpy.mockClear()
    contextMenuMock.showContextMenu.mockClear()
    contextMenuMock.closeContextMenu.mockClear()
    fetchProjectDocumentSpy = vi.spyOn(documentApi, 'fetchProjectDocument').mockResolvedValue({
      id: 'doc1',
      title: 'Sample document',
      pages: samplePages,
      regions: [],
    })
    loadRegionsSpy = vi.fn().mockReturnValue([])
    saveRegionsSpy = vi.fn()
    createProjectDocumentModelSpy = vi
      .spyOn(projectDocumentModel, 'createProjectDocumentModel')
      .mockImplementation((document) => ({
        id: document.id,
        title: document.title,
        pages: document.pages,
        schemaPublications: document.schemaPublications ?? sampleSchemaPublications,
        loadRegions: loadRegionsSpy,
        save: saveRegionsSpy,
      }))
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
        pages: samplePages,
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
        schemaPublications: sampleSchemaPublications,
      })
    )
    expect(statusBar.text()).toContain('Page 1 / 15')
    expect(statusBar.text()).toContain('Zoom 100%')
    expect(statusBar.text()).toContain('Tool select')
    expect(wrapper.text()).toContain('Annotations')
    expect(wrapper.text()).toContain('No region selected')
    expect(wrapper.text()).toContain(
      'Select a region on the document to view and manage its annotations.'
    )
    expect(wrapper.findComponent(AnnotationSidebar).props('schemaPublications')).toEqual(
      sampleSchemaPublications
    )
    expect(wrapper.findComponent(AnnotationSidebar).props('selectedAnnotation')).toBe(null)
    expect(statusBar.props()).toEqual(
      expect.objectContaining({
        selectedRegion: null,
        overlappingRegionCount: 0,
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

  it('loads stored regions from the active document model when the document opens', async () => {
    const storedRegions = [storedRegion()]
    loadRegionsSpy.mockReturnValue(storedRegions)

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(loadRegionsSpy).toHaveBeenCalledTimes(1)
    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        ...storedRegions[0],
        zIndex: 0,
      }),
    ])
    expect(getStub(wrapper, ViewerToolbarStub).props('regionCount')).toBe(1)
  })

  it('still loads backend document metadata and pages with fetchProjectDocument()', async () => {
    const backendPages = ['/documents/doc1/pages/backend-1.jpeg', '/documents/doc1/pages/backend-2.jpeg']
    const backendDocument = {
      id: 'doc1',
      title: 'Backend document',
      pages: backendPages,
      regions: [storedRegion({ id: 'backend-region' })],
    }
    fetchProjectDocumentSpy.mockResolvedValue(backendDocument)

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(fetchProjectDocumentSpy).toHaveBeenCalledTimes(1)
    expect(createProjectDocumentModelSpy).toHaveBeenCalledWith(backendDocument)
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
      pages: samplePages,
      regions: backendRegions,
    })

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        ...localRegions[0],
        zIndex: 0,
      }),
    ])
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

    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
        zIndex: 0,
      }),
    ])
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saving')
    expect(saveRegionsSpy).not.toHaveBeenCalled()
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(currentRegions(wrapper))
    expect(saveRegionsSpy.mock.calls.at(-1)[0]).toEqual([
      expect.objectContaining({ id: 'region-1', zIndex: 0 }),
    ])
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saved')
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'rectangle',
        regionCount: 1,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: 'rectangle',
        selectedRegionId: null,
      })
    )
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        selectedRegion: null,
        overlappingRegionCount: 0,
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
    expect(wrapper.text()).toContain('No annotations yet')
    expect(wrapper.text()).toContain('Add an annotation to start describing this region.')

    await wrapper.find('[data-testid="clear-region"]').trigger('click')

    expect(getStub(wrapper, ViewerToolbarStub).props('hasSelectedRegion')).toBe(false)
    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe(null)
    expect(getStub(wrapper, ViewerStatusBarStub).props('selectedRegion')).toBe(null)
    expect(getStub(wrapper, ViewerStatusBarStub).props('overlappingRegionCount')).toBe(0)
  })

  it('stores selected annotation as temporary sidebar state and replaces it when another leaf is clicked', async () => {
    loadRegionsSpy.mockReturnValue([annotatedStoredRegion({ id: 'region-1' })])

    const wrapper = mountViewerPage()
    await flushMountedFetch()
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    const sidebar = wrapper.findComponent(AnnotationSidebar)
    const annotationLeaves = sidebar.findAll('button.annotation-tree-leaf')

    await annotationLeaves[0].trigger('click')

    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: 'annotation-1',
      annotationName: 'Active entity',
    })
    expect(sidebar.findAll('.annotation-tree-leaf-selected')).toHaveLength(1)

    await annotationLeaves[1].trigger('click')

    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: 'annotation-2',
      annotationName: 'Passive entity',
    })
    expect(sidebar.findAll('.annotation-tree-leaf-selected')).toHaveLength(1)
    expect(currentRegions(wrapper)).toEqual([annotatedStoredRegion({ id: 'region-1', zIndex: 0 })])
    expect(saveRegionsSpy).not.toHaveBeenCalled()
  })

  it('right-clicks a selected annotation leaf, keeps it selected, and opens a Delete annotation context menu that opens the confirmation modal', async () => {
    loadRegionsSpy.mockReturnValue([annotatedStoredRegion({ id: 'region-1' })])

    const wrapper = mountViewerPage()
    await flushMountedFetch()
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    const sidebar = wrapper.findComponent(AnnotationSidebar)

    await sidebar.findAll('button.annotation-tree-leaf')[0].trigger('contextmenu', {
      clientX: 120,
      clientY: 48,
    })

    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: 'annotation-1',
      annotationName: 'Active entity',
    })
    expect(latestContextMenuItems().map((item) => item.label)).toEqual(['Delete annotation'])

    latestContextMenuItems()[0].onClick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.b-modal-stub').exists()).toBe(true)
    expect(wrapper.find('[data-testid="modal-title"]').text()).toBe('Delete annotation')
    expect(wrapper.text()).toContain('Are you sure you want to delete the annotation “Active entity”?')
  })

  it('opens the same confirmation modal from Delete and Backspace, and Backspace prevents its default action', async () => {
    loadRegionsSpy.mockReturnValue([annotatedStoredRegion({ id: 'region-1' })])

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.b-modal-stub').exists()).toBe(false)

    await wrapper.find('[data-testid="select-region"]').trigger('click')
    const sidebar = wrapper.findComponent(AnnotationSidebar)
    await sidebar.findAll('button.annotation-tree-leaf')[0].trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.b-modal-stub').exists()).toBe(true)

    getStub(wrapper, BModalStub).vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()

    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true })
    const preventDefaultSpy = vi.spyOn(backspaceEvent, 'preventDefault')

    window.dispatchEvent(backspaceEvent)
    await wrapper.vm.$nextTick()

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(backspaceEvent.defaultPrevented).toBe(true)
    expect(wrapper.find('.b-modal-stub').exists()).toBe(true)
  })

  it('canceling or closing the deletion modal keeps the assignment and selection', async () => {
    loadRegionsSpy.mockReturnValue([annotatedStoredRegion({ id: 'region-1' })])

    const wrapper = mountViewerPage()
    await flushMountedFetch()
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    let sidebar = wrapper.findComponent(AnnotationSidebar)
    await sidebar.findAll('button.annotation-tree-leaf')[0].trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()

    await wrapper.find('button.btn-secondary').trigger('click')
    await wrapper.vm.$nextTick()

    sidebar = wrapper.findComponent(AnnotationSidebar)
    expect(wrapper.find('.b-modal-stub').exists()).toBe(false)
    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: 'annotation-1',
      annotationName: 'Active entity',
    })
    expect(currentRegions(wrapper)).toEqual([annotatedStoredRegion({ id: 'region-1', zIndex: 0 })])
    expect(saveRegionsSpy).not.toHaveBeenCalled()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()

    getStub(wrapper, BModalStub).vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()

    sidebar = wrapper.findComponent(AnnotationSidebar)
    expect(wrapper.find('.b-modal-stub').exists()).toBe(false)
    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: 'annotation-1',
      annotationName: 'Active entity',
    })
    expect(currentRegions(wrapper)).toEqual([annotatedStoredRegion({ id: 'region-1', zIndex: 0 })])
  })

  it('confirms annotation deletion through the existing region update and persistence flow, clearing selection', async () => {
    loadRegionsSpy.mockReturnValue([annotatedStoredRegion({ id: 'region-1' })])

    const wrapper = mountViewerPage()
    await flushMountedFetch()
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    let sidebar = wrapper.findComponent(AnnotationSidebar)
    await sidebar.findAll('button.annotation-tree-leaf')[0].trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-danger').trigger('click')

    sidebar = wrapper.findComponent(AnnotationSidebar)
    expect(currentRegions(wrapper)).toEqual([
      annotatedStoredRegion({
        id: 'region-1',
        zIndex: 0,
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: 'annotation-2',
            taxonomyPath: '58/annotation-class-1/annotation-2',
          },
        ],
      }),
    ])
    expect(sidebar.props('selectedAnnotation')).toBe(null)
    expect(wrapper.find('.b-modal-stub').exists()).toBe(false)
    expect(getStub(wrapper, ViewerStatusBarStub).props('saveStatus')).toBe('saving')
    await advanceSaveDelay(wrapper)
    expect(saveRegionsSpy).toHaveBeenLastCalledWith(currentRegions(wrapper))
  })

  it('shows the existing empty state after deleting the final annotation', async () => {
    loadRegionsSpy.mockReturnValue([
      annotatedStoredRegion({
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: 'annotation-1',
            taxonomyPath: '58/annotation-class-1/annotation-1',
          },
        ],
      }),
    ])

    const wrapper = mountViewerPage()
    await flushMountedFetch()
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    const sidebar = wrapper.findComponent(AnnotationSidebar)
    await sidebar.find('button.annotation-tree-leaf').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-danger').trigger('click')

    expect(wrapper.text()).toContain('No annotations yet')
    expect(wrapper.text()).toContain('Add an annotation to start describing this region.')
  })

  it('registers and removes the annotation deletion keyboard listener on mount and unmount', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    const addedKeydownCall = addEventListenerSpy.mock.calls.find((call) => call[0] === 'keydown')

    expect(addedKeydownCall).toBeTruthy()

    wrapper.unmount()

    const removedKeydownCall = removeEventListenerSpy.mock.calls.find((call) => call[0] === 'keydown')

    expect(removedKeydownCall).toBeTruthy()
    expect(removedKeydownCall[1]).toBe(addedKeydownCall[1])
  })

  it('clears selected annotation when the selected region changes or is cleared', async () => {
    loadRegionsSpy.mockReturnValue([
      annotatedStoredRegion({ id: 'region-1' }),
      annotatedStoredRegion({ id: 'region-2' }),
    ])

    const wrapper = mountViewerPage()
    await flushMountedFetch()
    await wrapper.find('[data-testid="select-region"]').trigger('click')

    let sidebar = wrapper.findComponent(AnnotationSidebar)
    await sidebar.findAll('button.annotation-tree-leaf')[0].trigger('click')

    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: 'annotation-1',
      annotationName: 'Active entity',
    })

    getStub(wrapper, AnnotationCanvasStub).vm.$emit('select-region', 'region-2')
    await wrapper.vm.$nextTick()

    sidebar = wrapper.findComponent(AnnotationSidebar)
    expect(sidebar.props('selectedAnnotation')).toBe(null)
    expect(sidebar.findAll('.annotation-tree-leaf-selected')).toHaveLength(0)

    await sidebar.findAll('button.annotation-tree-leaf')[0].trigger('click')
    expect(sidebar.props('selectedAnnotation')).toEqual({
      regionId: 'region-2',
      schemaPublicationId: '58',
      annotationId: 'annotation-1',
      annotationName: 'Active entity',
    })

    await wrapper.find('[data-testid="clear-region"]').trigger('click')

    sidebar = wrapper.findComponent(AnnotationSidebar)
    expect(sidebar.props('selectedAnnotation')).toBe(null)
  })

  it('stores canvas overlap context and passes it to the status bar', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-overlap-region"]').trigger('click')

    expect(getStub(wrapper, AnnotationCanvasStub).props('selectedRegionId')).toBe('region-1')
    expect(getStub(wrapper, ViewerStatusBarStub).props()).toEqual(
      expect.objectContaining({
        selectedRegion: expect.objectContaining({ id: 'region-1' }),
        overlappingRegionCount: 2,
      })
    )
  })

  it('resets overlap context after viewer state changes that invalidate it', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-overlap-region"]').trigger('click')
    await wrapper.find('[data-testid="next-page"]').trigger('click')
    expect(getStub(wrapper, ViewerStatusBarStub).props('overlappingRegionCount')).toBe(0)

    await wrapper.find('[data-testid="previous-page"]').trigger('click')
    await wrapper.find('[data-testid="select-overlap-region"]').trigger('click')
    await wrapper.find('[data-testid="tool-rectangle"]').trigger('click')
    expect(getStub(wrapper, ViewerStatusBarStub).props('overlappingRegionCount')).toBe(0)

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="select-overlap-region"]').trigger('click')
    await wrapper.find('[data-testid="add-region"]').trigger('click')
    expect(getStub(wrapper, ViewerStatusBarStub).props('overlappingRegionCount')).toBe(0)

    await wrapper.find('[data-testid="select-overlap-region"]').trigger('click')
    await wrapper.find('[data-testid="update-region"]').trigger('click')
    expect(getStub(wrapper, ViewerStatusBarStub).props('overlappingRegionCount')).toBe(0)

    await wrapper.find('[data-testid="select-overlap-region"]').trigger('click')
    await wrapper.find('[data-testid="delete-region"]').trigger('click')
    expect(getStub(wrapper, ViewerStatusBarStub).props('overlappingRegionCount')).toBe(0)
  })

  it('assigns increasing z-index values on the active page', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="add-polygon-region"]').trigger('click')
    await wrapper.find('[data-testid="add-polyline-region"]').trigger('click')

    expect(currentRegions(wrapper).map((region) => [region.id, region.zIndex])).toEqual([
      ['region-1', 0],
      ['region-2', 1],
      ['region-3', 2],
    ])
  })

  it('does not reuse deleted z-index gaps', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="add-polygon-region"]').trigger('click')
    await wrapper.find('[data-testid="add-polyline-region"]').trigger('click')
    getStub(wrapper, AnnotationCanvasStub).vm.$emit('select-region', 'region-2')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="delete-region"]').trigger('click')
    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(currentRegions(wrapper).map((region) => [region.id, region.zIndex])).toEqual([
      ['region-1', 0],
      ['region-3', 2],
      ['region-4', 3],
    ])
  })

  it('starts a separate z-index sequence on each page', async () => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find('[data-testid="add-region"]').trigger('click')
    await wrapper.find('[data-testid="next-page"]').trigger('click')
    await wrapper.find('[data-testid="add-region"]').trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({ id: 'region-1', pageIndex: 0, zIndex: 0 }),
      expect.objectContaining({ id: 'region-2', pageIndex: 1, zIndex: 0 }),
    ])
  })

  it('normalizes old stored regions without z-index values', async () => {
    loadRegionsSpy.mockReturnValue([
      storedRegion({ id: 'region-1' }),
      storedRegion({ id: 'region-2' }),
    ])

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({ id: 'region-1', zIndex: 0 }),
      expect.objectContaining({ id: 'region-2', zIndex: 1 }),
    ])
  })

  it('normalizes duplicate stored z-index values deterministically', async () => {
    loadRegionsSpy.mockReturnValue([
      storedRegion({ id: 'region-1', zIndex: 4 }),
      storedRegion({ id: 'region-2', zIndex: 4 }),
      storedRegion({ id: 'region-3', zIndex: 8 }),
    ])

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({ id: 'region-1', zIndex: 0 }),
      expect.objectContaining({ id: 'region-2', zIndex: 2 }),
      expect.objectContaining({ id: 'region-3', zIndex: 1 }),
    ])
  })

  it('keeps valid stored z-index values when no page requires migration', async () => {
    loadRegionsSpy.mockReturnValue([
      storedRegion({ id: 'region-1', zIndex: 4 }),
      storedRegion({ id: 'region-2', zIndex: 8 }),
    ])

    const wrapper = mountViewerPage()
    await flushMountedFetch()

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({ id: 'region-1', zIndex: 4 }),
      expect.objectContaining({ id: 'region-2', zIndex: 8 }),
    ])
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

  it.each([
    ['rectangle', 'tool-rectangle', 'add-region'],
    ['polygon', 'tool-polygon', 'add-polygon-region'],
    ['polyline', 'tool-polyline', 'add-polyline-region'],
  ])('keeps the %s tool active after creating a region', async (tool, toolButton, addButton) => {
    const wrapper = mountViewerPage()
    await flushMountedFetch()

    await wrapper.find(`[data-testid="${toolButton}"]`).trigger('click')
    await wrapper.find(`[data-testid="${addButton}"]`).trigger('click')

    expect(currentRegions(wrapper)).toEqual([
      expect.objectContaining({
        id: 'region-1',
        type: tool,
      }),
    ])
    expect(getStub(wrapper, ViewerToolbarStub).props()).toEqual(
      expect.objectContaining({
        activeTool: tool,
        hasSelectedRegion: false,
      })
    )
    expect(getStub(wrapper, AnnotationCanvasStub).props()).toEqual(
      expect.objectContaining({
        activeTool: tool,
        selectedRegionId: null,
        nextRegionId: 'region-2',
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
