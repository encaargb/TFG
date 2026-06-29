import { SchemaPublication } from '../models/SchemaPublication'

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV && import.meta.env.MODE !== 'test' ? 'http://localhost:3001' : '')
).replace(/\/$/, '')
// Tests use local metadata so the viewer can mount without a running mock server.
const useApi = Boolean(apiBaseUrl) || import.meta.env.PROD
const fallbackDocument = {
  id: 'doc1',
  title: 'Sample document',
  pages: Array.from({ length: 15 }, (_, index) => `/documents/doc1/pages/pg${index + 1}.jpeg`),
}

function mapSchemaPublications(response) {
  return response.data.schemas.map((schema) => new SchemaPublication(schema))
}

export async function fetchProjectDocumentSchemas(documentId = fallbackDocument.id) {
  if (!useApi) return []

  const response = await fetch(`${apiBaseUrl}/api/project-documents/${documentId}/schemas`)

  if (!response.ok) {
    throw new Error(`Unable to load schemas for document ${documentId}`)
  }

  return mapSchemaPublications(await response.json())
}

export async function fetchProjectDocument(documentId = fallbackDocument.id) {
  if (!useApi) return fallbackDocument

  const response = await fetch(`${apiBaseUrl}/api/documents/${documentId}`)

  if (!response.ok) {
    throw new Error(`Unable to load document ${documentId}`)
  }

  const document = await response.json()
  const schemaPublications = await fetchProjectDocumentSchemas(document.id)

  // The backend returns document-relative page paths; the canvas always receives usable URLs.
  return {
    ...document,
    pages: document.pages.map((page) => (page.startsWith('/') ? `${apiBaseUrl}${page}` : page)),
    schemaPublications,
  }
}
