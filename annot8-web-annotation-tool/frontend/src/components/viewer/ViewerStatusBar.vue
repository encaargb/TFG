<script setup>
import { computed } from 'vue'

const props = defineProps({
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
  zoomPercentage: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  activeTool: {
    type: String,
    required: true,
    validator: (value) => ['select', 'rectangle', 'polygon', 'polyline'].includes(value),
  },
  selectedRegion: {
    type: Object,
    default: null,
  },
  currentPageRegionCount: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value >= 0,
  },
  mousePos: {
    type: Object,
    default: null,
  },
  saveStatus: {
    type: String,
    required: true,
    validator: (value) => ['saved', 'saving', 'error'].includes(value),
  },
})

const toolLabels = {
  select: 'Select',
  rectangle: 'Rectangle',
  polygon: 'Polygon',
  polyline: 'Polyline',
}

const saveLabels = {
  saved: 'Saved',
  saving: 'Saving...',
  error: 'Save error',
}

const selectedRegionLabel = computed(() => {
  if (!props.selectedRegion) return 'none'

  return `${toolLabels[props.selectedRegion.type] ?? props.selectedRegion.type} ${props.selectedRegion.id}`
})

const mouseLabel = computed(() => {
  if (!props.mousePos) return '(–, –)'

  return `(${props.mousePos.x}, ${props.mousePos.y})`
})
</script>

<template>
  <footer class="status-bar px-3">
    <div class="d-flex align-items-center status-bar-items">
      <span class="status-item">
        Page {{ selectedIndex + 1 }} / {{ totalPages }}
      </span>
      <span class="status-item">
        Zoom {{ zoomPercentage }}%
      </span>
      <span class="status-item">
        Tool: {{ toolLabels[activeTool] }}
      </span>
      <span class="status-item">
        Selected: {{ selectedRegionLabel }}
      </span>
      <span class="status-item">
        Page regions: {{ currentPageRegionCount }}
      </span>
      <span class="status-item status-coords ms-md-auto">
        Mouse: {{ mouseLabel }}
      </span>
      <span class="status-item">
        Save: {{ saveLabels[saveStatus] }}
      </span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1030;
  flex-shrink: 0;
  min-height: 24px;
  background: #e9ecef;
  border-top: 1px solid #adb5bd;
  color: #495057;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.72rem;
  line-height: 23px;
}

.status-bar-items {
  min-height: 23px;
}

.status-item {
  padding: 0 0.75rem;
  white-space: nowrap;
}

.status-item:first-child {
  padding-left: 0;
}

.status-item:last-child {
  border-right: 0;
  padding-right: 0;
}

.status-coords {
  color: #212529;
  text-align: right;
}
</style>
