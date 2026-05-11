<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Konva from 'konva'
import { ProjectDocumentModel } from '../models/ProjectDocumentModel'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getNextZoom,
  getPreviousZoom,
  getVisibleDimensions,
  getZoomPercentage,
} from '../utils/viewerMath'

const pages = ProjectDocumentModel.pages
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
let originalImageWidth = 0
let originalImageHeight = 0

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

    originalImageWidth = img.width
    originalImageHeight = img.height
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
      baseImageHeight,
      originalImageWidth,
      originalImageHeight
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
  <div class="layout d-flex vh-100 overflow-hidden bg-body-tertiary">
    <aside class="sidebar border-end bg-light-subtle p-3">
      <div class="sidebar-title text-uppercase text-secondary fw-semibold small mb-3">
        Pages
      </div>

      <button
        v-for="(p, index) in pages"
        :key="p"
        type="button"
        class="thumb btn p-1 mb-3 w-100"
        :class="selectedIndex === index ? 'active btn-primary' : 'btn-light'"
        :aria-label="`Open page ${index + 1}`"
        @click="selectPage(index)"
      >
        <img :src="p" class="img-fluid rounded border" />
        <span class="thumb-label badge text-bg-light mt-2">
          {{ index + 1 }}
        </span>
      </button>
    </aside>

    <main class="viewer d-flex flex-column flex-grow-1 overflow-hidden">
      <div class="viewer-controls navbar bg-body border-bottom px-3 py-2">
        <div class="d-flex align-items-center gap-2 flex-wrap w-100">
          <div class="btn-group btn-group-sm" role="group" aria-label="Page navigation">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="goToPreviousPage"
              :disabled="selectedIndex === 0"
            >
              Previous
            </button>

            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="goToNextPage"
              :disabled="selectedIndex === pages.length - 1"
            >
              Next
            </button>
          </div>

          <span class="badge text-bg-secondary">
            Page {{ selectedIndex + 1 }} / {{ pages.length }}
          </span>

          <div class="vr d-none d-md-block"></div>

          <div class="btn-group btn-group-sm" role="group" aria-label="Zoom controls">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="zoomOut"
              :disabled="zoomLevel <= MIN_ZOOM"
            >
              -
            </button>
            <button type="button" class="btn btn-outline-secondary" @click="resetZoom">
              Reset
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="zoomIn"
              :disabled="zoomLevel >= MAX_ZOOM"
            >
              +
            </button>
          </div>

          <span class="badge text-bg-light border">
            Zoom: {{ zoomPercentage }}%
          </span>

          <span class="coords badge text-bg-light border ms-md-auto">
            ({{ mousePos.x }}, {{ mousePos.y }})
          </span>
        </div>
      </div>

      <div class="canvas-wrapper flex-grow-1 overflow-auto p-4">
        <div ref="canvasContainer" class="konva-container shadow-sm"></div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-width: 0;
}

.sidebar {
  width: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
}

.sidebar-title {
  letter-spacing: 0.08em;
}

.thumb {
  display: block;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.thumb:hover {
  transform: translateY(-1px);
}

.thumb.active img {
  border-color: rgba(255, 255, 255, 0.85) !important;
}

.thumb-label {
  min-width: 2rem;
}

.viewer {
  min-width: 0;
  min-height: 0;
}

.coords {
  font-family: monospace;
}

.canvas-wrapper {
  background: #dee2e6;
  min-width: 0;
  min-height: 0;
}

.konva-container {
  display: inline-block;
  background: white;
  border: 1px solid #adb5bd;
}
</style>
