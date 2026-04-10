<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import Konva from 'konva'
import { documentModel } from '../data/documentModel'

const pages = documentModel.pages
const selectedIndex = ref(0)

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.2

const zoomLevel = ref(1)

const selectedPage = computed(() => pages[selectedIndex.value])
const zoomPercentage = computed(() => Math.round(zoomLevel.value * 100))

function resetZoom() {
  zoomLevel.value = 1
  updateZoom()
}

function goToPreviousPage() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
    resetZoom()
  }
}

function goToNextPage() {
  if (selectedIndex.value < pages.length - 1) {
    selectedIndex.value++
    resetZoom()
  }
}

function selectPage(index) {
  selectedIndex.value = index
  resetZoom()
}

function zoomIn() {
  if (zoomLevel.value < MAX_ZOOM) {
    zoomLevel.value = Math.min(zoomLevel.value + ZOOM_STEP, MAX_ZOOM)
    updateZoom()
  }
}

function zoomOut() {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM)
    updateZoom()
  }
}

const canvasContainer = ref(null)

let stage = null
let layer = null
let testRect = null

function updateZoom() {
  if (!layer) return

  layer.scale({
    x: zoomLevel.value,
    y: zoomLevel.value
  })

  layer.draw()
}

onMounted(() => {
  const width = 1000
  const height = 700

  stage = new Konva.Stage({
    container: canvasContainer.value,
    width,
    height
  })

  layer = new Konva.Layer()
  stage.add(layer)

  testRect = new Konva.Rect({
    x: 100,
    y: 100,
    width: 300,
    height: 200,
    fill: 'lightblue',
    stroke: 'blue',
    strokeWidth: 3
  })

  layer.add(testRect)
  layer.draw()
})

onBeforeUnmount(() => {
  if (stage) {
    stage.destroy()
    stage = null
  }
})
</script>

<template>
  <div class="layout">
    <div class="sidebar">
      <img
        v-for="(p, index) in pages"
        :key="p"
        :src="p"
        class="thumb"
        :class="{ active: selectedIndex === index }"
        @click="selectPage(index)"
      />
    </div>

    <div class="viewer">
      <div class="viewer-controls">
        <button @click="goToPreviousPage" :disabled="selectedIndex === 0">
          Previous
        </button>

        <span>Page {{ selectedIndex + 1 }} / {{ pages.length }}</span>

        <button
          @click="goToNextPage"
          :disabled="selectedIndex === pages.length - 1"
        >
          Next
        </button>

        <button @click="zoomOut" :disabled="zoomLevel <= MIN_ZOOM">-</button>
        <button @click="resetZoom">Reset</button>
        <button @click="zoomIn" :disabled="zoomLevel >= MAX_ZOOM">+</button>

        <span>Zoom: {{ zoomPercentage }}%</span>
      </div>

      <div class="canvas-wrapper">
        <div ref="canvasContainer" class="konva-container"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 200px;
  overflow-y: auto;
  background: #f3f3f3;
  padding: 10px;
}

.thumb {
  width: 100%;
  margin-bottom: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  box-sizing: border-box;
}

.thumb.active {
  border-color: blue;
}

.viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ddd;
}

.viewer-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #eee;
  border-bottom: 1px solid #ccc;
}

.canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 20px;
}

.konva-container {
  width: 1000px;
  height: 700px;
  background: white;
  border: 1px solid #999;
}
</style>