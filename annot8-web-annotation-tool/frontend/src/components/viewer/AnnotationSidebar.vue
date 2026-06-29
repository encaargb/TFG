<script setup>
defineProps({
  selectedRegion: {
    type: Object,
    default: null,
  },
})
</script>

<template>
  <aside class="annotation-sidebar border-start bg-body overflow-auto h-100">
    <div class="p-3">
      <h2 class="h6 mb-3">Annotations</h2>

      <div v-if="selectedRegion" class="text-body-secondary">
        <p class="fw-semibold text-body mb-1">No annotations yet</p>
        <p class="mb-0">Add an annotation to start describing this region.</p>
      </div>
      <div v-else class="text-body-secondary">
        <p class="fw-semibold text-body mb-1">No region selected</p>
        <p class="mb-0">Select a region on the document to view and manage its annotations.</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.annotation-sidebar {
  flex: 0 0 292px;
  width: 292px;
  min-width: 292px;
}
</style>
