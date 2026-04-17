<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Konva from 'konva'
import { documentModel } from '../data/documentModel'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getNextZoom,
  getPreviousZoom,
  getVisibleDimensions,
  getZoomPercentage,
} from '../utils/viewerMath'

const pages = documentModel.pages
const selectedIndex = ref(0)

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const ZOOM_STEP = 0.25

const zoomLevel = ref(1)

const selectedPage = computed(() => pages[selectedIndex.value])
const zoomPercentage = computed(() => getZoomPercentage(zoomLevel.value))

const mousePos = ref({ x: 0, y: 0 })

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
    zoomLevel.value = getNextZoom(zoomLevel.value, ZOOM_STEP, MAX_ZOOM)
    updateZoom()
  }
}

function zoomOut() {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = getPreviousZoom(zoomLevel.value, ZOOM_STEP, MIN_ZOOM)
    updateZoom()
  }
}

// ---------------- KONVA ----------------

const canvasContainer = ref(null)

let stage = null
let imageLayer = null
let pageImageNode = null

let baseImageWidth = 0
let baseImageHeight = 0

function updateZoom() {
  if (!stage || !pageImageNode) return

  const { width: visibleWidth, height: visibleHeight } = getVisibleDimensions(
    baseImageWidth,
    baseImageHeight,
    zoomLevel.value
  )

  stage.width(visibleWidth)
  stage.height(visibleHeight)

  pageImageNode.x(0)
  pageImageNode.y(0)
  pageImageNode.width(visibleWidth)
  pageImageNode.height(visibleHeight)

  imageLayer.draw()
}

function loadSelectedPageInKonva(src) {
  if (!imageLayer || !stage) return

  const img = new window.Image()
  img.src = src

  img.onload = () => {
    if (pageImageNode) {
      pageImageNode.destroy()
      pageImageNode = null
    }

    const maxWidth = 1000
    const maxHeight = 700

    const fittedDimensions = getFittedDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight
    )

    baseImageWidth = fittedDimensions.width
    baseImageHeight = fittedDimensions.height

    stage.width(baseImageWidth)
    stage.height(baseImageHeight)

    pageImageNode = new Konva.Image({
      x: 0,
      y: 0,
      image: img,
      width: baseImageWidth,
      height: baseImageHeight
    })

    imageLayer.add(pageImageNode)
    updateZoom()
  }
}

onMounted(() => {
  stage = new Konva.Stage({
    container: canvasContainer.value,
    width: 1000,
    height: 700
  })

  imageLayer = new Konva.Layer()
  stage.add(imageLayer)

  stage.on('mousemove', () => {
    const pos = stage.getPointerPosition()
    const coordinates = getDocumentCoordinates(
      pos,
      zoomLevel.value,
      baseImageWidth,
      baseImageHeight
    )

    if (!coordinates) return

    mousePos.value = coordinates
  })

  loadSelectedPageInKonva(selectedPage.value)
})

watch(selectedPage, (newPage) => {
  loadSelectedPageInKonva(newPage)
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

        <!-- Mouse coordinates -->
        <span class="coords">
          ({{ mousePos.x }}, {{ mousePos.y }})
        </span>
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
  overflow: hidden;
}

.sidebar {
  width: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #f3f3f3;
  padding: 10px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.thumb {
  width: 100%;
  margin-bottom: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  box-sizing: border-box;
  display: block;
}

.thumb.active {
  border-color: blue;
}

.viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ddd;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.viewer-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #eee;
  border-bottom: 1px solid #ccc;
  flex-shrink: 0;
}

/* Optional visual styling */
.coords {
  font-family: monospace;
  opacity: 0.7;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background: #ddd;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}

.konva-container {
  display: inline-block;
  background: white;
  border: 1px solid #999;
}
</style>
