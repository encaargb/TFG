import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SchemaPublication } from '../../src/models/SchemaPublication'
import { createProjectDocumentModel } from '../../src/models/ProjectDocumentModel'

function createDocument(overrides = {}) {
  return createProjectDocumentModel({
    id: 'doc1',
    title: 'Sample document',
    pages: ['/documents/doc1/pages/pg1.jpeg'],
    ...overrides,
  })
}

function rectangleRegion(overrides = {}) {
  return {
    id: 'region-rectangle',
    pageIndex: 0,
    type: 'rectangle',
    left: 10,
    top: 20,
    right: 110,
    bottom: 120,
    color: '#0d6efd',
    annotations: [{ label: 'Name', value: 'Ada' }],
    ...overrides,
  }
}

function polygonRegion(overrides = {}) {
  return {
    id: 'region-polygon',
    pageIndex: 1,
    type: 'polygon',
    points: [
      { x: 10, y: 15 },
      { x: 45, y: 20 },
      { x: 30, y: 60 },
    ],
    color: '#198754',
    annotations: [{ label: 'Shape', value: 'Triangle' }],
    ...overrides,
  }
}

function polylineRegion(overrides = {}) {
  return {
    id: 'region-polyline',
    pageIndex: 2,
    type: 'polyline',
    points: [
      { x: 5, y: 8 },
      { x: 20, y: 25 },
      { x: 38, y: 40 },
    ],
    color: '#dc3545',
    annotations: [{ label: 'Path', value: 'Trace' }],
    ...overrides,
  }
}

describe('ProjectDocumentModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('keeps the supplied document metadata', () => {
    const pages = ['/documents/custom/pages/pg1.jpeg', '/documents/custom/pages/pg2.jpeg']
    const document = createDocument({
      id: 'custom-doc',
      title: 'Custom document',
      pages,
    })

    expect(document.id).toBe('custom-doc')
    expect(document.title).toBe('Custom document')
    expect(document.pages).toBe(pages)
  })

  it('exposes supplied schema publications', () => {
    const schemaPublications = [
      new SchemaPublication({
        id: '58',
        name: 'VLT: Morphology: Framing Structure (v.2)',
        annotations: { id: '422', children: [] },
      }),
    ]
    const document = createDocument({ schemaPublications })

    expect(document.schemaPublications).toBe(schemaPublications)
    expect(document.schemaPublications[0]).toEqual(
      expect.objectContaining({
        id: '58',
        name: 'VLT: Morphology: Framing Structure (v.2)',
      })
    )
  })

  it('save() uses annot8:documents:doc1:regions for doc1', () => {
    const document = createDocument({ id: 'doc1' })
    const regions = [rectangleRegion()]

    document.save(regions)

    expect(localStorage.getItem('annot8:documents:doc1:regions')).toBe(JSON.stringify(regions))
  })

  it('uses a different key for a different document ID', () => {
    const document = createDocument({ id: 'doc2' })
    const regions = [rectangleRegion()]

    document.save(regions)

    expect(localStorage.getItem('annot8:documents:doc2:regions')).toBe(JSON.stringify(regions))
    expect(localStorage.getItem('annot8:documents:doc1:regions')).toBeNull()
  })

  it('save() serializes the complete regions array', () => {
    const document = createDocument()
    const regions = [rectangleRegion(), polygonRegion(), polylineRegion()]

    document.save(regions)

    expect(localStorage.getItem('annot8:documents:doc1:regions')).toBe(JSON.stringify(regions))
  })

  it('save() only persists regions', () => {
    const document = createDocument()
    const regions = [rectangleRegion()]

    document.save(regions)

    expect(JSON.parse(localStorage.getItem('annot8:documents:doc1:regions'))).toEqual(regions)
    expect(localStorage.getItem('annot8:documents:doc1:schema-publications')).toBeNull()
  })

  it('loadRegions() restores saved rectangles', () => {
    const document = createDocument()
    const regions = [rectangleRegion()]

    document.save(regions)

    expect(document.loadRegions()).toEqual(regions)
  })

  it('loadRegions() restores saved polygons', () => {
    const document = createDocument()
    const regions = [polygonRegion()]

    document.save(regions)

    expect(document.loadRegions()).toEqual(regions)
  })

  it('loadRegions() restores saved polylines', () => {
    const document = createDocument()
    const regions = [polylineRegion()]

    document.save(regions)

    expect(document.loadRegions()).toEqual(regions)
  })

  it('loadRegions() returns [] when no value exists', () => {
    const document = createDocument()

    expect(document.loadRegions()).toEqual([])
  })

  it('loadRegions() returns [] when JSON is malformed', () => {
    const document = createDocument()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('annot8:documents:doc1:regions', '{malformed')

    expect(document.loadRegions()).toEqual([])
  })

  it('logs malformed JSON with console.error', () => {
    const document = createDocument()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('annot8:documents:doc1:regions', '{malformed')

    document.loadRegions()

    expect(consoleError).toHaveBeenCalledWith(
      'Unable to parse stored regions for document doc1',
      expect.any(SyntaxError)
    )
  })

  it('loadRegions() returns [] when the parsed value is not an array', () => {
    const document = createDocument()
    localStorage.setItem('annot8:documents:doc1:regions', JSON.stringify({ regions: [] }))

    expect(document.loadRegions()).toEqual([])
  })

  it('propagates localStorage.setItem() errors from save()', () => {
    const document = createDocument()
    const error = new Error('Storage quota exceeded')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw error
    })

    expect(() => document.save([rectangleRegion()])).toThrow(error)
  })

  it('does not expose a regions property', () => {
    const document = createDocument()

    expect('regions' in document).toBe(false)
    expect('regions' in document).toBe(false)
  })
})
