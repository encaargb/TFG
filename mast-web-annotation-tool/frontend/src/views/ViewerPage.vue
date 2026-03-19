<script setup>
import { ref } from 'vue'
import { documentModel } from '../data/documentModel'

const pages = documentModel.pages
const activePage = ref(pages[0])
</script>

<template>
  <div class="viewer-layout">

    <div class="sidebar">
      <img
        v-for="p in pages"
        :key="p"
        :src="p"
        class="thumb"
        @click="activePage = p"
      />
    </div>

    <div class="canvas-area">
      <img :src="activePage" class="main-page"/>
    </div>

  </div>
</template>

<style scoped>
.viewer-layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 220px;
  background: #f3f3f3;
  overflow-y: auto;
  padding: 10px;
}

.thumb {
  width: 100%;
  margin-bottom: 10px;
  cursor: pointer;
}

.canvas-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #ddd;
}

.main-page {
  max-width: 90%;
  max-height: 90%;
}
</style>