<template>
  <div class="viewer-layout">
    
    <div class="sidebar">
      Pages
    </div>

    <div class="canvas-area">
      Canvas Viewer
    </div>

  </div>
</template>

<style scoped>
.viewer-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 220px;
  background: #f3f3f3;
  border-right: 1px solid #ddd;
  padding: 10px;
  box-sizing: border-box;
}

.canvas-area {
  flex: 1;
  background: #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #555;
}
</style>