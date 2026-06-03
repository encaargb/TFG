<script setup>
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
  regionCount: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value >= 0,
  },
  mousePos: {
    type: Object,
    required: true,
  },
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
        Tool {{ activeTool }}
      </span>
      <span class="status-item">
        Regions {{ regionCount }}
      </span>
      <span class="status-item status-coords ms-md-auto">
        X {{ mousePos.x }} · Y {{ mousePos.y }}
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
