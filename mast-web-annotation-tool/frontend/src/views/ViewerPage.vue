<script setup>
import { computed, ref } from 'vue'
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
  }
}

function zoomOut() {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM)
  }
}
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

      <div class="image-wrapper">
        <img
          :src="selectedPage"
          class="main-image"
          :style="{ transform: `scale(${zoomLevel})` }"
        />
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

.image-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 20px;
}

.main-image {
  max-width: 90%;
  max-height: 80%;
  transform-origin: center center;
}
</style>