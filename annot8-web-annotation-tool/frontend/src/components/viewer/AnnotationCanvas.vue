<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Konva from 'konva'
import { hasValidVisiblePointRegionSegments } from '../../utils/pointRegionValidation'
import { useCanvasAutoScroll } from './useCanvasAutoScroll'
import { useCanvasCursor } from './useCanvasCursor'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import { useCanvasPageImage } from './useCanvasPageImage'
import { usePointRegionDrawing } from './usePointRegionDrawing'
import { usePointRegionDragging } from './usePointRegionDragging'
import { useRectangleEditing } from './useRectangleEditing'
import { useRectangleDrawing } from './useRectangleDrawing'
import { useRegionPointEditing } from './useRegionPointEditing'
import { useRegionRenderer } from './useRegionRenderer'
import { useRegionSelection } from './useRegionSelection'
import { useRegionVertexHandles } from './useRegionVertexHandles'
import {
  clampPointToBounds,
  clampRectangleToBounds,
  toVisiblePoints,
} from '../../utils/regionGeometry'
import {
  MIN_VISIBLE_SEGMENT_LENGTH,
  REGION_COLOR,
} from './annotationCanvasConstants'

const props = defineProps({
  selectedPage: {
    type: String,
    default: '',
  },
  pageIndex: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value >= 0,
  },
  regions: {
    type: Array,
    required: true,
  },
  selectedRegionId: {
    type: String,
    default: null,
  },
  activeTool: {
    type: String,
    required: true,
    validator: (value) => ['select', 'rectangle', 'polygon', 'polyline'].includes(value),
  },
  zoomLevel: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value > 0,
  },
  nextRegionId: {
    type: String,
    required: true,
  },
  regionCreationColor: {
    type: String,
    default: REGION_COLOR,
    validator: (value) => /^#[0-9a-fA-F]{6}$/.test(value),
  },
})

const emit = defineEmits([
  'add-region',
  'update-region',
  'select-region',
  'selection-overlap-change',
  'clear-selected-region',
  'delete-selected-region',
  'mouse-position-change',
])

const canvasContainer = ref(null)
const canvasWrapper = ref(null)

const currentPageRegions = computed(() =>
  props.regions.filter((region) => region.pageIndex === props.pageIndex)
)

// The canvas coordinates several composables around one shared Konva stage and layers.
let stage = null
let imageLayer = null
let regionLayer = null
let isVertexHandleDragging = false
// Renderer callbacks are assigned after dependent editing composables have been created.
let renderRegionsImpl = () => {}
let rebuildSpatialIndexImpl = () => {}
let hideActiveEditHandlesImpl = () => {}
let showActiveEditHandlesImpl = () => {}
let disposeRegionRendererImpl = () => {}

function getRegionCreationColor() {
  return /^#[0-9a-fA-F]{6}$/.test(props.regionCreationColor)
    ? props.regionCreationColor.toLowerCase()
    : REGION_COLOR
}

function renderRegions() {
  return renderRegionsImpl()
}

function rebuildSpatialIndex() {
  return rebuildSpatialIndexImpl()
}

function hideActiveEditHandles() {
  return hideActiveEditHandlesImpl()
}

function showActiveEditHandles() {
  return showActiveEditHandlesImpl()
}

function disposeRegionRenderer() {
  return disposeRegionRendererImpl()
}

const {
  getDraggedRegionId,
  setStageCursor,
  resetStageCursor,
  beginRegionDrag,
  endRegionDrag,
  attachRegionCursorHandlers,
  resetStaleRegionCursor,
  clearRegionCursorState,
} = useCanvasCursor({
  getStage: () => stage,
  getActiveTool: () => props.activeTool,
  getCurrentPageRegions: () => currentPageRegions.value,
})

function hasActiveCanvasInteraction() {
  return Boolean(
    hasDraftRectangle() || hasDraftPointRegion() || getDraggedRegionId() || isVertexHandleDragging
  )
}

function emitSelectionContext({ regionId, overlappingRegionCount = 0 }) {
  emit('select-region', regionId)
  emit('selection-overlap-change', overlappingRegionCount)
}

function emitDirectRegionSelection(regionId) {
  resetSelectionCycle()
  emitSelectionContext({ regionId, overlappingRegionCount: 0 })
}

function emitSelectionClear() {
  emit('selection-overlap-change', 0)
  emit('clear-selected-region')
}

// Composables receive getters so they always read current props instead of captured values.
const {
  loadSelectedPage,
  updateZoom,
  getRegionScale,
  getDocumentBounds,
  getVisibleBounds,
  getDocumentCoordinatesFromPointer,
  hasPageImage,
  disposePageImage,
} = useCanvasPageImage({
  getStage: () => stage,
  getImageLayer: () => imageLayer,
  canvasWrapper,
  getZoomLevel: () => props.zoomLevel,
  renderRegions: () => renderRegions(),
  onPageImageLoaded: () => rebuildSpatialIndex(),
})

const {
  beginRectangleRegion,
  updateDraftRectangleRegion,
  commitDraftRectangleRegion,
  cancelDraftRectangleRegion,
  hasDraftRectangle,
  disposeRectangleDrawing,
} = useRectangleDrawing({
  getStage: () => stage,
  getRegionLayer: () => regionLayer,
  hasPageImage,
  getActiveTool: () => props.activeTool,
  getPageIndex: () => props.pageIndex,
  getNextRegionId: () => props.nextRegionId,
  getZoomLevel: () => props.zoomLevel,
  getRegionCreationColor,
  getRegionScale,
  getDocumentBounds,
  getClampedDocumentPointer,
  isPointerInsideVisibleDocument,
  clampRectangleToBounds,
  clearSelectedRegion: emitSelectionClear,
  addRegion: (region) => emit('add-region', region),
  renderRegions,
})

const {
  beginPointRegionDrag,
  addPointRegionDragReleasePoint,
  handlePointRegionClick,
  updateDraftPointPreview,
  commitDraftPointRegion,
  cancelDraftPointRegion,
  hasDraftPointRegion,
  disposePointRegionDrawing,
} = usePointRegionDrawing({
  getStage: () => stage,
  getRegionLayer: () => regionLayer,
  hasPageImage,
  getActiveTool: () => props.activeTool,
  getPageIndex: () => props.pageIndex,
  getNextRegionId: () => props.nextRegionId,
  getZoomLevel: () => props.zoomLevel,
  getRegionCreationColor,
  getRegionScale,
  getDocumentBounds,
  getClampedDocumentPointer,
  clearSelectedRegion: emitSelectionClear,
  addRegion: (region) => emit('add-region', region),
  renderRegions,
})

const { autoScrollCanvasWrapper } = useCanvasAutoScroll({
  canvasWrapper,
  isInteractionActive: hasActiveCanvasInteraction,
})

const {
  clearSelectedPoint,
  deleteSelectedPoint,
  insertPointIntoSegment,
  insertPolylineEndpoint,
  updatePolylineEndpointPreview,
  clearPolylineEndpointPreview,
  getSelectedPoint,
  setSelectedPoint,
  prepareRegionClick,
  handleRegionClickSuppression,
  handleRegionDoubleClickSuppression,
  resetPointEditing,
  disposePointEditing,
} = useRegionPointEditing({
  getActiveTool: () => props.activeTool,
  getSelectedRegionId: () => props.selectedRegionId,
  getRegions: () => props.regions,
  getStage: () => stage,
  getRegionLayer: () => regionLayer,
  getRegionScale,
  getZoomLevel: () => props.zoomLevel,
  getDocumentBounds,
  getDocumentCoordinatesFromPointer,
  getClampedDocumentPointer,
  isPointerInsideVisibleDocument,
  isVertexHandleDragging: () => isVertexHandleDragging,
  hasValidPointRegionSegments,
  deleteSelectedRegion: () => emit('delete-selected-region'),
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
})

const {
  rebuildSpatialIndex: rebuildRegionSelectionIndex,
  clearSpatialIndex,
  resetSelectionCycle,
  resetPointerInteraction,
  beginPointerInteraction,
  updatePointerInteraction,
  markEditInteractionStarted,
  markEditInteractionFinished,
  selectFromPointer,
  disposeRegionSelection,
} = useRegionSelection({
  getStage: () => stage,
  getCurrentPageRegions: () => currentPageRegions.value,
  getDocumentBounds,
  getRegionScale,
  getZoomLevel: () => props.zoomLevel,
  getDocumentCoordinatesFromPointer,
  clearSelectedPoint,
  insertPolylineEndpoint,
  selectRegion: emitSelectionContext,
  clearSelectedRegion: emitSelectionClear,
})

rebuildSpatialIndexImpl = rebuildRegionSelectionIndex

const { attachRectangleEditing, getRectangleDragBoundPosition } = useRectangleEditing({
  getZoomLevel: () => props.zoomLevel,
  getRegionLayer: () => regionLayer,
  getVisibleBounds,
  getDocumentBounds,
  clampRectangleToBounds,
  autoScrollCanvasWrapper,
  beginRegionDrag,
  endRegionDrag,
  hideActiveEditHandles,
  showActiveEditHandles,
  getSelectedRegionId: () => props.selectedRegionId,
  markEditInteractionStarted,
  markEditInteractionFinished,
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
})

const { getPointRegionDragBoundPosition, attachPointRegionDragging } = usePointRegionDragging({
  getZoomLevel: () => props.zoomLevel,
  getRegionLayer: () => regionLayer,
  getVisibleBounds,
  getDocumentBounds,
  autoScrollCanvasWrapper,
  beginRegionDrag,
  endRegionDrag,
  hideActiveEditHandles,
  showActiveEditHandles,
  getSelectedRegionId: () => props.selectedRegionId,
  preparePointRegionDrag: prepareRegionClick,
  markEditInteractionStarted,
  markEditInteractionFinished,
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
})

const { createRegionVertexHandles } = useRegionVertexHandles({
  getZoomLevel: () => props.zoomLevel,
  getActiveTool: () => props.activeTool,
  getRegionScale,
  getVisibleBounds,
  getDocumentBounds,
  getRegionLayer: () => regionLayer,
  getSelectedPointRegionPoint: getSelectedPoint,
  setSelectedPointRegionPoint: setSelectedPoint,
  setIsVertexHandleDragging: (isDragging) => {
    isVertexHandleDragging = isDragging
  },
  clearPolylineEndpointExtensionPreview: clearPolylineEndpointPreview,
  autoScrollCanvasWrapper,
  setStageCursor,
  resetStageCursor,
  hasValidPointRegionSegments,
  selectRegion: emitDirectRegionSelection,
  markEditInteractionStarted,
  markEditInteractionFinished,
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
  renderRegions,
})

const regionRenderer = useRegionRenderer({
  getStage: () => stage,
  getRegionLayer: () => regionLayer,
  hasPageImage,
  getCurrentPageRegions: () => currentPageRegions.value,
  getActiveTool: () => props.activeTool,
  getSelectedRegionId: () => props.selectedRegionId,
  getZoomLevel: () => props.zoomLevel,
  getRegionScale,
  getVisibleBounds,
  clearPolylineEndpointPreview,
  clearSelectedPoint,
  attachRegionCursorHandlers,
  handleRegionClickSuppression,
  handleRegionDoubleClickSuppression,
  insertPointIntoSegment,
  attachRectangleEditing,
  getRectangleDragBoundPosition,
  attachPointRegionDragging,
  getPointRegionDragBoundPosition,
  createRegionVertexHandles,
  handleRegionBodyClick: (event, fallbackRegionId) => {
    if (event) {
      event.cancelBubble = true
    }

    selectFromPointer(stage?.getPointerPosition?.(), fallbackRegionId)
  },
  selectRegionDirect: emitDirectRegionSelection,
})

renderRegionsImpl = regionRenderer.renderRegions
hideActiveEditHandlesImpl = regionRenderer.hideActiveEditHandles
showActiveEditHandlesImpl = regionRenderer.showActiveEditHandles
disposeRegionRendererImpl = regionRenderer.disposeRegionRenderer

function getClampedDocumentPointer(pointerPosition = stage?.getPointerPosition()) {
  const documentPoint = getDocumentCoordinatesFromPointer(pointerPosition)

  return documentPoint ? clampPointToBounds(documentPoint, getDocumentBounds()) : null
}

function isPointerInsideVisibleDocument(pointerPosition) {
  if (!pointerPosition || !hasPageImage()) return false

  const bounds = getVisibleBounds()

  return (
    pointerPosition.x >= 0 &&
    pointerPosition.x <= bounds.width &&
    pointerPosition.y >= 0 &&
    pointerPosition.y <= bounds.height
  )
}

function isCreationTool() {
  return ['rectangle', 'polygon', 'polyline'].includes(props.activeTool)
}

function updateCreationToolCursor(pointerPosition = stage?.getPointerPosition()) {
  if (!isCreationTool()) return

  if (isPointerInsideVisibleDocument(pointerPosition)) {
    setStageCursor('crosshair')
    return
  }

  resetStageCursor()
}

function hasValidPointRegionSegments(points, type) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(points, scaleX, scaleY, props.zoomLevel)

  return hasValidVisiblePointRegionSegments(visiblePoints, type, MIN_VISIBLE_SEGMENT_LENGTH)
}

function handleStageMouseDown(event) {
  beginPointerInteraction()
  beginRectangleRegion()
  beginPointRegionDrag(event)
}

function handleStageMouseUp() {
  commitDraftRectangleRegion()
  addPointRegionDragReleasePoint()
}

function handleStageClick(event) {
  if (event?.evt?.detail > 1) return
  if (event?.cancelBubble) return

  handlePointRegionClick()

  if (props.activeTool !== 'select') return

  selectFromPointer()
}

function resetTransientInteractionState() {
  // Drafts, handles, and cursor state belong to a page/tool interaction, not the next page.
  cancelDraftRectangleRegion()
  cancelDraftPointRegion(false)
  resetPointEditing()
  clearRegionCursorState()
  resetSelectionCycle()
  resetPointerInteraction()
  emit('selection-overlap-change', 0)
  resetStageCursor()

  isVertexHandleDragging = false
}

function handleMouseMove(event) {
  resetStaleRegionCursor(event)
  updatePointerInteraction()
  autoScrollCanvasWrapper(event)

  const pos = stage.getPointerPosition()
  updateCreationToolCursor(pos)

  const coordinates = getDocumentCoordinatesFromPointer(pos)

  if (!coordinates) {
    clearPolylineEndpointPreview()
    return
  }

  emit('mouse-position-change', coordinates)

  if (hasDraftRectangle()) {
    updateDraftRectangleRegion()
  } else if (hasDraftPointRegion()) {
    updateDraftPointPreview()
  } else {
    updatePolylineEndpointPreview(pos)
  }
}

function handleMouseLeave() {
  resetStageCursor()
  clearPolylineEndpointPreview()
  emit('mouse-position-change', null)
}

useCanvasKeyboardShortcuts({
  getActiveTool: () => props.activeTool,
  commitDraftPointRegion,
  cancelDraftPointRegion,
  cancelDraftRectangleRegion,
  clearSelectedPointRegionPoint: clearSelectedPoint,
  deleteSelectedPointRegionPoint: deleteSelectedPoint,
  clearSelectedRegion: () => {
    resetSelectionCycle()
    emitSelectionClear()
  },
  deleteSelectedRegion: () => emit('delete-selected-region'),
})

onMounted(() => {
  // Konva needs the mounted container before the stage and its image/region layers can exist.
  stage = new Konva.Stage({
    container: canvasContainer.value,
    width: 1000,
    height: 700,
  })

  imageLayer = new Konva.Layer()
  regionLayer = new Konva.Layer()
  stage.add(imageLayer)
  stage.add(regionLayer)

  stage.on('mousemove', handleMouseMove)
  stage.on('mouseleave', handleMouseLeave)
  stage.on('mousedown', handleStageMouseDown)
  stage.on('click', handleStageClick)
  stage.on('mouseup', handleStageMouseUp)
  stage.on('dblclick', commitDraftPointRegion)

  loadSelectedPage(props.selectedPage)
})

watch(() => props.selectedPage, (newPage) => {
  clearSpatialIndex()
  loadSelectedPage(newPage)
})

watch(() => props.zoomLevel, () => {
  updateZoom()
  resetSelectionCycle()
  resetPointerInteraction()
})

watch(() => props.pageIndex, () => {
  resetTransientInteractionState()
})

watch(() => props.selectedRegionId, (newSelectedRegionId) => {
  if (getSelectedPoint()?.regionId !== newSelectedRegionId) {
    clearSelectedPoint()
  } else {
    clearPolylineEndpointPreview()
  }
})

watch(
  () => [props.regions, props.selectedRegionId, props.activeTool, props.pageIndex],
  () => {
    // Saved regions are reconstructed because Konva nodes carry event listeners tied to current state.
    renderRegions()
  },
  { deep: true }
)

watch(
  () => currentPageRegions.value.map((region) => ({
    id: region.id,
    type: region.type,
    pageIndex: region.pageIndex,
    left: region.left,
    top: region.top,
    right: region.right,
    bottom: region.bottom,
    points: Array.isArray(region.points)
      ? region.points.map((point) => [point.x, point.y])
      : null,
  })),
  () => {
    rebuildSpatialIndex()
  },
  { deep: true }
)

watch(() => props.activeTool, (newTool, previousTool) => {
  if (newTool !== previousTool) {
    resetStageCursor()
    resetSelectionCycle()
    resetPointerInteraction()
  }

  if (['polygon', 'polyline'].includes(previousTool) && previousTool !== newTool) {
    cancelDraftPointRegion(false)
  }

  if (previousTool === 'select' && newTool !== previousTool) {
    clearRegionCursorState()
    isVertexHandleDragging = false
    clearSelectedPoint()
    emit('selection-overlap-change', 0)
    resetStageCursor()
  }
})

onBeforeUnmount(() => {
  resetStageCursor()

  // Destroy the stage first so its DOM listeners and child nodes cannot outlive the component.
  if (stage) {
    stage.destroy()
    stage = null
  }

  imageLayer = null
  regionLayer = null
  disposePageImage()
  disposeRectangleDrawing()
  disposePointRegionDrawing()
  disposePointEditing()
  disposeRegionRenderer()
  disposeRegionSelection()
  clearRegionCursorState()
  isVertexHandleDragging = false
})

defineExpose({
  // Sidebar layout changes need the parent to recompute the fitted canvas dimensions.
  updateZoom,
})
</script>

<template>
  <div
    ref="canvasWrapper"
    class="canvas-wrapper flex-grow-1 overflow-auto p-4"
    :class="`canvas-wrapper--${activeTool}`"
  >
    <div ref="canvasContainer" class="konva-container shadow-sm"></div>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  background: #dee2e6;
  min-width: 0;
  min-height: 0;
}

.canvas-wrapper--select {
  cursor: default;
}

.konva-container {
  display: inline-block;
  background: white;
  border: 1px solid #adb5bd;
}
</style>
