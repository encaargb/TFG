import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, describe, it } from 'node:test'

const PORT = '3101'
const BASE_URL = `http://127.0.0.1:${PORT}`

let backend

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
    const regions = [
      {
        id: 'region-1',
        pageIndex: 0,
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 30,
        height: 40,
        color: '#0d6efd',
        annotations: [],
      },
    ]

    const saveResponse = await fetch(`${BASE_URL}/api/documents/doc1/regions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ regions }),
    })
    const saveBody = await saveResponse.json()

    const documentResponse = await fetch(`${BASE_URL}/api/documents/doc1`)
    const documentBody = await documentResponse.json()

    assert.equal(saveResponse.status, 200)
    assert.deepEqual(saveBody, { regions })
    assert.deepEqual(documentBody.regions, regions)
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
