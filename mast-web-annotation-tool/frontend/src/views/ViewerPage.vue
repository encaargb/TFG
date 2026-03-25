<script setup>
// Vue Composition API utilities:
//
// ref:
// Creates a reactive value. Vue tracks it and updates the UI when it changes.
//
// onMounted:
// Runs code after the component has been mounted in the DOM.
// This is required because Konva needs a real HTML container element to exist
// before the canvas stage can be created.
//
// watch:
// Observes a reactive value and runs code whenever that value changes.
// Here it is used to react when the selected page changes.
//
// nextTick:
// Waits until Vue has finished updating the DOM.
// This is useful to ensure that the HTML element referenced by `canvasContainer`
// really exists before Konva tries to use it.
import { ref, onMounted, watch, nextTick } from 'vue'

// Konva:
// A JavaScript canvas library for interactive 2D graphics.
// It provides concepts such as Stage, Layer, Image, Text, Shape, etc.
// In this project, it is used because a normal HTML <img> is not enough for:
//
// - panning
// - zooming
// - future annotations
// - future overlays
//
// Konva is the rendering/interaction engine of the viewer.
import Konva from 'konva'

// documentModel:
// A local mock data model that represents the current document.
// It provides the list of page image URLs.
//
// Example mental model:
// documentModel = {
//   id: "doc1",
//   pages: ["/documents/doc1/pages/pg1.jpeg", ...]
// }
//
// It is separated from the UI because data and presentation should not be mixed.
import { documentModel } from '../data/documentModel'


// pages:
// A plain array containing the URLs of the pages of the current document.
// This data comes from the document model.
//
// It is used:
// - in the sidebar to render thumbnails
// - to initialize the first active page
const pages = documentModel.pages


// activePage:
// A reactive Vue variable that stores the page currently selected by the user.
//
// `ref(...)` is used because this value changes over time.
// When the user clicks a thumbnail, `activePage` changes.
// Then the watcher reloads the selected page into Konva.
const activePage = ref(pages[0])


// canvasContainer:
// A Vue ref that will point to the HTML <div> where the Konva stage is mounted.
//
// In the template there will be:
// <div ref="canvasContainer" class="konva-container"></div>
//
// After the component is mounted, `canvasContainer.value` becomes the real DOM element.
// Konva needs that DOM element to know where to create its internal canvas.
const canvasContainer = ref(null)


// stage:
// The main Konva Stage object.
// The Stage is the root interactive area of the scene.
//
// Conceptually:
// Stage = viewport / canvas root
//
// It is responsible for:
// - containing layers
// - receiving drag events
// - receiving wheel events
// - applying pan and zoom transformations
let stage = null


// layer:
// A Konva Layer object.
// In Konva, drawable elements are usually placed inside layers, not directly in the stage.
//
// Conceptually:
// Stage
//   -> Layer
//       -> Image / Shape / Text / Annotation
//
// This separation is useful because:
// - layers can be redrawn independently
// - it mirrors how scene graphs are usually organized
let layer = null


// konvaImage:
// Stores the current Konva.Image instance being displayed in the layer.
//
// It represents the currently selected document page rendered on the canvas.
let konvaImage = null


// stageWidth and stageHeight store the real visible size
// of the Konva container in the browser.
//
// They are initialized later, after the component is mounted,
// because only then does the DOM know the real available space.
let stageWidth = 0
let stageHeight = 0


// createStage():
// Creates the Konva stage, creates a layer, and attaches wheel zoom behavior.
//
// Why this function is needed:
// - the stage should only be created once
// - setup logic should be separated from image-loading logic
// - the function groups all initialization related to the interactive viewport
function createStage() {
  // Read the real visible size of the HTML container.
  //
  // clientWidth and clientHeight come from the browser DOM.
  // They tell us how much space the viewer area actually has.
  stageWidth = canvasContainer.value.clientWidth
  stageHeight = canvasContainer.value.clientHeight

  // Create the Konva stage using the real container size.
  //
  // This makes the internal canvas match the visible viewer area.
  stage = new Konva.Stage({
    container: canvasContainer.value,
    width: stageWidth,
    height: stageHeight,
    draggable: true,
  })

  // Create a drawing layer and add it to the stage.
  layer = new Konva.Layer()
  stage.add(layer)

  // Register wheel zoom behavior.
  stage.on('wheel', (e) => {
    e.evt.preventDefault()

    const scaleBy = 1.05
    const oldScale = stage.scaleX()

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy

    stage.scale({ x: newScale, y: newScale })

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }

    stage.position(newPos)
    stage.batchDraw()
  })
}


// loadActivePage(imageUrl):
// Loads the selected page image into the Konva layer.
//
// Why this function is needed:
// - the displayed page changes when the user clicks a thumbnail
// - image loading is asynchronous
// - the viewer must clear the old page and draw the new one
//
// Parameter:
// imageUrl -> URL of the image file to render on the canvas
function loadActivePage(imageUrl) {
  // Create a plain browser Image object.
  //
  // This is not yet a Konva image.
  // It is a standard HTML image object used to load the image resource.
  const imageObj = new window.Image()

  // Define what should happen when the image finishes loading.
  //
  // This is necessary because width and height are only available after the image has loaded.
  imageObj.onload = () => {
    // Remove any previous children from the layer.
    //
    // Why:
    // The viewer should only show one page at a time in the main canvas.
    // When a new page is loaded, the previous page image must be removed first.
    layer.destroyChildren()

    // Compute the scale needed to fit the image inside the stage
    // while preserving aspect ratio.
    //
    // Math.min(...) is used to ensure that the image fits both width and height constraints.
    const scale = Math.min(
      stageWidth / imageObj.width,
      stageHeight / imageObj.height
    )

    // Final rendered width of the image after fit-to-stage scaling.
    const displayWidth = imageObj.width * scale

    // Final rendered height of the image after fit-to-stage scaling.
    const displayHeight = imageObj.height * scale

    // Create a Konva.Image object from the loaded browser image.
    //
    // x and y center the image inside the stage.
    //
    // image:
    // The source image already loaded in memory.
    //
    // width and height:
    // The display size after scaling it to fit the stage.
    konvaImage = new Konva.Image({
      x: (stageWidth - displayWidth) / 2,
      y: (stageHeight - displayHeight) / 2,
      image: imageObj,
      width: displayWidth,
      height: displayHeight,
    })

    // Add the page image to the drawing layer.
    layer.add(konvaImage)

    // Reset pan position when a new page is loaded.
    //
    // Why:
    // It is simpler and clearer for the first prototype.
    // Each page starts from a clean centered state.
    stage.position({ x: 0, y: 0 })

    // Reset zoom level when a new page is loaded.
    stage.scale({ x: 1, y: 1 })

    // Draw the updated layer so the image becomes visible.
    layer.draw()
  }

  // Start loading the image from the given URL.
  imageObj.src = imageUrl
}


// onMounted(...):
// Runs once when the component has been inserted into the DOM.
//
// Why this is necessary:
// Konva needs a real HTML container element to exist before creating the stage.
// Therefore, stage creation cannot happen before mount.
onMounted(async () => {
  // Wait until Vue finishes the DOM update cycle.
  // This guarantees that canvasContainer.value points to a real element.
  await nextTick()

  // Initialize the interactive Konva stage and its layer.
  createStage()

  // Load the initial page (the first page of the document) into the viewer.
  loadActivePage(activePage.value)
})


// watch(activePage, ...):
// Reacts whenever the selected page changes.
//
// Why this is needed:
// The sidebar updates `activePage` when a thumbnail is clicked.
// Konva does not automatically know about Vue state changes.
// So a watcher is used as the bridge between Vue state and Konva rendering.
watch(activePage, (newPage) => {
  // Only load the page if the stage and layer have already been created.
  if (stage && layer) {
    loadActivePage(newPage)
  }
})
</script>

<template>
  <div class="viewer-layout">
    <div class="sidebar">
      <!--
        Thumbnail list.

        v-for:
        Iterates through all page URLs of the document.

        :key:
        Gives each item a stable identity for Vue rendering.

        :src:
        Uses the page URL as the image source.

        class="thumb":
        Applies general thumbnail styling.

        :class="{ active: activePage === p }":
        Adds the "active" class to the thumbnail that matches the currently selected page.

        @click="activePage = p":
        When the user clicks a thumbnail, the selected page changes.
        This updates Vue state, and the watcher reloads the page in Konva.
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
        Konva mount container.

        This div is empty from Vue's perspective.
        Vue only provides the DOM element through ref="canvasContainer".

        Konva then uses this container to mount its internal canvas stage.
      -->
      <div ref="canvasContainer" class="konva-container"></div>
    </div>
  </div>
</template>

<style scoped>
/*
  viewer-layout:
  Main horizontal structure of the application.

  display: flex
  Creates two side-by-side areas:
  - sidebar on the left
  - canvas area on the right

  overflow: hidden
  Prevents the internal layout from creating browser-level overflow.
*/
.viewer-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/*
  sidebar:
  Fixed-width left panel used to display page thumbnails.

  min-width is important because it prevents the sidebar from shrinking
  when the canvas area becomes visually demanding.
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
  thumb:
  General thumbnail styling.
*/
.thumb {
  width: 100%;
  margin-bottom: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  box-sizing: border-box;
}

.thumb:hover {
  border-color: #999;
}

.thumb.active {
  border-color: #2c7be5;
}

/*
  canvas-area:
  Right-side workspace that visually contains the Konva canvas.

  overflow: hidden
  Ensures the canvas area does not spill outside its layout box.
*/
.canvas-area {
  flex: 1;
  background: #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/*
  konva-container:
  The DOM element where Konva mounts its stage.

  width: 100% and height: 100%
  make the container fill the available right-side viewer area.

  This is only the HTML container size.
  In the next step, we will make the Konva Stage read this real size too.
*/
.konva-container {
  width: 100%;
  height: 100%;
  background: #cfcfcf;
}
</style>