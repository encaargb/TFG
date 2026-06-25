<template>
  <BApp>
    <ViewerPage />
  </BApp>
</template>

<script setup>
import { BApp } from 'bootstrap-vue-next'
import ViewerPage from './views/ViewerPage.vue'
</script>

<style>
/* The viewer owns the viewport; intermediate document scrolling happens inside the canvas wrapper. */
html,
body,
#app {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
