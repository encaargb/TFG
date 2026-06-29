<script setup>
import { computed } from 'vue'

defineOptions({
  name: 'AnnotationTreeNode',
})

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  selectedAnnotationIdentity: {
    type: String,
    default: '',
  },
})

defineEmits(['select-annotation', 'open-annotation-context-menu'])

const hasChildren = Array.isArray(props.node.children) && props.node.children.length > 0
const isSelected = computed(() => props.node.selectionIdentity === props.selectedAnnotationIdentity)
</script>

<template>
  <details v-if="hasChildren" open class="annotation-tree-branch">
    <summary class="annotation-tree-label">{{ node.name }}</summary>

    <div class="annotation-tree-children">
      <AnnotationTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-annotation-identity="selectedAnnotationIdentity"
        @select-annotation="$emit('select-annotation', $event)"
        @open-annotation-context-menu="$emit('open-annotation-context-menu', $event)"
      />
    </div>
  </details>
  <button
    v-else
    type="button"
    class="annotation-tree-leaf mb-0"
    :class="{ 'annotation-tree-leaf-selected': isSelected }"
    @click="$emit('select-annotation', node.selection)"
    @contextmenu.prevent="$emit('open-annotation-context-menu', { event: $event, annotation: node.selection })"
  >
    {{ node.name }}
  </button>
</template>

<style scoped>
.annotation-tree-branch {
  min-width: 0;
}

.annotation-tree-label {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-tree-children {
  margin-left: 1rem;
}

.annotation-tree-leaf {
  display: block;
  width: calc(100% - 1.2rem);
  margin-left: 1.2rem;
  padding: 0.1rem 0.35rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-tree-leaf-selected {
  background: rgba(13, 110, 253, 0.12);
}

.annotation-tree-leaf:hover {
  background: rgba(13, 110, 253, 0.08);
}
</style>
