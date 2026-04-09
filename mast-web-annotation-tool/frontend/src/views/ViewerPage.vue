<script setup>
import { computed, ref } from 'vue'
import { documentModel } from '../data/documentModel'

const pages = documentModel.pages
const selectedIndex = ref(0)

const selectedPage = computed(() => pages[selectedIndex.value])

function goToPreviousPage() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}

function goToNextPage() {
  if (selectedIndex.value < pages.length - 1) {
    selectedIndex.value++
  }
}

function selectPage(index) {
  selectedIndex.value = index
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
      </div>

      <img :src="selectedPage" class="main-image" />
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
}

.thumb.active {
  border-color: blue;
}

.viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ddd;
  gap: 16px;
}

.viewer-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-image {
  max-width: 90%;
  max-height: 80%;
}
</style>