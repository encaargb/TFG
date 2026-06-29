import { afterEach, describe, expect, it, vi } from 'vitest'
import projectDocumentSchemas from '../../../backend-mock/data/ProjectDocumentSchemas.json'

async function loadDocumentApi(apiBaseUrl) {
  vi.resetModules()
  vi.unstubAllEnvs()

  if (apiBaseUrl) vi.stubEnv('VITE_API_BASE_URL', apiBaseUrl)

  return import('../../src/services/documentApi.js')
}

function mockFetch(payload, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(payload),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mockFetchSequence(responses) {
  const fetchMock = vi.fn()

  responses.forEach(({ payload, ok = true }) => {
    fetchMock.mockResolvedValueOnce({
      ok,
      json: vi.fn().mockResolvedValue(payload),
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('documentApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('falls back to local document metadata when no API URL is configured in tests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchProjectDocument } = await loadDocumentApi()
    const document = await fetchProjectDocument()

    expect(document).toEqual({
      id: 'doc1',
      title: 'Sample document',
      pages: Array.from(
        { length: 15 },
        (_, index) => `/documents/doc1/pages/pg${index + 1}.jpeg`
      ),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads document metadata and expands relative page URLs from the API base URL', async () => {
    const fetchMock = mockFetchSequence([
      {
        payload: {
          id: 'doc1',
          pages: ['/documents/doc1/pages/pg1.jpeg', 'https://cdn.example.test/page.jpeg'],
          regions: [],
        },
      },
      { payload: projectDocumentSchemas },
    ])

    const { fetchProjectDocument } = await loadDocumentApi('http://localhost:3001/')
    const document = await fetchProjectDocument('doc1')

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/documents/doc1')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/project-documents/doc1/schemas'
    )
    expect(document.pages).toEqual([
      'http://localhost:3001/documents/doc1/pages/pg1.jpeg',
      'https://cdn.example.test/page.jpeg',
    ])
    expect(document.schemaPublications[0]).toEqual(
      expect.objectContaining({
        id: '58',
        name: 'VLT: Morphology: Framing Structure (v.2)',
      })
    )
  })

  it('maps project document schemas to SchemaPublication instances', async () => {
    const fetchMock = mockFetch(projectDocumentSchemas)

    const { fetchProjectDocumentSchemas } = await loadDocumentApi('http://localhost:3001/')
    const { SchemaPublication } = await import('../../src/models/SchemaPublication')
    const schemaPublications = await fetchProjectDocumentSchemas('doc1')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/project-documents/doc1/schemas'
    )
    expect(schemaPublications).toHaveLength(1)
    expect(schemaPublications[0]).toBeInstanceOf(SchemaPublication)
    expect(schemaPublications[0].id).toBe('58')
    expect(schemaPublications[0].name).toBe('VLT: Morphology: Framing Structure (v.2)')
    expect(schemaPublications[0].annotations).toEqual(projectDocumentSchemas.data.schemas[0].annotations)
  })

  it('throws when the API cannot load a document', async () => {
    mockFetch({}, false)

    const { fetchProjectDocument } = await loadDocumentApi('http://localhost:3001')

    await expect(fetchProjectDocument('missing')).rejects.toThrow('Unable to load document missing')
  })
})
