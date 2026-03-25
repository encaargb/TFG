<script setup>
// Vue Composition API utilities:
//
// ref:
// Creates reactive references tracked by Vue.
//
// onMounted:
// Runs code after the component has been inserted into the DOM.
//
// onUnmounted:
// Runs cleanup logic before the component is removed.
//
// watch:
// Reacts to changes in reactive values.
//
// nextTick:
// Waits until Vue finishes the current DOM update cycle.
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

// Konva:
// 2D canvas library used as the rendering and interaction engine
// of the document viewer.
import Konva from 'konva'

// Local mock document model.
// It provides the list of page image URLs.
import { documentModel } from '../data/documentModel'

// All page URLs of the current document.
const pages = documentModel.pages

// Currently selected page in the sidebar.
const activePage = ref(pages[0])

// DOM ref to the visible scrollable viewport.
// This element provides native browser scrollbars.
const scrollContainer = ref(null)

// DOM ref to the HTML node where Konva mounts the stage.
const stageContainer = ref(null)

// Konva root stage.
// In this experiment, the stage is NOT draggable because
// navigation is controlled by native scrollbars.
let stage = null

// Main Konva layer used to render the current page.
// Future annotation shapes can also live in this layer
// or in separate layers above it.
let layer = null

// Reference to the currently displayed Konva.Image.
let konvaImage = null

// Real visible viewport size in pixels.
// These values come from the browser after mount.
let viewportWidth = 0
let viewportHeight = 0

// Logical scrollable world size.
//
// This is intentionally much larger than the visible viewport.
// The browser uses this area to show horizontal and vertical scrollbars.
const WORLD_WIDTH = 3000
const WORLD_HEIGHT = 3000

// Extra padding around the visible viewport.
//
// This follows the Konva demo approach:
// the stage itself is a bit larger than the visible window,
// so movement near the edges feels smoother.
const PADDING = 200

// createStage():
// Creates the Konva stage and its base layer.
//
// Important architectural idea:
// - The DOM provides the large scrollable world.
// - Konva renders only a smaller stage near the visible viewport.
// - Screen movement is emulated by shifting the stage container
//   with CSS transform and updating stage coordinates accordingly.
function createStage() {
  // Read the real visible size of the viewport.
  viewportWidth = scrollContainer.value.clientWidth
  viewportHeight = scrollContainer.value.clientHeight

  // Create the Konva stage.
  //
  // The stage is slightly larger than the visible viewport because
  // extra padding helps when scrolling near the edges.
  stage = new Konva.Stage({
    container: stageContainer.value,
    width: viewportWidth + PADDING * 2,
    height: viewportHeight + PADDING * 2,
    draggable: false,
  })

  // Create the main drawing layer.
  layer = new Konva.Layer()
  stage.add(layer)
}

// repositionStage():
// Synchronizes the Konva stage with the native DOM scroll position.
//
// How it works:
// 1. The browser scrollbars move inside the large HTML world.
// 2. We read scrollLeft and scrollTop from the viewport.
// 3. We move the stage HTML container with CSS transform.
// 4. We move Konva content in the opposite direction.
//
// This creates the effect of moving through a very large canvas
// without rendering a giant canvas element.
function repositionStage() {
  if (!scrollContainer.value || !stage) return

  const dx = scrollContainer.value.scrollLeft - PADDING
  const dy = scrollContainer.value.scrollTop - PADDING

  // Move the HTML container of the stage.
  stage.container().style.transform = `translate(${dx}px, ${dy}px)`

  // Move the Konva scene in the opposite direction so the correct
  // logical region remains visible.
  stage.position({
    x: -dx,
    y: -dy,
  })

  stage.batchDraw()
}

// loadActivePage(imageUrl):
// Loads the selected page image and renders it inside the logical world.
//
// Unlike the previous version of the viewer, the image is now scaled
// relative to the large scrollable world, not only to the visible viewport.
function loadActivePage(imageUrl) {
  const imageObj = new window.Image()

  imageObj.onload = () => {
    // Clear previous content before drawing the new page.
    layer.destroyChildren()

    // Compute a scale so the image fits inside the logical world
    // while preserving its aspect ratio.
    const scale = Math.min(
      WORLD_WIDTH / imageObj.width,
      WORLD_HEIGHT / imageObj.height
    )

    const displayWidth = imageObj.width * scale
    const displayHeight = imageObj.height * scale

    // Center the page inside the logical world.
    konvaImage = new Konva.Image({
      x: (WORLD_WIDTH - displayWidth) / 2,
      y: (WORLD_HEIGHT - displayHeight) / 2,
      image: imageObj,
      width: displayWidth,
      height: displayHeight,
    })

    layer.add(konvaImage)
    layer.draw()

    // Reset stage transform to a neutral state before setting
    // the initial scroll position.
    stage.position({ x: 0, y: 0 })
    stage.scale({ x: 1, y: 1 })

    // Start near the top-left, offset by padding.
    //
    // This ensures the padded stage area behaves correctly
    // before the user starts scrolling.
    if (scrollContainer.value) {
      scrollContainer.value.scrollLeft = PADDING
      scrollContainer.value.scrollTop = PADDING
      repositionStage()
    }
  }

  // Start asynchronous image loading.
  imageObj.src = imageUrl
}

// handleResize():
// Updates the stage size when the browser window changes size.
//
// The world size remains fixed, but the visible viewport may change,
// so the stage dimensions must be recalculated.
function handleResize() {
  if (!scrollContainer.value || !stage) return

  viewportWidth = scrollContainer.value.clientWidth
  viewportHeight = scrollContainer.value.clientHeight

  stage.width(viewportWidth + PADDING * 2)
  stage.height(viewportHeight + PADDING * 2)

  repositionStage()
}

// Lifecycle: mount.
//
// Steps:
// 1. Wait until Vue has rendered the DOM.
// 2. Create the Konva stage.
// 3. Load the initial page.
// 4. Register scroll and resize listeners.
onMounted(async () => {
  await nextTick()

  createStage()
  loadActivePage(activePage.value)

  scrollContainer.value?.addEventListener('scroll', repositionStage)
  window.addEventListener('resize', handleResize)
})

// Lifecycle: unmount.
//
// Remove listeners to avoid leaks or duplicated handlers.
onUnmounted(() => {
  scrollContainer.value?.removeEventListener('scroll', repositionStage)
  window.removeEventListener('resize', handleResize)
})

// React to page changes from the sidebar.
//
// When the user clicks a different thumbnail, the new page is loaded
// into the Konva layer using the same large-world scrolling model.
watch(activePage, (newPage) => {
  if (stage && layer) {
    loadActivePage(newPage)
  }
})
</script>

<template>
  <div class="viewer-layout">
    <div class="sidebar">
      <!--
        Sidebar thumbnail list.

        Each thumbnail represents one page of the current document.
        Clicking a thumbnail updates `activePage`, and the watcher
        reloads that page in the Konva viewer.
      -->
      <img
        v-for="p in pages"
        :key="p"
        :src="p"
        class="thumb"
        :class="{ active: activePage === p }"
        @click="activePage = p"
      />
    </div>

    <div class="canvas-area">
      <!--
        Visible scrollable viewport.

        This is the DOM element that provides native browser scrollbars.
        The user interacts with this viewport to move through the large world.
      -->
      <div ref="scrollContainer" class="scroll-container">
        <!--
          Large logical world.

          This element is intentionally larger than the viewport.
          Its purpose is to create the browser scroll range.
        -->
        <div class="large-container">
          <!--
            Konva mount point.

            Konva creates its internal canvas elements inside this node.
            This node is moved with CSS transform to emulate screen movement.
          -->
          <div ref="stageContainer" class="stage-container"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  Main horizontal layout:
  - fixed thumbnail sidebar on the left
  - viewer workspace on the right
*/
.viewer-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/*
  Left sidebar for page thumbnails.
*/
.sidebar {
  width: 220px;
  min-width: 220px;
  background: #f3f3f3;
  overflow-y: auto;
  padding: 10px;
  box-sizing: border-box;
}

/*
  Base thumbnail style.
*/
.thumb {
  width: 100%;
  margin-bottom: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  box-sizing: border-box;
}

/*
  Hover feedback for thumbnails.
*/
.thumb:hover {
  border-color: #999;
}

/*
  Visual highlight for the selected page.
*/
.thumb.active {
  border-color: #2c7be5;
}

/*
  Right-side workspace.
*/
.canvas-area {
  flex: 1;
  background: #ddd;
  overflow: hidden;
}

/*
  Visible scrollable viewport with native browser scrollbars.
*/
.scroll-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  background: #cfcfcf;
}

/*
  Large logical world.

  The browser uses this size to determine the available scroll range.
*/
.large-container {
  width: 3000px;
  height: 3000px;
  position: relative;
  overflow: hidden;
}

/*
  HTML node where Konva mounts its internal canvas.

  It is absolutely positioned so it can be shifted precisely
  inside the logical world using CSS transform.
*/
.stage-container {
  position: absolute;
  top: 0;
  left: 0;
}
</style>