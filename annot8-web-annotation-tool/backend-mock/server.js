import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 3001)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? '*'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, 'public')
const FRONTEND_DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist')

// In-memory document store used by the mock backend. Restarting the server
// resets the regions, which is acceptable for the current demo scope.
const documents = new Map([
  [
    'doc1',
    {
      id: 'doc1',
      title: 'Sample document',
      pages: Array.from({ length: 15 }, (_, i) => `/documents/doc1/pages/pg${i + 1}.jpeg`),
      regions: [],
    },
  ],
])

/**
 * Sends a JSON response with the CORS headers required by the Vite frontend.
 */
function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

/**
 * Maps file extensions to the MIME types used by the browser.
 */
function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  return {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
  }[extension] ?? 'application/octet-stream'
}

/**
 * Streams document assets from backend-mock/public.
 * The resolved path check prevents requests from escaping the public directory.
 */
function sendStaticFile(response, pathname, rootDir = PUBLIC_DIR) {
  const relativePath = decodeURIComponent(pathname.replace(/^\//, ''))
  const filePath = path.resolve(rootDir, relativePath)

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: 'Forbidden' })
    return
  }

  fs.access(filePath, fs.constants.F_OK, (error) => {
    if (error) {
      sendJson(response, 404, { error: 'File not found' })
      return
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
      'Content-Type': getContentType(filePath),
    })
    fs.createReadStream(filePath).pipe(response)
  })
}

/**
 * Serves the production Vue build when the backend is used as a single
 * deployable service, for example inside the Docker image.
 */
function sendFrontendFile(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = path.join(FRONTEND_DIST_DIR, requestedPath)

  fs.access(filePath, fs.constants.F_OK, (error) => {
    sendStaticFile(response, error ? '/index.html' : requestedPath, FRONTEND_DIST_DIR)
  })
}

/**
 * Reads and parses a JSON request body.
 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })
}

/**
 * Extracts the document id from supported document API routes.
 */
function getDocumentId(pathname) {
  const match = pathname.match(/^\/api\/documents\/([^/]+)(?:\/regions)?$/)
  return match?.[1]
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' })
    return
  }

  if (request.method === 'GET' && url.pathname.startsWith('/documents/')) {
    sendStaticFile(response, url.pathname)
    return
  }

  if (url.pathname.startsWith('/api/documents/')) {
    const documentId = getDocumentId(url.pathname)
    const document = documentId ? documents.get(documentId) : null

    if (!documentId || !document) {
      sendJson(response, 404, { error: 'Document not found' })
      return
    }

    if (request.method === 'GET' && url.pathname === `/api/documents/${documentId}`) {
      sendJson(response, 200, document)
      return
    }

    if (request.method === 'PUT' && url.pathname === `/api/documents/${documentId}/regions`) {
      try {
        const body = await readJsonBody(request)
        // The mock backend replaces the full region list instead of applying
        // partial updates. This keeps the API simple for the annotation demo.
        document.regions = Array.isArray(body.regions) ? body.regions : []
        sendJson(response, 200, { regions: document.regions })
      } catch (error) {
        sendJson(response, 400, { error: 'Invalid JSON body' })
      }
      return
    }

    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  if (request.method === 'GET') {
    sendFrontendFile(response, url.pathname)
    return
  }

  sendJson(response, 405, { error: 'Method not allowed' })
})

server.listen(PORT, () => {
  console.log(`Mock backend listening on http://localhost:${PORT}`)
})
