import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const contextMenuMock = vi.hoisted(() => ({
  showContextMenu: vi.fn(),
  closeContextMenu: vi.fn(),
}))

vi.mock('@imengyu/vue3-context-menu', () => ({
  default: contextMenuMock,
}))

import AnnotationSidebar from '../../../src/components/viewer/AnnotationSidebar.vue'

const sampleSchemaPublications = [
  {
    id: '58',
    name: 'VLT: Morphology: Framing Structure (v.2)',
    annotations: {
      id: '422',
      type: 'ANNOTATION-ROOT-CLASS',
      name: 'VLT: Morphology: Framing structure (v.2)',
      children: [
        {
          id: '424',
          type: 'ANNOTATION-CLASS',
          name: 'Activity',
          children: [
            {
              id: '434',
              type: 'ANNOTATION',
              name: 'Active entity',
              children: [],
            },
            {
              id: '435',
              type: 'ANNOTATION',
              name: 'Passive entity',
              children: [],
            },
          ],
        },
        {
          id: '427',
          type: 'ANNOTATION-CLASS',
          name: 'Morphological strategies',
          children: [
            {
              id: '450',
              type: 'ANNOTATION',
              name: 'Resizing',
              children: [],
            },
          ],
        },
        {
          id: '426',
          type: 'ANNOTATION-CLASS',
          name: 'Framing Types',
          children: [
            {
              id: '499',
              type: 'ANNOTATION',
              name: 'Unassigned annotation',
              children: [],
            },
          ],
        },
      ],
    },
  },
]

function mountSidebar(props = {}) {
  return mount(AnnotationSidebar, {
    props: {
      selectedRegion: null,
      schemaPublications: sampleSchemaPublications,
      selectedAnnotation: null,
      ...props,
    },
  })
}

function latestContextMenuItems() {
  return contextMenuMock.showContextMenu.mock.calls.at(-1)?.[0]?.items ?? []
}

describe('AnnotationSidebar', () => {
  it('selects an annotation and opens a Delete annotation context menu on leaf right-click', async () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '434',
            taxonomyPath: '58/422/424/434',
          },
        ],
      },
    })

    await wrapper.find('button.annotation-tree-leaf').trigger('contextmenu', {
      clientX: 120,
      clientY: 48,
    })

    expect(wrapper.emitted('select-annotation')[0][0]).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: '434',
      annotationName: 'Active entity',
    })
    expect(contextMenuMock.showContextMenu).toHaveBeenCalledTimes(1)
    expect(latestContextMenuItems().map((item) => item.label)).toEqual(['Delete annotation'])

    latestContextMenuItems()[0].onClick()

    expect(wrapper.emitted('request-delete-annotation')[0][0]).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: '434',
      annotationName: 'Active entity',
    })
  })

  it('keeps the no-region state unchanged', () => {
    const wrapper = mountSidebar({ selectedRegion: null })

    expect(wrapper.text()).toContain('No region selected')
    expect(wrapper.text()).toContain(
      'Select a region on the document to view and manage its annotations.'
    )
  })

  it('keeps the no-annotations state unchanged when a region has no assignments', () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [],
      },
    })

    expect(wrapper.text()).toContain('No annotations yet')
    expect(wrapper.text()).toContain('Right-click the selected region and choose an annotation to start describing it.')
  })

  it('shows a single schema branch and renders assigned annotations under class branches', () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '434',
            taxonomyPath: '58/422/424/434',
          },
          {
            schemaPublicationId: '58',
            annotationId: '435',
            taxonomyPath: '58/422/424/435',
          },
          {
            schemaPublicationId: '58',
            annotationId: '450',
            taxonomyPath: '58/422/427/450',
          },
        ],
      },
    })

    const summaries = wrapper.findAll('summary').map((node) => node.text())

    expect(summaries.filter((text) => text === 'VLT: Morphology: Framing Structure (v.2)')).toHaveLength(1)
    expect(summaries).toContain('Activity')
    expect(summaries).toContain('Morphological strategies')
    expect(summaries).not.toContain('Framing Types')

    const leafRows = wrapper.findAll('.annotation-tree-leaf').map((node) => node.text())
    expect(leafRows).toContain('Active entity')
    expect(leafRows).toContain('Passive entity')
    expect(leafRows).toContain('Resizing')
    expect(leafRows).not.toContain('Unassigned annotation')
  })

  it('renders tree branches with native details and summary, with simple text leaves', () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '434',
            taxonomyPath: '58/422/424/434',
          },
        ],
      },
    })

    const detailsNodes = wrapper.findAll('details')
    const summaryNodes = wrapper.findAll('summary')

    expect(detailsNodes.length).toBeGreaterThan(0)
    expect(summaryNodes.length).toBeGreaterThan(0)
    expect(detailsNodes.every((node) => node.attributes('open') !== undefined)).toBe(true)
    expect(wrapper.findAll('.annotation-tree-leaf').map((node) => node.text())).toContain('Active entity')
    expect(summaryNodes.map((node) => node.text())).not.toContain('Active entity')
  })

  it('emits selected annotation data when clicking a leaf and highlights only the selected leaf', async () => {
    const region = {
      id: 'region-1',
      annotations: [
        {
          schemaPublicationId: '58',
          annotationId: '434',
          taxonomyPath: '58/422/424/434',
        },
        {
          schemaPublicationId: '58',
          annotationId: '435',
          taxonomyPath: '58/422/424/435',
        },
      ],
    }
    const wrapper = mountSidebar({ selectedRegion: region })

    const leafButtons = wrapper.findAll('button.annotation-tree-leaf')

    await leafButtons[0].trigger('click')

    expect(wrapper.emitted('select-annotation')[0][0]).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: '434',
      annotationName: 'Active entity',
    })

    await wrapper.setProps({
      selectedAnnotation: {
        regionId: 'region-1',
        schemaPublicationId: '58',
        annotationId: '434',
        annotationName: 'Active entity',
      },
    })

    expect(wrapper.findAll('.annotation-tree-leaf-selected')).toHaveLength(1)
    expect(leafButtons[0].classes()).toContain('annotation-tree-leaf-selected')

    await leafButtons[1].trigger('click')

    expect(wrapper.emitted('select-annotation')[1][0]).toEqual({
      regionId: 'region-1',
      schemaPublicationId: '58',
      annotationId: '435',
      annotationName: 'Passive entity',
    })

    await wrapper.setProps({
      selectedAnnotation: {
        regionId: 'region-1',
        schemaPublicationId: '58',
        annotationId: '435',
        annotationName: 'Passive entity',
      },
    })

    expect(wrapper.findAll('.annotation-tree-leaf-selected')).toHaveLength(1)
    expect(wrapper.findAll('button.annotation-tree-leaf')[0].classes()).not.toContain(
      'annotation-tree-leaf-selected'
    )
    expect(wrapper.findAll('button.annotation-tree-leaf')[1].classes()).toContain(
      'annotation-tree-leaf-selected'
    )
    expect(region.annotations).toEqual([
      {
        schemaPublicationId: '58',
        annotationId: '434',
        taxonomyPath: '58/422/424/434',
      },
      {
        schemaPublicationId: '58',
        annotationId: '435',
        taxonomyPath: '58/422/424/435',
      },
    ])
  })

  it('does not emit annotation selection when clicking branch summaries', async () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '434',
            taxonomyPath: '58/422/424/434',
          },
        ],
      },
    })

    await wrapper.find('summary').trigger('click')

    expect(wrapper.emitted('select-annotation')).toBeUndefined()
  })

  it('removes old card classes and card structure', () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '434',
            taxonomyPath: '58/422/424/434',
          },
        ],
      },
    })

    expect(wrapper.findAll('.border.rounded.p-2')).toHaveLength(0)
  })

  it('uses fallback labels for unresolved references without crashing', () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: 'missing-schema',
            annotationId: 'missing-annotation',
            taxonomyPath: 'missing/path',
          },
        ],
      },
    })

    expect(wrapper.findAll('summary').map((node) => node.text())).toContain('Unavailable schema')
    expect(wrapper.text()).toContain('Unknown annotation')
    expect(wrapper.text()).toContain('Unavailable schema')
  })

  it('updates the displayed annotation list when the selected region changes', async () => {
    const wrapper = mountSidebar({
      selectedRegion: {
        id: 'region-1',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '434',
            taxonomyPath: '58/422/424/434',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('Active entity')
    expect(wrapper.text()).not.toContain('Resizing')

    await wrapper.setProps({
      selectedRegion: {
        id: 'region-2',
        annotations: [
          {
            schemaPublicationId: '58',
            annotationId: '450',
            taxonomyPath: '58/422/427/450',
          },
        ],
      },
    })

    expect(wrapper.text()).not.toContain('Active entity')
    expect(wrapper.text()).toContain('Resizing')
  })
})
