function normalizeAssignmentId(value) {
  return String(value)
}

export function hasAnnotationAssignment(assignments, { schemaPublicationId, annotationId }) {
  if (!Array.isArray(assignments)) return false

  const normalizedSchemaPublicationId = normalizeAssignmentId(schemaPublicationId)
  const normalizedAnnotationId = normalizeAssignmentId(annotationId)

  return assignments.some(
    (assignment) =>
      normalizeAssignmentId(assignment?.schemaPublicationId) === normalizedSchemaPublicationId &&
      normalizeAssignmentId(assignment?.annotationId) === normalizedAnnotationId
  )
}
