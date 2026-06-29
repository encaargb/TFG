<script setup>
import { computed, nextTick, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { BModal } from 'bootstrap-vue-next'
import AnnotationCanvas from '../components/viewer/AnnotationCanvas.vue'
import AnnotationSidebar from '../components/viewer/AnnotationSidebar.vue'
import PageSidebar from '../components/viewer/PageSidebar.vue'
import ViewerStatusBar from '../components/viewer/ViewerStatusBar.vue'
import ViewerToolbar from '../components/viewer/ViewerToolbar.vue'
import { isSameAnnotationAssignment } from '../components/viewer/annotationAssignmentIdentity'
import { REGION_COLOR } from '../components/viewer/annotationCanvasConstants'
import { createProjectDocumentModel } from '../models/ProjectDocumentModel'
import { fetchProjectDocument } from '../services/documentApi'
import {
  getNextZoom,
  getPreviousZoom,
  getZoomPercentage,
} from '../utils/viewerMath'
import {
  getNextRegionZIndex,
  normalizeRegionZIndexes,
} from '../utils/regionZIndex'

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
const overlappingRegionCount = ref(0)
const sidebarCollapsed = ref(false)
const annotationCanvas = ref(null)
const regionSequence = ref(0)
const regionCreationColor = ref(REGION_COLOR)
const schemaPublications = ref([])
const selectedAnnotation = ref(null)
const pendingAnnotationDeletion = ref(null)
const showDeleteAnnotationModal = ref(false)
const annotationDeletionActive = computed(
  () => Boolean(selectedAnnotation.value) || showDeleteAnnotationModal.value
)

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
  overlappingRegionCount.value = 0
  mousePos.value = null
  clearSelectedAnnotation()
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
  clearSelectedAnnotation()

  if (tool !== 'select') {
    selectedRegionId.value = null
    overlappingRegionCount.value = 0
  }
}

function deleteSelectedRegion() {
  if (!selectedRegionId.value) return

  regions.value = regions.value.filter((region) => region.id !== selectedRegionId.value)
  persistRegions()
  selectedRegionId.value = null
  overlappingRegionCount.value = 0
}

function clearSelectedRegion() {
  selectedRegionId.value = null
  overlappingRegionCount.value = 0
  clearSelectedAnnotation()
}

function selectRegion(regionId) {
  clearSelectedAnnotation()
  selectedRegionId.value = regionId
  overlappingRegionCount.value = 0
}

function setOverlappingRegionCount(count) {
  overlappingRegionCount.value = Math.max(0, Number.isFinite(count) ? count : 0)
}

function hasGeometryChange(changes) {
  return ['left', 'top', 'right', 'bottom', 'points'].some((key) =>
    Object.prototype.hasOwnProperty.call(changes, key)
  )
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
  const regionWithZIndex = {
    ...region,
    zIndex: getNextRegionZIndex(regions.value, region.pageIndex),
  }

  regionSequence.value += 1
  regions.value.push(regionWithZIndex)
  persistRegions()
  selectedRegionId.value = null
  overlappingRegionCount.value = 0
}

function updateRegion({ id, changes }) {
  const region = regions.value.find((candidate) => candidate.id === id)
  if (!region) return

  Object.assign(region, changes)

  if (hasGeometryChange(changes)) {
    overlappingRegionCount.value = 0
  }

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

function clearSelectedAnnotation() {
  selectedAnnotation.value = null
}

function selectAnnotation(annotation) {
  selectedAnnotation.value = annotation
}

function closeDeleteAnnotationModal() {
  showDeleteAnnotationModal.value = false
  pendingAnnotationDeletion.value = null
}

function requestDeleteAnnotation(annotation = selectedAnnotation.value) {
  if (!annotation) return

  selectedAnnotation.value = annotation
  pendingAnnotationDeletion.value = annotation
  showDeleteAnnotationModal.value = true
}

function confirmDeleteAnnotation() {
  const annotation = pendingAnnotationDeletion.value

  if (!annotation) return

  const region = regions.value.find((candidate) => candidate.id === annotation.regionId)

  if (!region) {
    selectedAnnotation.value = null
    closeDeleteAnnotationModal()
    return
  }

  updateRegion({
    id: region.id,
    changes: {
      annotations: region.annotations.filter(
        (assignment) => !isSameAnnotationAssignment(assignment, annotation)
      ),
    },
  })

  selectedAnnotation.value = null
  closeDeleteAnnotationModal()
}

function handleAnnotationDeletionKeydown(event) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return

  if (!annotationDeletionActive.value) return

  event.preventDefault()

  if (showDeleteAnnotationModal.value || !selectedAnnotation.value) return

  requestDeleteAnnotation(selectedAnnotation.value)
}

watch(selectedRegionId, () => {
  clearSelectedAnnotation()
  closeDeleteAnnotationModal()
})

watch(showDeleteAnnotationModal, (isOpen) => {
  if (!isOpen) {
    pendingAnnotationDeletion.value = null
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleAnnotationDeletionKeydown)

  fetchProjectDocument()
    .then((document) => {
      projectDocument = createProjectDocumentModel(document)
      pages.value = projectDocument.pages
      schemaPublications.value = projectDocument.schemaPublications
      regions.value = normalizeRegionZIndexes(projectDocument.loadRegions())
      overlappingRegionCount.value = 0
      updateRegionSequence()
    })
    .catch((error) => {
      console.error(error)
    })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleAnnotationDeletionKeydown)

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
        :schema-publications="schemaPublications"
        :annotation-deletion-active="annotationDeletionActive"
        @add-region="addRegion"
        @update-region="updateRegion"
        @select-region="selectRegion"
        @selection-overlap-change="setOverlappingRegionCount"
        @clear-selected-region="clearSelectedRegion"
        @clear-selected-annotation="clearSelectedAnnotation"
        @delete-selected-region="deleteSelectedRegion"
        @mouse-position-change="setMousePosition"
      />
      <ViewerStatusBar
        :selected-index="selectedIndex"
        :total-pages="pages.length"
        :zoom-percentage="zoomPercentage"
        :active-tool="activeTool"
        :selected-region="selectedRegion"
        :overlapping-region-count="overlappingRegionCount"
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

    <AnnotationSidebar
      :selected-region="selectedRegion"
      :schema-publications="schemaPublications"
      :selected-annotation="selectedAnnotation"
      @select-annotation="selectAnnotation"
      @request-delete-annotation="requestDeleteAnnotation"
    />

    <BModal
      v-model="showDeleteAnnotationModal"
      title="Delete annotation"
      centered
    >
      <p class="mb-0">
        Are you sure you want to delete the annotation “{{ pendingAnnotationDeletion?.annotationName }}”?
      </p>

      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="closeDeleteAnnotationModal"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-danger"
          @click="confirmDeleteAnnotation"
        >
          Delete
        </button>
      </template>
    </BModal>
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
