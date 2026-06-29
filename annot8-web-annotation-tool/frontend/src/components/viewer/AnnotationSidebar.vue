<script setup>
import { computed } from 'vue'
import AnnotationTreeNode from './AnnotationTreeNode.vue'

const props = defineProps({
  selectedRegion: {
    type: Object,
    default: null,
  },
  schemaPublications: {
    type: Array,
    default: () => [],
  },
  selectedAnnotation: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['select-annotation'])

function getSelectedAnnotationIdentity(regionId, schemaPublicationId, annotationId) {
  return `${String(regionId)}:${String(schemaPublicationId)}:${String(annotationId)}`
}

function findAnnotation(node, targetId, classPathNodes = []) {
  if (!node) return null

  const nextClassPathNodes =
    node.type === 'ANNOTATION-CLASS' && node.name
      ? [...classPathNodes, { id: String(node.id), name: node.name }]
      : classPathNodes

  if (node.type === 'ANNOTATION' && String(node.id) === String(targetId)) {
    return {
      annotationId: String(node.id),
      annotationName: node.name || 'Unknown annotation',
      classPathNodes: nextClassPathNodes,
    }
  }

  const children = Array.isArray(node.children) ? node.children : []

  for (const child of children) {
    const resolved = findAnnotation(child, targetId, nextClassPathNodes)
    if (resolved) return resolved
  }

  return null
}

const resolvedAnnotations = computed(() => {
  const assignedAnnotations = Array.isArray(props.selectedRegion?.annotations)
    ? props.selectedRegion.annotations
    : []

  return assignedAnnotations.map((assigned, index) => {
    const schemaPublication = props.schemaPublications.find(
      (schema) => String(schema.id) === String(assigned?.schemaPublicationId)
    )

    if (!schemaPublication) {
      return {
        key: `${assigned?.schemaPublicationId ?? 'unknown-schema'}:${assigned?.annotationId ?? index}`,
        schemaId: String(assigned?.schemaPublicationId ?? 'unknown-schema'),
        annotationId: String(assigned?.annotationId ?? `unknown-annotation-${index}`),
        annotationName: 'Unknown annotation',
        classPathNodes: [],
        schemaName: 'Unavailable schema',
      }
    }

    const resolved = findAnnotation(schemaPublication.annotations, assigned?.annotationId)

    return {
      key: `${assigned?.schemaPublicationId ?? schemaPublication.id}:${assigned?.annotationId ?? index}`,
      schemaId: String(schemaPublication.id),
      annotationId: resolved?.annotationId ?? String(assigned?.annotationId ?? `unknown-annotation-${index}`),
      annotationName: resolved?.annotationName ?? 'Unknown annotation',
      classPathNodes: resolved?.classPathNodes ?? [],
      schemaName: schemaPublication.name || 'Unavailable schema',
    }
  })
})

const annotationTree = computed(() => {
  const schemaNodes = new Map()
  const regionId = props.selectedRegion?.id

  for (const item of resolvedAnnotations.value) {
    const schemaNodeId = `schema:${item.schemaId}`
    const schemaNode = schemaNodes.get(schemaNodeId) ?? {
      id: schemaNodeId,
      name: item.schemaName,
      children: [],
    }

    if (!schemaNodes.has(schemaNodeId)) {
      schemaNodes.set(schemaNodeId, schemaNode)
    }

    let parentNode = schemaNode

    for (const classNode of item.classPathNodes) {
      const classNodeId = `${schemaNodeId}:class:${classNode.id}`
      let childNode = parentNode.children.find((child) => child.id === classNodeId)

      if (!childNode) {
        childNode = {
          id: classNodeId,
          name: classNode.name,
          children: [],
        }
        parentNode.children.push(childNode)
      }

      parentNode = childNode
    }

    const annotationNodeId = `${schemaNodeId}:annotation:${item.annotationId}`
    const annotationNodeExists = parentNode.children.some((child) => child.id === annotationNodeId)

    if (!annotationNodeExists) {
      parentNode.children.push({
        id: annotationNodeId,
        name: item.annotationName,
        children: [],
        selectionIdentity: getSelectedAnnotationIdentity(regionId, item.schemaId, item.annotationId),
        selection: {
          regionId,
          schemaPublicationId: item.schemaId,
          annotationId: item.annotationId,
          annotationName: item.annotationName,
        },
      })
    }
  }

  return Array.from(schemaNodes.values())
})

const selectedAnnotationIdentity = computed(() => {
  if (!props.selectedAnnotation) return ''

  return getSelectedAnnotationIdentity(
    props.selectedAnnotation.regionId,
    props.selectedAnnotation.schemaPublicationId,
    props.selectedAnnotation.annotationId
  )
})
</script>

<template>
  <aside class="annotation-sidebar border-start bg-body overflow-auto h-100">
    <div class="p-3">
      <h2 class="h6 mb-3">Annotations</h2>

      <div v-if="!selectedRegion" class="text-body-secondary">
        <p class="fw-semibold text-body mb-1">No region selected</p>
        <p class="mb-0">Select a region on the document to view and manage its annotations.</p>
      </div>
      <div v-else-if="resolvedAnnotations.length === 0" class="text-body-secondary">
        <p class="fw-semibold text-body mb-1">No annotations yet</p>
        <p class="mb-0">Add an annotation to start describing this region.</p>
      </div>
      <div v-else class="annotation-tree d-grid gap-1 text-body">
        <AnnotationTreeNode
          v-for="node in annotationTree"
          :key="node.id"
          :node="node"
          :selected-annotation-identity="selectedAnnotationIdentity"
          @select-annotation="emit('select-annotation', $event)"
        />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.annotation-sidebar {
  flex: 0 0 292px;
  width: 292px;
  min-width: 292px;
  overflow-x: hidden;
}

.annotation-tree {
  min-width: 0;
}
</style>
