import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, describe, it } from 'node:test'

const PORT = '3101'
const BASE_URL = `http://127.0.0.1:${PORT}`

let backend

function rectangleRegion(overrides = {}) {
  return {
    id: 'region-1',
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

function polygonRegion(overrides = {}) {
  return {
    id: 'region-2',
    pageIndex: 0,
    type: 'polygon',
    points: [
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 25, y: 60 },
    ],
    color: '#0d6efd',
    annotations: [],
    ...overrides,
  }
}

function polylineRegion(overrides = {}) {
  return {
    id: 'region-3',
    pageIndex: 0,
    type: 'polyline',
    points: [
      { x: 10, y: 20 },
      { x: 40, y: 60 },
    ],
    color: '#0d6efd',
    annotations: [],
    ...overrides,
  }
}

async function saveRegions(regions) {
  return fetch(`${BASE_URL}/api/documents/doc1/regions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ regions }),
  })
}

async function getDocumentRegions() {
  const response = await fetch(`${BASE_URL}/api/documents/doc1`)
  const body = await response.json()
  return body.regions
}

async function assertInvalidRegionsPreserveStoredRegions(regions, expectedStoredRegions) {
  const response = await saveRegions(regions)
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(typeof body.error, 'string')
  assert.deepEqual(await getDocumentRegions(), expectedStoredRegions)
}

function waitForBackend() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    async function check() {
      try {
        const response = await fetch(`${BASE_URL}/health`)
        if (response.ok) {
          resolve()
          return
        }
      } catch (error) {
        // The process may still be starting.
      }

      if (Date.now() - startedAt > 5000) {
        reject(new Error('Backend did not start in time'))
        return
      }

      setTimeout(check, 100)
    }

    check()
  })
}

describe('mock backend', () => {
  before(async () => {
    backend = spawn('node', ['server.js'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        PORT,
        FRONTEND_ORIGIN: 'http://localhost:5173',
      },
      stdio: 'ignore',
    })

    await waitForBackend()
  })

  after(() => {
    backend?.kill()
  })

  it('returns health status and CORS headers', async () => {
    const response = await fetch(`${BASE_URL}/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    assert.deepEqual(body, { status: 'ok' })
  })

  it('returns document metadata with page URLs', async () => {
    const response = await fetch(`${BASE_URL}/api/documents/doc1`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.id, 'doc1')
    assert.equal(body.pages.length, 15)
    assert.equal(body.pages[0], '/documents/doc1/pages/pg1.jpeg')
    assert.deepEqual(body.regions, [])
  })

  it('serves document image files', async () => {
    const response = await fetch(`${BASE_URL}/documents/doc1/pages/pg1.jpeg`)
    const image = await response.arrayBuffer()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/jpeg')
    assert.ok(image.byteLength > 0)
  })

  it('saves regions in memory', async () => {
    const regions = [rectangleRegion()]

    const saveResponse = await saveRegions(regions)
    const saveBody = await saveResponse.json()

    const documentResponse = await fetch(`${BASE_URL}/api/documents/doc1`)
    const documentBody = await documentResponse.json()

    assert.equal(saveResponse.status, 200)
    assert.deepEqual(saveBody, { regions })
    assert.deepEqual(documentBody.regions, regions)
  })

  it('accepts an explicit empty regions array', async () => {
    const response = await saveRegions([])
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, { regions: [] })
    assert.deepEqual(await getDocumentRegions(), [])
  })

  it('accepts valid common properties for rectangle, polygon, and polyline regions', async () => {
    const regions = [
      rectangleRegion(),
      polygonRegion(),
      polylineRegion(),
    ]

    const response = await saveRegions(regions)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, { regions })
    assert.deepEqual(await getDocumentRegions(), regions)
  })

  it('rejects non-object, null, and array region entries', async () => {
    const existingRegions = [rectangleRegion()]
    const initialSaveResponse = await saveRegions(existingRegions)
    assert.equal(initialSaveResponse.status, 200)

    await assertInvalidRegionsPreserveStoredRegions(['region'], existingRegions)
    await assertInvalidRegionsPreserveStoredRegions([null], existingRegions)
    await assertInvalidRegionsPreserveStoredRegions([[]], existingRegions)
  })

  it('rejects invalid common region fields without changing stored regions', async () => {
    const existingRegions = [rectangleRegion()]
    const initialSaveResponse = await saveRegions(existingRegions)
    assert.equal(initialSaveResponse.status, 200)

    const missingId = rectangleRegion()
    delete missingId.id

    const missingColor = rectangleRegion()
    delete missingColor.color

    const invalidRegions = [
      missingId,
      rectangleRegion({ id: '' }),
      rectangleRegion({ id: '   ' }),
      rectangleRegion({ id: 4 }),
      rectangleRegion({ pageIndex: '1' }),
      rectangleRegion({ pageIndex: -1 }),
      rectangleRegion({ pageIndex: 1.5 }),
      rectangleRegion({ type: 'circle' }),
      rectangleRegion({ type: undefined }),
      missingColor,
      rectangleRegion({ color: '' }),
      rectangleRegion({ color: '   ' }),
      rectangleRegion({ annotations: null }),
    ]

    for (const region of invalidRegions) {
      await assertInvalidRegionsPreserveStoredRegions([region], existingRegions)
    }
  })

  it('does not partially apply a multi-region payload when one region has invalid common fields', async () => {
    const existingRegions = [rectangleRegion({ id: 'existing-region' })]
    const initialSaveResponse = await saveRegions(existingRegions)
    assert.equal(initialSaveResponse.status, 200)

    await assertInvalidRegionsPreserveStoredRegions(
      [
        rectangleRegion({ id: 'new-valid-region' }),
        polygonRegion({ id: '' }),
      ],
      existingRegions
    )
  })

  it('rejects missing or invalid regions arrays without changing stored regions', async () => {
    const existingRegions = [rectangleRegion()]
    const invalidPayloads = [
      {},
      { regions: 'invalid' },
      { regions: null },
    ]

    const initialSaveResponse = await saveRegions(existingRegions)
    assert.equal(initialSaveResponse.status, 200)

    for (const payload of invalidPayloads) {
      const response = await fetch(`${BASE_URL}/api/documents/doc1/regions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const body = await response.json()

      assert.equal(response.status, 400)
      assert.deepEqual(body, { error: 'Regions must be an array' })
      assert.deepEqual(await getDocumentRegions(), existingRegions)
    }
  })

  it('returns errors for invalid requests', async () => {
    const invalidJsonResponse = await fetch(`${BASE_URL}/api/documents/doc1/regions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{',
    })
    const missingDocumentResponse = await fetch(`${BASE_URL}/api/documents/missing`)

    assert.equal(invalidJsonResponse.status, 400)
    assert.equal(missingDocumentResponse.status, 404)
  })
})
