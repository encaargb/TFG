import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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
      ...props,
    },
  })
}

describe('AnnotationSidebar', () => {
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
    expect(wrapper.text()).toContain('Add an annotation to start describing this region.')
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
