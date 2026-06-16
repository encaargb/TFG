<script setup>
import { MousePointer2, Pentagon, Square, Waypoints } from '@lucide/vue'
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
      class="d-flex align-items-center gap-3 flex-wrap w-100"
      aria-label="Viewer actions"
    >
      <div class="toolbar-section">
        <span class="toolbar-label">Page</span>
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

      </div>

      <div class="toolbar-section toolbar-section--tools">
        <span class="toolbar-label">Tools</span>
        <BButtonGroup size="sm" aria-label="Region tools">
          <BButton
            type="button"
            class="toolbar-tool-button"
            aria-label="Select tool"
            title="Select tool"
            :variant="activeTool === 'select' ? 'secondary' : 'outline-secondary'"
            :aria-pressed="activeTool === 'select'"
            @click="$emit('set-active-tool', 'select')"
          >
            <MousePointer2
              class="toolbar-icon"
              :size="16"
              :stroke-width="2.4"
              aria-hidden="true"
              focusable="false"
            />
            <span class="visually-hidden">Select</span>
          </BButton>
          <BButton
            type="button"
            class="toolbar-tool-button"
            aria-label="Select rectangle tool"
            title="Rectangle tool"
            :variant="activeTool === 'rectangle' ? 'secondary' : 'outline-secondary'"
            :aria-pressed="activeTool === 'rectangle'"
            @click="$emit('set-active-tool', 'rectangle')"
          >
            <Square
              class="toolbar-icon"
              :size="16"
              :stroke-width="2.4"
              aria-hidden="true"
              focusable="false"
            />
            <span class="visually-hidden">Rectangle</span>
          </BButton>
          <BButton
            type="button"
            class="toolbar-tool-button"
            aria-label="Select polygon tool"
            title="Polygon tool"
            :variant="activeTool === 'polygon' ? 'secondary' : 'outline-secondary'"
            :aria-pressed="activeTool === 'polygon'"
            @click="$emit('set-active-tool', 'polygon')"
          >
            <Pentagon
              class="toolbar-icon"
              :size="16"
              :stroke-width="2.4"
              aria-hidden="true"
              focusable="false"
            />
            <span class="visually-hidden">Polygon</span>
          </BButton>
          <BButton
            type="button"
            class="toolbar-tool-button"
            aria-label="Select polyline tool"
            title="Polyline tool"
            :variant="activeTool === 'polyline' ? 'secondary' : 'outline-secondary'"
            :aria-pressed="activeTool === 'polyline'"
            @click="$emit('set-active-tool', 'polyline')"
          >
            <Waypoints
              class="toolbar-icon"
              :size="16"
              :stroke-width="2.4"
              aria-hidden="true"
              focusable="false"
            />
            <span class="visually-hidden">Polyline</span>
          </BButton>
        </BButtonGroup>

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
      </div>

      <div class="toolbar-section toolbar-section--view">
        <span class="toolbar-label">View</span>
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
      </div>
    </BButtonToolbar>
  </BNavbar>
</template>

<style scoped>
.viewer-controls {
  background: #f8f9fa;
}

.toolbar-section {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-section--tools,
.toolbar-section--view {
  border-left: 1px solid #dee2e6;
  padding-left: 1rem;
}

.toolbar-label {
  color: #6c757d;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.toolbar-tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar-icon {
  display: block;
}
</style>
