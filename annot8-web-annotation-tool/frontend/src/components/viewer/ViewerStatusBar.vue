<script setup>
import { computed } from 'vue'
import { Minus, Plus } from '@lucide/vue'

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
  zoomLevel: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  minZoomLevel: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  maxZoomLevel: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  zoomStep: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  defaultZoomLevel: {
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

const emit = defineEmits(['zoom-out', 'zoom-in', 'update-zoom-level'])

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
const defaultZoomMarkerPosition = computed(() => {
  const zoomRange = props.maxZoomLevel - props.minZoomLevel

  if (zoomRange <= 0) return '0%'

  const clampedDefaultZoom = Math.min(
    props.maxZoomLevel,
    Math.max(props.minZoomLevel, props.defaultZoomLevel)
  )
  const position = ((clampedDefaultZoom - props.minZoomLevel) / zoomRange) * 100

  return `${position}%`
})

function updateZoomLevel(event) {
  const zoomLevel = Number(event?.target?.value)

  if (!Number.isFinite(zoomLevel)) return

  emit('update-zoom-level', zoomLevel)
}
</script>

<template>
  <footer class="status-bar px-3">
    <div class="d-flex align-items-center status-bar-items">
      <span class="status-item">
        Page {{ selectedIndex + 1 }} / {{ totalPages }}
      </span>
      <span class="status-item status-coords">
        Mouse: {{ mouseLabel }}
      </span>
      <span class="status-item">
        Tool: {{ toolLabels[activeTool] }}
      </span>
      <span class="status-item">
        Selected: {{ selectedRegionLabel }}
      </span>
      <span class="status-item">
        Regions on page: {{ currentPageRegionCount }}
      </span>
      <span class="status-item statusbar-zoom-control ms-md-auto">
        <button
          type="button"
          class="statusbar-zoom-button"
          aria-label="Zoom out"
          :disabled="zoomLevel <= minZoomLevel"
          @click="$emit('zoom-out')"
        >
          <Minus
            class="status-icon"
            :size="14"
            :stroke-width="2.4"
            aria-hidden="true"
            focusable="false"
          />
        </button>
        <span
          class="statusbar-zoom-slider-wrapper"
          :style="{ '--default-zoom-position': defaultZoomMarkerPosition }"
        >
          <input
            class="statusbar-zoom-slider"
            type="range"
            aria-label="Zoom level"
            :min="minZoomLevel"
            :max="maxZoomLevel"
            :step="zoomStep"
            :value="zoomLevel"
            @input="updateZoomLevel"
          />
          <span class="statusbar-zoom-default-marker" aria-hidden="true"></span>
        </span>
        <button
          type="button"
          class="statusbar-zoom-button"
          aria-label="Zoom in"
          :disabled="zoomLevel >= maxZoomLevel"
          @click="$emit('zoom-in')"
        >
          <Plus
            class="status-icon"
            :size="14"
            :stroke-width="2.4"
            aria-hidden="true"
            focusable="false"
          />
        </button>
        <span class="statusbar-zoom-percentage">{{ zoomPercentage }}%</span>
      </span>
      <span class="status-item">
        {{ saveLabels[saveStatus] }}
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

.statusbar-zoom-control {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.statusbar-zoom-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 0.2rem;
  background: transparent;
  color: #6c757d;
  line-height: 1;
}

.statusbar-zoom-button:not(:disabled):hover {
  border-color: #adb5bd;
  background: #f8f9fa;
  color: #212529;
}

.statusbar-zoom-button:disabled {
  opacity: 0.45;
}

.status-icon {
  display: block;
}

.statusbar-zoom-slider-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 7rem;
}

.statusbar-zoom-slider {
  width: 7rem;
  height: 0.75rem;
  margin: 0;
  appearance: none;
  background: transparent;
  vertical-align: middle;
}

.statusbar-zoom-slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: #c6cbd1;
}

.statusbar-zoom-slider::-webkit-slider-thumb {
  width: 4px;
  height: 12px;
  margin-top: -4.5px;
  appearance: none;
  border: 1px solid #5f6b76;
  border-radius: 999px;
  background: #6c757d;
}

.statusbar-zoom-slider::-moz-range-track {
  height: 3px;
  border-radius: 999px;
  background: #c6cbd1;
}

.statusbar-zoom-slider::-moz-range-thumb {
  width: 4px;
  height: 12px;
  border: 1px solid #5f6b76;
  border-radius: 999px;
  background: #6c757d;
}

.statusbar-zoom-default-marker {
  position: absolute;
  left: var(--default-zoom-position);
  top: 50%;
  width: 1px;
  height: 5px;
  background: #868e96;
  opacity: 0.45;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.statusbar-zoom-percentage {
  min-width: 1rem;
  color: #6c757d;
  line-height: 1;
  text-align: right;
}
</style>
