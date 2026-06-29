import { describe, expect, it } from 'vitest'
import projectDocumentSchemas from '../../../backend-mock/data/ProjectDocumentSchemas.json'
import { SchemaPublication } from '../../src/models/SchemaPublication'

describe('SchemaPublication', () => {
  it('keeps id, name, and the complete annotations taxonomy', () => {
    const schema = projectDocumentSchemas.data.schemas[0]
    const publication = new SchemaPublication(schema)

    expect(publication.id).toBe(schema.id)
    expect(publication.name).toBe(schema.name)
    expect(publication.annotations).toBe(schema.annotations)
  })

  it('creates the sample schema publication from the backend mock response schema', () => {
    const publication = new SchemaPublication(projectDocumentSchemas.data.schemas[0])

    expect(publication).toBeInstanceOf(SchemaPublication)
    expect(publication).toEqual(
      expect.objectContaining({
        id: '58',
        name: 'VLT: Morphology: Framing Structure (v.2)',
        annotations: projectDocumentSchemas.data.schemas[0].annotations,
      })
    )
  })
})
