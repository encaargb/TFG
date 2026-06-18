const SAMPLE_DOCUMENT_METADATA = {
  id: 'doc1',
  title: 'Sample document',
  pages: Array.from({ length: 15 }, (_, i) => `/documents/doc1/pages/pg${i + 1}.jpeg`),
}

class ProjectDocument {
  constructor({ id, title, pages }) {
    this.id = id
    this.title = title
    this.pages = pages
  }

  get regionsStorageKey() {
    return `annot8:documents:${this.id}:regions`
  }

  save(regions) {
    localStorage.setItem(this.regionsStorageKey, JSON.stringify(regions))
  }

  loadRegions() {
    const storedRegions = localStorage.getItem(this.regionsStorageKey)

    if (storedRegions === null) return []

    try {
      const parsedRegions = JSON.parse(storedRegions)

      return Array.isArray(parsedRegions) ? parsedRegions : []
    } catch (error) {
      console.error(`Unable to parse stored regions for document ${this.id}`, error)
      return []
    }
  }
}

export function createProjectDocumentModel(document) {
  return new ProjectDocument(document)
}

export const ProjectDocumentModel = createProjectDocumentModel(SAMPLE_DOCUMENT_METADATA)
