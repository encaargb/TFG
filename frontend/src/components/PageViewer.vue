<template>
  <div class="viewer-wrapper">
    <div class="controls">
      <button @click="prevPage" :disabled="currentPage <= 1">← Anterior</button>
      <span>Página {{ currentPage }}</span>
      <button @click="nextPage" :disabled="currentPage >= TOTAL_PAGES">Siguiente →</button>
      <div class="zoom-control">
        <button @click="zoomOut">−</button>
        <input type="range" min="10" max="500" step="5" :value="zoomPercent" @input="onSliderInput" />
        <button @click="zoomIn">+</button>
        <span class="zoom-label">{{ zoomPercent }}%</span>
      </div>
      <button @click="resetZoom">Reset</button>
    </div>
    <div ref="containerRef" class="canvas-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import Konva from 'konva'

const TOTAL_PAGES  = 15
const BASE_URL     = 'http://localhost:8000/documents'
const DOC_ID       = 'doc1'
const SCALE_FACTOR = 1.08
const MIN_SCALE    = 0.1
const MAX_SCALE    = 5

const containerRef = ref<HTMLDivElement | null>(null)
const currentPage  = ref(1)
const currentScale = ref(1)

const zoomPercent = computed(() => Math.round(currentScale.value * 100))

let stage           : Konva.Stage
let imageLayer      : Konva.Layer
let annotationLayer : Konva.Layer
let konvaImage      : Konva.Image
let imgNaturalWidth  = 0
let imgNaturalHeight = 0

onMounted(() => {
  const container = containerRef.value!
  stage = new Konva.Stage({
    container,
    width:     container.clientWidth,
    height:    container.clientHeight,
    draggable: true,
  })
  imageLayer      = new Konva.Layer()
  annotationLayer = new Konva.Layer()
  stage.add(imageLayer)
  stage.add(annotationLayer)
  stage.on('wheel', onWheel)
  window.addEventListener('resize', onResize)
  loadPage()
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  stage.destroy()
})

function onResize() {
  const container = containerRef.value!
  stage.width(container.clientWidth)
  stage.height(container.clientHeight)
}

function loadPage() {
  const url = `${BASE_URL}/${DOC_ID}/page${currentPage.value}.jpg`
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob)
      const imageObj  = new window.Image()
      imageObj.src    = objectUrl
      imageObj.onload = () => {
        if (konvaImage) konvaImage.destroy()
        imgNaturalWidth  = imageObj.width
        imgNaturalHeight = imageObj.height
        konvaImage = new Konva.Image({ image: imageObj, x: 0, y: 0 })
        imageLayer.add(konvaImage)
        URL.revokeObjectURL(objectUrl)
        resetZoom()
      }
    })
}

watch(currentPage, loadPage)

function fitScale() {
  const container = containerRef.value!
  return container.clientWidth / imgNaturalWidth
}

function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault()
  const oldScale = stage.scaleX()
  const pointer  = stage.getPointerPosition()!
  const newScale = e.evt.deltaY < 0
    ? Math.min(oldScale * SCALE_FACTOR, MAX_SCALE)
    : Math.max(oldScale / SCALE_FACTOR, MIN_SCALE)
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  }
  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  })
  currentScale.value = Math.round(newScale * 100) / 100
}

function onSliderInput(e: Event) {
  const newScale = Number((e.target as HTMLInputElement).value) / 100
  stage.scale({ x: newScale, y: newScale })
  currentScale.value = newScale
}

function zoomIn()  {
  const s = Math.min(stage.scaleX() * SCALE_FACTOR, MAX_SCALE)
  stage.scale({ x: s, y: s })
  currentScale.value = s
}

function zoomOut() {
  const s = Math.max(stage.scaleX() / SCALE_FACTOR, MIN_SCALE)
  stage.scale({ x: s, y: s })
  currentScale.value = s
}

function resetZoom() {
  const scale = fitScale()
  stage.scale({ x: scale, y: scale })
  stage.position({ x: 0, y: 0 })
  currentScale.value = scale
}

function prevPage() { if (currentPage.value > 1) currentPage.value-- }
function nextPage() { if (currentPage.value < TOTAL_PAGES) currentPage.value++ }
</script>

<style scoped>
.viewer-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #1a1a1a;
}
.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 16px;
  background: #2c2c2c;
  color: white;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
}
.controls button {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #3c3c3c;
  color: white;
  cursor: pointer;
}
.controls button:disabled { opacity: 0.4; cursor: not-allowed; }
.controls button:not(:disabled):hover { background: #505050; }
.zoom-control { display: flex; align-items: center; gap: 6px; }
.zoom-control input[type="range"] { width: 120px; accent-color: #048A81; }
.zoom-label { min-width: 40px; font-size: 13px; color: #ccc; }
.canvas-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  background: #e8e8e8;
}
.canvas-container:active { cursor: grabbing; }
</style>