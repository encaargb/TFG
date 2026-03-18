<template>
  <div class="viewer-wrapper">
    <div class="controls">
      <button @click="prevPage" :disabled="currentPage <= 1">← Anterior</button>
      <span>Página {{ currentPage }}</span>
      <div class="zoom-control">
        <button @click="zoomOut">−</button>
        <input type="range" min="10" max="500" step="5" :value="zoomPercent" @input="onSliderInput" />
        <button @click="zoomIn">+</button>
        <span>{{ zoomPercent }}%</span>
      </div>
      <button @click="nextPage" :disabled="currentPage >= TOTAL_PAGES">Siguiente →</button>
      <button @click="resetZoom">Reset</button>
    </div>
    <div ref="containerRef" class="canvas-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import Konva from 'konva'

const TOTAL_PAGES = 15
const BASE_URL    = 'http://localhost:8000/documents'
const DOC_ID      = 'doc1'

const containerRef = ref<HTMLDivElement | null>(null)
const currentPage  = ref(1)

let stage      : Konva.Stage
let imageLayer : Konva.Layer
let konvaImage : Konva.Image
let imgW = 0
let imgH = 0

const currentScale = ref(1)
const zoomPercent  = computed(() => Math.round(currentScale.value * 100))

onMounted(() => {
  const c = containerRef.value!
  stage = new Konva.Stage({ container: c, width: c.clientWidth, height: c.clientHeight, draggable: true })
  imageLayer = new Konva.Layer()
  stage.add(imageLayer)
  stage.on('wheel', onWheel)
  loadPage()
})

onUnmounted(() => stage.destroy())

function loadPage() {
  fetch(`${BASE_URL}/${DOC_ID}/page${currentPage.value}.jpg`)
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const img = new window.Image()
      img.src = url
      img.onload = () => {
        if (konvaImage) konvaImage.destroy()
        imgW = img.width
        imgH = img.height
        konvaImage = new Konva.Image({ image: img, x: 0, y: 0 })
        imageLayer.add(konvaImage)
        URL.revokeObjectURL(url)
        resetZoom()
      }
    })
}

watch(currentPage, loadPage)

function resetZoom() {
  const c     = containerRef.value!
  const scale = c.clientWidth / imgW
  stage.scale({ x: scale, y: scale })
  stage.position({ x: 0, y: 0 })
  currentScale.value = scale
}

function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault()
  const old = stage.scaleX()
  const ptr = stage.getPointerPosition()!
  const s   = e.evt.deltaY < 0 ? Math.min(old * 1.08, 10) : Math.max(old / 1.08, 0.1)
  stage.scale({ x: s, y: s })
  stage.position({
    x: ptr.x - (ptr.x - stage.x()) / old * s,
    y: ptr.y - (ptr.y - stage.y()) / old * s,
  })
  currentScale.value = s
}

function prevPage() { if (currentPage.value > 1) currentPage.value-- }
function nextPage() { if (currentPage.value < TOTAL_PAGES) currentPage.value++ }

function onSliderInput(e: Event) {
  const s = Number((e.target as HTMLInputElement).value) / 100
  stage.scale({ x: s, y: s })
  currentScale.value = s
}

function zoomIn()  {
  const s = Math.min(stage.scaleX() * 1.08, 10)
  stage.scale({ x: s, y: s })
  currentScale.value = s
}

function zoomOut() {
  const s = Math.max(stage.scaleX() / 1.08, 0.1)
  stage.scale({ x: s, y: s })
  currentScale.value = s
}

</script>

<style scoped>
.viewer-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 16px;
  background: #2c2c2c;
  color: white;
  flex-shrink: 0;
}

.controls button {
  padding: 4px 12px;
  background: #3c3c3c;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
}

.controls button:disabled { opacity: 0.4; cursor: not-allowed; }

.canvas-container {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  background: #e8e8e8;
}

.canvas-container:active { cursor: grabbing; }

.zoom-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-control input[type="range"] {
  width: 120px;
  accent-color: #048A81;
}

</style>