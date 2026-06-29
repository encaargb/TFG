export function mapAnnotationNode({ node, schemaPublication, onAddAnnotation }) {
  if (node.type === 'ANNOTATION') {
    return {
      label: node.name,
      onClick: () => {
        onAddAnnotation({ schemaPublication, annotation: node })
      },
    }
  }

  return {
    label: node.name,
    children: node.children.map((child) =>
      mapAnnotationNode({ node: child, schemaPublication, onAddAnnotation })
    ),
  }
}

export function mapSchemaPublication({ schemaPublication, onAddAnnotation }) {
  return {
    label: schemaPublication.name,
    children: schemaPublication.annotations.children.map((node) =>
      mapAnnotationNode({ node, schemaPublication, onAddAnnotation })
    ),
  }
}

export function buildRegionContextMenuItems({
  menu,
  schemaPublications,
  onAddPoint,
  onDeletePoint,
  onDeleteRegion,
  onAddAnnotation,
}) {
  const items = []

  if (menu.canAddPoint) {
    items.push({
      label: 'Add point',
      onClick: onAddPoint,
    })
  }

  if (menu.pointIndex !== null) {
    items.push({
      label: 'Delete point',
      disabled: !menu.canDeletePoint,
      onClick: onDeletePoint,
    })
  }

  if (menu.region && schemaPublications.length) {
    items.push({
      label: 'Add annotation',
      children: schemaPublications.map((schemaPublication) =>
        mapSchemaPublication({ schemaPublication, onAddAnnotation })
      ),
    })
  }

  items.push({
    label: 'Delete region',
    onClick: onDeleteRegion,
  })

  return items
}
