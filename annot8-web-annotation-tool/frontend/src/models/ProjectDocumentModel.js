class ProjectDocument {
  constructor({ id, title, pages, schemaPublications = [] }) {
    this.id = id
    this.title = title
    this.pages = pages
    this.schemaPublications = schemaPublications
  }

  get regionsStorageKey() {
    // Region data is isolated per document while remaining local to this browser origin.
    return `annot8:documents:${this.id}:regions`
  }

  /**
   * Persists the ViewerPage-owned region array without keeping a second mutable copy here.
   */
  save(regions) {
    localStorage.setItem(this.regionsStorageKey, JSON.stringify(regions))
  }

  loadRegions() {
    const storedRegions = localStorage.getItem(this.regionsStorageKey)

    // A document with no saved entry starts with an empty annotation set.
    if (storedRegions === null) return []

    try {
      const parsedRegions = JSON.parse(storedRegions)

      return Array.isArray(parsedRegions) ? parsedRegions : []
    } catch (error) {
      // Invalid storage should not prevent the document from opening.
      console.error(`Unable to parse stored regions for document ${this.id}`, error)
      return []
    }
  }
}

export function createProjectDocumentModel(document) {
  return new ProjectDocument(document)
}
