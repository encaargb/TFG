<template>
  <BApp>
    <ViewerPage />
  </BApp>
</template>

<script setup>
import ViewerPage from './views/ViewerPage.vue'
</script>

<style>
/*
  html, body, and #app are the top-level containers of the Vue application.

  They must all occupy the full available browser size, otherwise the viewer
  cannot behave like a full-screen tool workspace.
*/
html,
body,
#app {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
