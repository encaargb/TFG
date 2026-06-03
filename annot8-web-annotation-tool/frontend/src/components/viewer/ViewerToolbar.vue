<script setup>
import { BBadge, BButton, BButtonGroup, BButtonToolbar, BNavbar } from 'bootstrap-vue-next'

defineProps({
  selectedIndex: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value >= 0,
  },
  totalPages: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  activeTool: {
    type: String,
    required: true,
    validator: (value) => ['select', 'rectangle', 'polygon', 'polyline'].includes(value),
  },
  regionCount: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value >= 0,
  },
  hasSelectedRegion: {
    type: Boolean,
    required: true,
  },
  zoomLevel: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  minZoom: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  maxZoom: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  zoomPercentage: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  mousePos: {
    type: Object,
    required: true,
  },
})

defineEmits([
  'previous-page',
  'next-page',
  'set-active-tool',
  'delete-selected-region',
  'zoom-out',
  'reset-zoom',
  'zoom-in',
])
</script>

<template>
  <BNavbar
    class="viewer-controls border-bottom px-3 py-2"
    variant="body"
    aria-label="Viewer controls"
  >
    <BButtonToolbar
      class="d-flex align-items-center gap-2 flex-wrap w-100"
      aria-label="Viewer actions"
    >
      <BButtonGroup size="sm" aria-label="Page navigation">
        <BButton
          type="button"
          variant="outline-secondary"
          aria-label="Previous page"
          :disabled="selectedIndex === 0"
          @click="$emit('previous-page')"
        >
          Previous
        </BButton>

        <BButton
          type="button"
          variant="outline-secondary"
          aria-label="Next page"
          :disabled="selectedIndex === totalPages - 1"
          @click="$emit('next-page')"
        >
          Next
        </BButton>
      </BButtonGroup>

      <BBadge variant="secondary">
        Page {{ selectedIndex + 1 }} / {{ totalPages }}
      </BBadge>

      <div class="vr d-none d-md-block"></div>

      <BButtonGroup size="sm" aria-label="Region tools">
        <BButton
          type="button"
          aria-label="Select region tool"
          :variant="activeTool === 'select' ? 'primary' : 'outline-secondary'"
          :aria-pressed="activeTool === 'select'"
          @click="$emit('set-active-tool', 'select')"
        >
          Select
        </BButton>
        <BButton
          type="button"
          aria-label="Select rectangle tool"
          :variant="activeTool === 'rectangle' ? 'primary' : 'outline-secondary'"
          :aria-pressed="activeTool === 'rectangle'"
          @click="$emit('set-active-tool', 'rectangle')"
        >
          Rectangle
        </BButton>
        <BButton
          type="button"
          aria-label="Select polygon tool"
          :variant="activeTool === 'polygon' ? 'primary' : 'outline-secondary'"
          :aria-pressed="activeTool === 'polygon'"
          @click="$emit('set-active-tool', 'polygon')"
        >
          Polygon
        </BButton>
        <BButton
          type="button"
          aria-label="Select polyline tool"
          :variant="activeTool === 'polyline' ? 'primary' : 'outline-secondary'"
          :aria-pressed="activeTool === 'polyline'"
          @click="$emit('set-active-tool', 'polyline')"
        >
          Polyline
        </BButton>
      </BButtonGroup>

      <BBadge variant="light" class="border">
        Regions: {{ regionCount }}
      </BBadge>

      <BButton
        type="button"
        size="sm"
        variant="outline-danger"
        aria-label="Delete selected region"
        :disabled="!hasSelectedRegion"
        @click="$emit('delete-selected-region')"
      >
        Delete
      </BButton>

      <div class="vr d-none d-md-block"></div>

      <BButtonGroup size="sm" aria-label="Zoom controls">
        <BButton
          type="button"
          variant="outline-secondary"
          aria-label="Zoom out"
          :disabled="zoomLevel <= minZoom"
          @click="$emit('zoom-out')"
        >
          -
        </BButton>
        <BButton
          type="button"
          variant="outline-secondary"
          aria-label="Reset zoom"
          @click="$emit('reset-zoom')"
        >
          Reset
        </BButton>
        <BButton
          type="button"
          variant="outline-secondary"
          aria-label="Zoom in"
          :disabled="zoomLevel >= maxZoom"
          @click="$emit('zoom-in')"
        >
          +
        </BButton>
      </BButtonGroup>

      <BBadge variant="light" class="border">
        Zoom: {{ zoomPercentage }}%
      </BBadge>

      <BBadge variant="light" class="coords border ms-md-auto">
        ({{ mousePos.x }}, {{ mousePos.y }})
      </BBadge>
    </BButtonToolbar>
  </BNavbar>
</template>

<style scoped>
.coords {
  font-family: monospace;
}
</style>
