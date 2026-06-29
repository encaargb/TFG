<script setup>
defineOptions({
  name: 'AnnotationTreeNode',
})

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
})

const hasChildren = Array.isArray(props.node.children) && props.node.children.length > 0
</script>

<template>
  <details v-if="hasChildren" open class="annotation-tree-branch">
    <summary class="annotation-tree-label">{{ node.name }}</summary>

    <div class="annotation-tree-children">
      <AnnotationTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
      />
    </div>
  </details>
  <p v-else class="annotation-tree-leaf mb-0">{{ node.name }}</p>
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
  margin-left: 1.2rem;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
