<template>
  <div class="viewer-wrapper">

    <div class="controls">
      <button @click="prevPage" :disabled="currentPage <= 1">← Anterior</button>
      <span>Página {{ currentPage }}</span>
      <button @click="nextPage" :disabled="currentPage >= TOTAL_PAGES">Siguiente →</button>
      <button @click="resetZoom">Restablecer zoom</button>
    </div>

    <div ref="containerRef" class="canvas-container"></div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Konva from 'konva'

// ── Configuración ────────────────────────────────────────
const TOTAL_PAGES = 15
const BASE_URL    = 'http://localhost:8000/documents'
const DOC_ID      = 'doc1'

// ── Referencias y estado ─────────────────────────────────
const containerRef = ref<HTMLDivElement | null>(null)
const currentPage  = ref(1)

let stage      : Konva.Stage
let imageLayer : Konva.Layer
let konvaImage : Konva.Image

// ── Inicializar Konva al montar el componente ────────────
onMounted(() => {
  const container = containerRef.value!

  stage = new Konva.Stage({
    container: container,
    width:     container.clientWidth,
    height:    container.clientHeight,
    draggable: true,   // pan con clic + arrastre
  })

  imageLayer = new Konva.Layer()
  stage.add(imageLayer)

  // Ajustar tamaño si se redimensiona la ventana
  window.addEventListener('resize', onResize)

  // Zoom con rueda del ratón
  stage.on('wheel', onWheel)

  loadPage()
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  stage.destroy()
})

// ── Redimensionar ────────────────────────────────────────
function onResize() {
  const container = containerRef.value!
  stage.width(container.clientWidth)
  stage.height(container.clientHeight)
}

// ── Carga de imagen ──────────────────────────────────────
function loadPage() {
  const url = `${BASE_URL}/${DOC_ID}/page${currentPage.value}.jpg`

  Konva.Image.fromURL(url, (img: Konva.Image) => {
    // Eliminar imagen anterior si existe
    if (konvaImage) konvaImage.destroy()

    konvaImage = img
    konvaImage.setAttrs({ x: 0, y: 0 })
    imageLayer.add(konvaImage)
    imageLayer.draw()
    resetZoom()
  })
}

watch(currentPage, loadPage)

// ── Zoom con rueda del ratón ─────────────────────────────
const SCALE_FACTOR = 1.08
const MIN_SCALE    = 0.1
const MAX_SCALE    = 10

function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault()

  const oldScale = stage.scaleX()
  const pointer  = stage.getPointerPosition()!

  const newScale = e.evt.deltaY < 0
    ? Math.min(oldScale * SCALE_FACTOR, MAX_SCALE)
    : Math.max(oldScale / SCALE_FACTOR, MIN_SCALE)

  // Mantiene el punto bajo el cursor fijo al hacer zoom
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  }

  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  })
}

// ── Reset zoom ───────────────────────────────────────────
function resetZoom() {
  stage.scale({ x: 1, y: 1 })
  stage.position({ x: 0, y: 0 })
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

.canvas-container {
  flex: 1;
  overflow: hidden;
  cursor: grab;
}

.canvas-container:active {
  cursor: grabbing;
}
</style>