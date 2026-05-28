import { ProjectDocumentModel } from '../models/ProjectDocumentModel'

// Vite only exposes client-side environment variables prefixed with VITE_.
// During local development, the mock backend runs on port 3001 by default.
// In production, an empty base URL means the API is served from the same origin.
const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV && import.meta.env.MODE !== 'test' ? 'http://localhost:3001' : '')
).replace(/\/$/, '')
const useApi = Boolean(apiBaseUrl) || import.meta.env.PROD

/**
 * Loads the active project document from the backend when an API URL is available.
 * The local model remains as a fallback for tests and static-only execution.
 */
export async function fetchProjectDocument(documentId = ProjectDocumentModel.id) {
  if (!useApi) return ProjectDocumentModel

  const response = await fetch(`${apiBaseUrl}/api/documents/${documentId}`)

  if (!response.ok) {
    throw new Error(`Unable to load document ${documentId}`)
  }

  const document = await response.json()

  // The backend returns document-relative URLs. In local development they need
  // the backend origin; in production they can remain same-origin paths.
  return {
    ...document,
    pages: document.pages.map((page) => (page.startsWith('/') ? `${apiBaseUrl}${page}` : page)),
  }
}

/**
 * Persists the current region list in the mock backend.
 * The local model is also updated so the viewer keeps working without an API.
 */
export async function saveProjectRegions(documentId, regions) {
  ProjectDocumentModel.regions = regions

  if (!useApi) return regions

  const response = await fetch(`${apiBaseUrl}/api/documents/${documentId}/regions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ regions }),
  })

  if (!response.ok) {
    throw new Error(`Unable to save regions for document ${documentId}`)
  }

  return response.json()
}
