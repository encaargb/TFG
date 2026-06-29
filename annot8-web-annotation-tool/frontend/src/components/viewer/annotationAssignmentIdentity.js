function normalizeAssignmentId(value) {
  return String(value)
}

export function isSameAnnotationAssignment(
  assignment,
  { schemaPublicationId, annotationId }
) {
  return (
    normalizeAssignmentId(assignment?.schemaPublicationId) ===
      normalizeAssignmentId(schemaPublicationId) &&
    normalizeAssignmentId(assignment?.annotationId) === normalizeAssignmentId(annotationId)
  )
}

export function hasAnnotationAssignment(assignments, { schemaPublicationId, annotationId }) {
  if (!Array.isArray(assignments)) return false

  return assignments.some(
    (assignment) => isSameAnnotationAssignment(assignment, { schemaPublicationId, annotationId })
  )
}
