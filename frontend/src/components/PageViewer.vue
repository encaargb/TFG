<template>
  <div class="viewer-wrapper">

    <div class="controls">
      <button @click="prevPage" :disabled="currentPage <= 1">← Anterior</button>
      <span>Página {{ currentPage }}</span>
      <button @click="nextPage" :disabled="currentPage >= TOTAL_PAGES">Siguiente →</button>
      <div class="zoom-control">
        <button @click="zoomOut">−</button>
        <input
          type="range"
          min="10"
          max="500"
          step="5"
          :value="zoomPercent"
          @input="onSliderInput"
        />
        <button @click="zoomIn">+</button>
        <span class="zoom-label">{{ zoomPercent }}%</span>
      </div>
      <button @click="resetZoom">Reset</button>
    </div>

    <div ref="viewportRef" class="viewport" @scroll="onScroll">
      <!-- Div invisible que define el área scrolleable -->
      <div ref="scrollSpacerRef" class="scroll-spacer"></div>
      <!-- Canvas Konva fijo encima -->
      <div ref="containerRef" class="canvas-container"></div>
    </div>

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

const viewportRef     = ref<HTMLDivElement | null>(null)
const containerRef    = ref<HTMLDivElement | null>(null)
const scrollSpacerRef = ref<HTMLDivElement | null>(null)
const currentPage     = ref(1)
const currentScale    = ref(1)

const zoomPercent = computed(() => Math.round(currentScale.value * 100))

let stage           : Konva.Stage
let imageLayer      : Konva.Layer
let annotationLayer : Konva.Layer
let konvaImage      : Konva.Image
let imgNaturalWidth  = 0
let imgNaturalHeight = 0

onMounted(() => {
  const container = containerRef.value!
  const viewport  = viewportRef.value!

  stage = new Konva.Stage({
    container,
    width:  viewport.clientWidth,
    height: viewport.clientHeight,
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
  const viewport = viewportRef.value!
  stage.width(viewport.clientWidth)
  stage.height(viewport.clientHeight)
}

// ── Carga de imagen ──────────────────────────────────────
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

// ── Escala ───────────────────────────────────────────────
function fitScale() {
  const viewport = viewportRef.value!
  return viewport.clientWidth / imgNaturalWidth
}

function applyScale(newScale: number) {
  newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE)
  currentScale.value = newScale

  // Actualizar el spacer para que las barras de scroll reflejen el tamaño real
  const scaledW = Math.round(imgNaturalWidth  * newScale)
  const scaledH = Math.round(imgNaturalHeight * newScale)
  if (scrollSpacerRef.value) {
    scrollSpacerRef.value.style.width  = `${scaledW}px`
    scrollSpacerRef.value.style.height = `${scaledH}px`
  }

  // Mover el contenido del stage según la posición del scroll
  syncStageToScroll()
}

// ── Sincronizar stage con scroll ─────────────────────────
function syncStageToScroll() {
  const viewport = viewportRef.value!
  stage.position({
    x: -viewport.scrollLeft,
    y: -viewport.scrollTop,
  })
  konvaImage.setAttrs({
    scaleX: currentScale.value,
    scaleY: currentScale.value,
  })
  imageLayer.draw()
}

function onScroll() {
  syncStageToScroll()
}

// ── Zoom con rueda del ratón ─────────────────────────────
function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault()
  const newScale = e.evt.deltaY < 0
    ? Math.min(currentScale.value * SCALE_FACTOR, MAX_SCALE)
    : Math.max(currentScale.value / SCALE_FACTOR, MIN_SCALE)
  applyScale(newScale)
}

// ── Slider ───────────────────────────────────────────────
function onSliderInput(e: Event) {
  const newScale = Number((e.target as HTMLInputElement).value) / 100
  applyScale(newScale)
}

function zoomIn()  { applyScale(currentScale.value * SCALE_FACTOR) }
function zoomOut() { applyScale(currentScale.value / SCALE_FACTOR) }

function resetZoom() {
  const scale   = fitScale()
  const viewport = viewportRef.value!
  viewport.scrollLeft = 0
  viewport.scrollTop  = 0
  applyScale(scale)
}

// ── Paginación ───────────────────────────────────────────
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

.controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.controls button:not(:disabled):hover {
  background: #505050;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-control input[type="range"] {
  width: 120px;
  accent-color: #048A81;
}

.zoom-label {
  min-width: 40px;
  font-size: 13px;
  color: #ccc;
}

.viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #e8e8e8;
  position: relative;
}

.scroll-spacer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.canvas-container {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.canvas-container canvas {
  pointer-events: all;
}
</style>