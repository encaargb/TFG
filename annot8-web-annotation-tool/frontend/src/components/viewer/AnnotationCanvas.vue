<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ContextMenu from '@imengyu/vue3-context-menu'
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
import { hasAnnotationAssignment } from './annotationAssignmentIdentity'
import { buildRegionContextMenuItems } from './annotationContextMenuItems'

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
  schemaPublications: {
    type: Array,
    default: () => [],
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
const emptyContextMenu = {
  visible: false,
  x: 0,
  y: 0,
  region: null,
  visiblePoints: null,
  isPolygon: false,
  pointerPosition: null,
  segmentIndex: -1,
  pointIndex: null,
  canAddPoint: false,
  canDeletePoint: false,
}
const contextMenu = ref({ ...emptyContextMenu })
const currentPageRegions = computed(() =>
  props.regions.filter((region) => region.pageIndex === props.pageIndex)
)

// The canvas coordinates several composables around one shared Konva stage and layers.
let stage = null
let imageLayer = null
let regionLayer = null
let isVertexHandleDragging = false
let isRegionEditInteractionActive = false
let regionRenderPending = false
// Renderer callbacks are assigned after dependent editing composables have been created.
let renderRegionsImpl = () => {}
let rebuildSpatialIndexImpl = () => {}
let showActiveEditHandlesImpl = () => {}
let clearSelectionControlsImpl = () => {}
let updateRegionSelectionAppearanceImpl = () => {}
let disposeRegionRendererImpl = () => {}

function getRegionCreationColor() {
  return /^#[0-9a-fA-F]{6}$/.test(props.regionCreationColor)
    ? props.regionCreationColor.toLowerCase()
    : REGION_COLOR
}

function renderRegions() {
  return renderRegionsImpl()
}

function isRegionInteractionActive() {
  return Boolean(isRegionEditInteractionActive || isVertexHandleDragging || getDraggedRegionId())
}

function requestRegionRender() {
  if (isRegionInteractionActive()) {
    regionRenderPending = true
    return
  }

  regionRenderPending = false
  renderRegions()
}

function clearPendingRegionRender() {
  regionRenderPending = false
}

function flushPendingRegionRender() {
  if (!regionRenderPending || !stage || !regionLayer) return

  regionRenderPending = false
  renderRegions()
}

function rebuildSpatialIndex() {
  return rebuildSpatialIndexImpl()
}

function showActiveEditHandles() {
  return showActiveEditHandlesImpl()
}

function clearSelectionControls() {
  return clearSelectionControlsImpl()
}

function updateRegionSelectionAppearance(previousRegionId, selectedRegionId) {
  return updateRegionSelectionAppearanceImpl(previousRegionId, selectedRegionId)
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
    hasDraftRectangle() ||
      hasDraftPointRegion() ||
      getDraggedRegionId() ||
      isVertexHandleDragging ||
      isRegionEditInteractionActive
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
  renderRegions: () => requestRegionRender(),
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
  canDeleteSelectedPoint,
  deleteSelectedPoint,
  getInsertPointSegmentIndex,
  insertPointIntoSegment,
  insertPolylineEndpoint,
  updatePolylineEndpointPreview,
  clearPolylineEndpointPreview,
  getSelectedPoint,
  setSelectedPoint,
  prepareRegionClick,
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

function selectRegionForEditing(regionId) {
  resetSelectionCycle()
  clearSelectedPoint()
  emitSelectionContext({ regionId, overlappingRegionCount: 0 })
}

function closeContextMenu() {
  contextMenu.value = { ...emptyContextMenu }
  ContextMenu.closeContextMenu()
}

function preventNativeContextMenu(event) {
  if (event) {
    event.cancelBubble = true
  }

  event?.evt?.preventDefault?.()
}

function openContextMenu(event, menuState) {
  preventNativeContextMenu(event)
  const nativeEvent = event?.evt ?? event
  const x = nativeEvent?.clientX ?? 0
  const y = nativeEvent?.clientY ?? 0

  contextMenu.value = {
    ...emptyContextMenu,
    ...menuState,
    visible: true,
    x,
    y,
  }

  ContextMenu.showContextMenu({
    x,
    y,
    theme: 'annot8',
    minWidth: 180,
    maxWidth: 360,
    maxHeight: 360,
    adjustPosition: true,
    items: buildRegionContextMenuItems({
      menu: contextMenu.value,
      schemaPublications: props.schemaPublications,
      onAddPoint: addContextMenuPoint,
      onDeletePoint: deleteContextMenuPoint,
      onDeleteRegion: deleteContextMenuRegion,
      onAddAnnotation: addContextMenuAnnotation,
    }),
    onClose: () => {
      contextMenu.value = { ...emptyContextMenu }
    },
  })
}

function handleRegionContextMenu({ event, region, visiblePoints, isPolygon }) {
  if (props.activeTool !== 'select') return

  const pointerPosition = stage?.getPointerPosition?.()
  if (!pointerPosition) return

  const isPointRegion = ['polygon', 'polyline'].includes(region.type)
  const segmentIndex = isPointRegion
    ? getInsertPointSegmentIndex({ visiblePoints, isPolygon, pointerPosition })
    : -1

  clearSelectedPoint()
  selectRegionForEditing(region.id)
  openContextMenu(event, {
    region,
    visiblePoints,
    isPolygon,
    pointerPosition: { ...pointerPosition },
    segmentIndex,
    canAddPoint: segmentIndex !== -1,
  })
}

function handleVertexContextMenu({ event, region, pointIndex }) {
  if (props.activeTool !== 'select') return

  selectRegionForEditing(region.id)
  setSelectedPoint({ regionId: region.id, pointIndex })
  openContextMenu(event, {
    region,
    pointIndex,
    pointerPosition: stage?.getPointerPosition?.() ?? null,
    canDeletePoint: canDeleteSelectedPoint(),
  })
}

function addContextMenuPoint() {
  const menu = contextMenu.value

  if (!menu.visible || !menu.canAddPoint) return

  insertPointIntoSegment({
    region: menu.region,
    visiblePoints: menu.visiblePoints,
    isPolygon: menu.isPolygon,
    pointerPosition: menu.pointerPosition,
    segmentIndex: menu.segmentIndex,
  })
  closeContextMenu()
}

function deleteContextMenuPoint() {
  if (!contextMenu.value.visible || !contextMenu.value.canDeletePoint) return

  if (canDeleteSelectedPoint()) {
    deleteSelectedPoint()
  }

  closeContextMenu()
}

function deleteContextMenuRegion() {
  if (!contextMenu.value.visible) return

  emit('delete-selected-region')
  closeContextMenu()
}

function addContextMenuAnnotation({ schemaPublication, annotation }) {
  const menu = contextMenu.value

  if (!menu.visible || !menu.region || annotation.type !== 'ANNOTATION') return
  if (
    hasAnnotationAssignment(menu.region.annotations, {
      schemaPublicationId: schemaPublication.id,
      annotationId: annotation.id,
    })
  ) {
    return
  }

  emit('update-region', {
    id: menu.region.id,
    changes: {
      annotations: [
        ...menu.region.annotations,
        {
          schemaPublicationId: schemaPublication.id,
          annotationId: annotation.id,
          taxonomyPath: annotation['taxonomy-path'],
        },
      ],
    },
  })
  closeContextMenu()
}

const {
  rebuildSpatialIndex: rebuildRegionSelectionIndex,
  clearSpatialIndex,
  resetSelectionCycle,
  resetPointerInteraction,
  beginPointerInteraction,
  updatePointerInteraction,
  markEditInteractionStarted: markSelectionEditInteractionStarted,
  markEditInteractionFinished: markSelectionEditInteractionFinished,
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

function markRegionEditInteractionStarted() {
  isRegionEditInteractionActive = true
  markSelectionEditInteractionStarted()
}

function markRegionEditInteractionFinished({ flushRender = true } = {}) {
  markSelectionEditInteractionFinished()
  isRegionEditInteractionActive = false

  if (flushRender) {
    flushPendingRegionRender()
  }
}

function beginRegionBodyEdit(regionId) {
  const previousRegionId = props.selectedRegionId

  markRegionEditInteractionStarted()
  clearSelectionControls()
  updateRegionSelectionAppearance(previousRegionId, regionId)
  selectRegionForEditing(regionId)
}

const { attachRectangleEditing, getRectangleDragBoundPosition } = useRectangleEditing({
  getZoomLevel: () => props.zoomLevel,
  getRegionLayer: () => regionLayer,
  getVisibleBounds,
  getDocumentBounds,
  clampRectangleToBounds,
  autoScrollCanvasWrapper,
  beginRegionDrag,
  endRegionDrag,
  showActiveEditHandles,
  getSelectedRegionId: () => props.selectedRegionId,
  beginRegionBodyEdit,
  markEditInteractionStarted: markRegionEditInteractionStarted,
  markEditInteractionFinished: () => markRegionEditInteractionFinished({ flushRender: false }),
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
  preparePointRegionDrag: prepareRegionClick,
  beginRegionBodyEdit,
  markEditInteractionFinished: () => markRegionEditInteractionFinished({ flushRender: false }),
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
  markEditInteractionStarted: markRegionEditInteractionStarted,
  markEditInteractionFinished: markRegionEditInteractionFinished,
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
  renderRegions: requestRegionRender,
  handleVertexContextMenu,
})

const regionRenderer = useRegionRenderer({
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
  handleRegionContextMenu,
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
})

renderRegionsImpl = regionRenderer.renderRegions
showActiveEditHandlesImpl = regionRenderer.showActiveEditHandles
clearSelectionControlsImpl = regionRenderer.clearSelectionControls
updateRegionSelectionAppearanceImpl = regionRenderer.updateRegionSelectionAppearance
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
  isRegionEditInteractionActive = false
  clearPendingRegionRender()
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
  stage.on('contextmenu', closeContextMenu)

  loadSelectedPage(props.selectedPage)
})

watch(() => props.selectedPage, (newPage) => {
  closeContextMenu()
  clearSpatialIndex()
  isRegionEditInteractionActive = false
  clearPendingRegionRender()
  loadSelectedPage(newPage)
})

watch(() => props.zoomLevel, () => {
  updateZoom()
  resetSelectionCycle()
  resetPointerInteraction()
})

watch(() => props.pageIndex, () => {
  closeContextMenu()
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
    requestRegionRender()
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
    closeContextMenu()
    const hadActiveRegionInteraction = isRegionInteractionActive() || regionRenderPending

    resetStageCursor()
    resetSelectionCycle()
    resetPointerInteraction()
    isRegionEditInteractionActive = false
    clearPendingRegionRender()

    if (hadActiveRegionInteraction) {
      requestRegionRender()
    }
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

watch(
  () => props.regions.map((region) => region.id),
  (regionIds) => {
    if (contextMenu.value.visible && !regionIds.includes(contextMenu.value.region?.id)) {
      closeContextMenu()
    }
  }
)

onBeforeUnmount(() => {
  resetStageCursor()
  closeContextMenu()
  clearPendingRegionRender()
  isRegionEditInteractionActive = false

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

<style>
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

.mx-context-menu.annot8 {
  min-width: 180px;
  max-width: 360px;
  padding: 4px;
  background: #ffffff;
  border: 1px solid #adb5bd;
  box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
}

.mx-context-menu.annot8 .mx-context-menu-item {
  min-height: 30px;
  color: #212529;
  font-size: 0.875rem;
  line-height: 1.25;
  white-space: nowrap;
}

.mx-context-menu.annot8 .mx-context-menu-item:hover,
.mx-context-menu.annot8 .mx-context-menu-item.open {
  background: #e9ecef;
}

.mx-context-menu.annot8 .mx-context-menu-item.disabled {
  color: #6c757d;
}
</style>
