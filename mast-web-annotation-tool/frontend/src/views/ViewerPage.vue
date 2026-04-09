<script setup>
import { ref } from 'vue'
import { documentModel } from '../data/documentModel'

const pages = documentModel.pages
const selectedPage = ref(pages[0])
</script>

<template>
  <div class="layout">
    <!-- Sidebar -->
    <div class="sidebar">
      <img
        v-for="p in pages"
        :key="p"
        :src="p"
        class="thumb"
        :class="{ active: selectedPage === p }"
        @click="selectedPage = p"
      />
    </div>

    <!-- Main viewer -->
    <div class="viewer">
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
  align-items: center;
  justify-content: center;
  background: #ddd;
}

.main-image {
  max-width: 90%;
  max-height: 90%;
}
</style>