<script setup>
import { computed, nextTick, ref, onBeforeUnmount, onMounted } from 'vue'
import AnnotationCanvas from '../components/viewer/AnnotationCanvas.vue'
import PageSidebar from '../components/viewer/PageSidebar.vue'
import ViewerStatusBar from '../components/viewer/ViewerStatusBar.vue'
import ViewerToolbar from '../components/viewer/ViewerToolbar.vue'
import { REGION_COLOR } from '../components/viewer/annotationCanvasConstants'
import { createProjectDocumentModel } from '../models/ProjectDocumentModel'
import { fetchProjectDocument } from '../services/documentApi'
import {
  getNextZoom,
  getPreviousZoom,
  getZoomPercentage,
} from '../utils/viewerMath'

const pages = ref([])
// This is the runtime source of truth; the document model only serializes this array.
const regions = ref([])
const selectedIndex = ref(0)
let projectDocument = null

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const ZOOM_STEP = 0.25
const DEFAULT_ZOOM = 1
const SAVE_DELAY_MS = 500

const zoomLevel = ref(DEFAULT_ZOOM)
const activeTool = ref('select')
const selectedRegionId = ref(null)
const sidebarCollapsed = ref(false)
const annotationCanvas = ref(null)
const regionSequence = ref(0)
const regionCreationColor = ref(REGION_COLOR)

const selectedPage = computed(() => pages.value[selectedIndex.value])
const zoomPercentage = computed(() => getZoomPercentage(zoomLevel.value))
const currentPageRegions = computed(() =>
  regions.value.filter((region) => region.pageIndex === selectedIndex.value)
)
const currentPageRegionCount = computed(() => currentPageRegions.value.length)
const selectedRegion = computed(
  () => regions.value.find((region) => region.id === selectedRegionId.value) ?? null
)
const toolbarColor = computed(() => {
  if (!selectedRegion.value) return regionCreationColor.value

  return /^#[0-9a-fA-F]{6}$/.test(selectedRegion.value.color)
    ? selectedRegion.value.color
    : REGION_COLOR
})
const nextRegionId = computed(() => `region-${regionSequence.value + 1}`)

const mousePos = ref(null)
const saveStatus = ref('saved')
let saveTimeout = null

function resetZoom() {
  zoomLevel.value = DEFAULT_ZOOM
}

function navigateToPage(index) {
  if (!Number.isInteger(index) || index < 0 || index >= pages.value.length) return
  if (index === selectedIndex.value) return

  // Selection, pointer coordinates, and zoom describe the previous page and must not carry over.
  selectedIndex.value = index
  selectedRegionId.value = null
  mousePos.value = null
  resetZoom()
}

function goToPreviousPage() {
  navigateToPage(selectedIndex.value - 1)
}

function goToNextPage() {
  navigateToPage(selectedIndex.value + 1)
}

function selectPage(index) {
  navigateToPage(index)
}

async function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  await nextTick()
  annotationCanvas.value?.updateZoom()
}

function setActiveTool(tool) {
  activeTool.value = tool

  if (tool !== 'select') {
    selectedRegionId.value = null
  }
}

function deleteSelectedRegion() {
  if (!selectedRegionId.value) return

  regions.value = regions.value.filter((region) => region.id !== selectedRegionId.value)
  persistRegions()
  selectedRegionId.value = null
}

function clearSelectedRegion() {
  if (!selectedRegionId.value) return

  selectedRegionId.value = null
}

function persistRegions() {
  if (!projectDocument) return

  saveStatus.value = 'saving'

  // Keep a single pending write while a burst of canvas updates is still in progress.
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(() => {
    try {
      if (!projectDocument) return

      projectDocument.save(regions.value)
      saveStatus.value = 'saved'
    } catch (error) {
      saveStatus.value = 'error'
      console.error(error)
    } finally {
      saveTimeout = null
    }
  }, SAVE_DELAY_MS)
}

function updateRegionSequence() {
  // Continue restored numeric IDs so new regions do not collide with localStorage data.
  regionSequence.value = regions.value.reduce((highestId, region) => {
    const match = String(region.id).match(/^region-(\d+)$/)
    return match ? Math.max(highestId, Number(match[1])) : highestId
  }, 0)
}

function zoomIn() {
  if (zoomLevel.value < MAX_ZOOM) {
    zoomLevel.value = getNextZoom(zoomLevel.value, ZOOM_STEP, MAX_ZOOM)
  }
}

function zoomOut() {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = getPreviousZoom(zoomLevel.value, ZOOM_STEP, MIN_ZOOM)
  }
}

function setZoomLevel(value) {
  const nextZoomLevel = Number(value)

  if (!Number.isFinite(nextZoomLevel)) return

  zoomLevel.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomLevel))
}

function addRegion(region) {
  regionSequence.value += 1
  regions.value.push(region)
  persistRegions()
  activeTool.value = 'select'
  selectedRegionId.value = null
}

function updateRegion({ id, changes }) {
  const region = regions.value.find((candidate) => candidate.id === id)
  if (!region) return

  Object.assign(region, changes)
  persistRegions()
}

function updateToolbarColor(color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return

  const normalizedColor = color.toLowerCase()

  if (selectedRegion.value) {
    updateRegion({
      id: selectedRegion.value.id,
      changes: {
        color: normalizedColor,
      },
    })
    return
  }

  regionCreationColor.value = normalizedColor
}

function setMousePosition(position) {
  mousePos.value = position
}

onMounted(() => {
  fetchProjectDocument()
    .then((document) => {
      projectDocument = createProjectDocumentModel(document)
      pages.value = projectDocument.pages
      regions.value = projectDocument.loadRegions()
      updateRegionSequence()
    })
    .catch((error) => {
      console.error(error)
    })
})

onBeforeUnmount(() => {
  // Vue cleanup normally flushes the debounce; abrupt browser shutdown can still bypass it.
  if (saveTimeout === null || !projectDocument) return

  clearTimeout(saveTimeout)
  saveTimeout = null

  try {
    projectDocument.save(regions.value)
    saveStatus.value = 'saved'
  } catch (error) {
    saveStatus.value = 'error'
    console.error(error)
  }
})
</script>

<template>
  <div class="layout d-flex vh-100 overflow-hidden bg-body-tertiary">
    <PageSidebar
      :pages="pages"
      :selected-index="selectedIndex"
      :collapsed="sidebarCollapsed"
      @select-page="selectPage"
      @toggle-sidebar="toggleSidebar"
    />

    <main class="viewer d-flex flex-column flex-grow-1 overflow-hidden">
      <ViewerToolbar
        :selected-index="selectedIndex"
        :total-pages="pages.length"
        :active-tool="activeTool"
        :region-count="currentPageRegionCount"
        :has-selected-region="Boolean(selectedRegionId)"
        :toolbar-color="toolbarColor"
        @previous-page="goToPreviousPage"
        @next-page="goToNextPage"
        @set-active-tool="setActiveTool"
        @update-region-color="updateToolbarColor"
        @delete-selected-region="deleteSelectedRegion"
      />

      <AnnotationCanvas
        ref="annotationCanvas"
        :selected-page="selectedPage"
        :page-index="selectedIndex"
        :regions="regions"
        :selected-region-id="selectedRegionId"
        :active-tool="activeTool"
        :zoom-level="zoomLevel"
        :next-region-id="nextRegionId"
        :region-creation-color="regionCreationColor"
        @add-region="addRegion"
        @update-region="updateRegion"
        @select-region="selectedRegionId = $event"
        @clear-selected-region="clearSelectedRegion"
        @delete-selected-region="deleteSelectedRegion"
        @mouse-position-change="setMousePosition"
      />
      <ViewerStatusBar
        :selected-index="selectedIndex"
        :total-pages="pages.length"
        :zoom-percentage="zoomPercentage"
        :active-tool="activeTool"
        :selected-region="selectedRegion"
        :current-page-region-count="currentPageRegionCount"
        :mouse-pos="mousePos"
        :save-status="saveStatus"
        :zoom-level="zoomLevel"
        :min-zoom-level="MIN_ZOOM"
        :max-zoom-level="MAX_ZOOM"
        :zoom-step="ZOOM_STEP"
        :default-zoom-level="DEFAULT_ZOOM"
        @zoom-out="zoomOut"
        @zoom-in="zoomIn"
        @update-zoom-level="setZoomLevel"
      />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-width: 0;
  padding-bottom: 24px;
}

.viewer {
  min-width: 0;
  min-height: 0;
}
</style>
