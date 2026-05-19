import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('documentApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('falls back to the local document model when no API URL is configured in tests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchProjectDocument } = await loadDocumentApi()
    const { ProjectDocumentModel } = await import('../../src/models/ProjectDocumentModel.js')
    const document = await fetchProjectDocument()

    expect(document).toBe(ProjectDocumentModel)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads document metadata and expands relative page URLs from the API base URL', async () => {
    const fetchMock = mockFetch({
      id: 'doc1',
      pages: ['/documents/doc1/pages/pg1.jpeg', 'https://cdn.example.test/page.jpeg'],
      regions: [],
    })

    const { fetchProjectDocument } = await loadDocumentApi('http://localhost:3001/')
    const document = await fetchProjectDocument('doc1')

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/documents/doc1')
    expect(document.pages).toEqual([
      'http://localhost:3001/documents/doc1/pages/pg1.jpeg',
      'https://cdn.example.test/page.jpeg',
    ])
  })

  it('saves regions through the API and keeps the local model in sync', async () => {
    const regions = [
      {
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
        x: 1,
        y: 2,
        width: 3,
        height: 4,
        color: '#0d6efd',
        annotations: [],
      },
    ]
    const fetchMock = mockFetch({ regions })

    const { saveProjectRegions } = await loadDocumentApi('http://localhost:3001')
    const { ProjectDocumentModel } = await import('../../src/models/ProjectDocumentModel.js')
    const response = await saveProjectRegions('doc1', regions)

    expect(ProjectDocumentModel.regions).toBe(regions)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/documents/doc1/regions', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ regions }),
    })
    expect(response).toEqual({ regions })
  })

  it('throws when the API cannot load a document', async () => {
    mockFetch({}, false)

    const { fetchProjectDocument } = await loadDocumentApi('http://localhost:3001')

    await expect(fetchProjectDocument('missing')).rejects.toThrow('Unable to load document missing')
  })
})
