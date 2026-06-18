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
