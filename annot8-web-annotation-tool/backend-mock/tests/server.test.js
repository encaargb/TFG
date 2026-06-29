import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const PORT = '3101'
const BASE_URL = `http://127.0.0.1:${PORT}`
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDocumentSchemasResponse = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'ProjectDocumentSchemas.json'), 'utf8')
)

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
        NODE_ENV: 'test',
        PORT,
        FRONTEND_ORIGIN: 'http://localhost:5173',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
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
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'regions'), false)
  })

  it('returns the exact project document schema response', async () => {
    const response = await fetch(`${BASE_URL}/api/project-documents/doc1/schemas`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, projectDocumentSchemasResponse)
  })

  it('serves document image files', async () => {
    const response = await fetch(`${BASE_URL}/documents/doc1/pages/pg1.jpeg`)
    const image = await response.arrayBuffer()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/jpeg')
    assert.ok(image.byteLength > 0)
  })

  it('returns errors for invalid requests', async () => {
    const missingDocumentResponse = await fetch(`${BASE_URL}/api/documents/missing`)

    assert.equal(missingDocumentResponse.status, 404)
  })
})
