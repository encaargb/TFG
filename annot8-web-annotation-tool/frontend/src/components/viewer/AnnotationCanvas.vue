<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Konva from 'konva'
import { hasValidVisiblePointRegionSegments } from '../../utils/pointRegionValidation'
import {
  clampTransformerBox,
} from './rectangleCanvasGeometry'
import { useCanvasAutoScroll } from './useCanvasAutoScroll'
import { useCanvasCursor } from './useCanvasCursor'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import { useCanvasPageImage } from './useCanvasPageImage'
import { usePointRegionDrawing } from './usePointRegionDrawing'
import { usePointRegionDragging } from './usePointRegionDragging'
import { useRectangleEditing } from './useRectangleEditing'
import { useRectangleDrawing } from './useRectangleDrawing'
import { useRegionPointEditing } from './useRegionPointEditing'
import { useRegionVertexHandles } from './useRegionVertexHandles'
import {
  clampPointToBounds,
  clampRectangleToBounds,
  flattenPoints,
  toVisiblePoints,
  toVisibleRectangle,
} from '../../utils/regionGeometry'
import {
  MIN_VISIBLE_RECTANGLE_SIZE,
  MIN_VISIBLE_SEGMENT_LENGTH,
  RECTANGLE_TRANSFORMER_ANCHOR_CORNER_RADIUS,
  RECTANGLE_TRANSFORMER_ANCHOR_SIZE,
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
  'clear-selected-region',
  'delete-selected-region',
  'mouse-position-change',
])

const canvasContainer = ref(null)
const canvasWrapper = ref(null)

const currentPageRegions = computed(() =>
  props.regions.filter((region) => region.pageIndex === props.pageIndex)
)

let stage = null
let imageLayer = null
let regionLayer = null
let transformer = null
let vertexHandles = []
let isVertexHandleDragging = false

function getRegionCreationColor() {
  return /^#[0-9a-fA-F]{6}$/.test(props.regionCreationColor)
    ? props.regionCreationColor.toLowerCase()
    : REGION_COLOR
}

function getRegionColor(region) {
  return /^#[0-9a-fA-F]{6}$/.test(region?.color) ? region.color : REGION_COLOR
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

const {
  loadSelectedPage,
  updateZoom,
  getRegionScale,
  getDocumentBounds,
  getVisibleBounds,
  getDocumentCoordinatesFromPointer,
  hasPageImage,
  isPageImageNode,
  disposePageImage,
} = useCanvasPageImage({
  getStage: () => stage,
  getImageLayer: () => imageLayer,
  canvasWrapper,
  getZoomLevel: () => props.zoomLevel,
  renderRegions: () => renderRegions(),
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
  clearSelectedRegion: () => emit('clear-selected-region'),
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
  clearSelectedRegion: () => emit('clear-selected-region'),
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
  getVertexHandles: () => vertexHandles,
  setIsVertexHandleDragging: (isDragging) => {
    isVertexHandleDragging = isDragging
  },
  clearPolylineEndpointExtensionPreview: clearPolylineEndpointPreview,
  autoScrollCanvasWrapper,
  setStageCursor,
  resetStageCursor,
  hasValidPointRegionSegments,
  selectRegion: (id) => emit('select-region', id),
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
  renderRegions,
})

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

function setNodeVisibility(nodes, isVisible) {
  nodes.forEach((node) => {
    if (typeof node.visible === 'function') {
      node.visible(isVisible)
    }
  })
}

function hideActiveEditHandles() {
  setNodeVisibility([transformer, ...vertexHandles].filter(Boolean), false)
  regionLayer?.draw()
}

function showActiveEditHandles() {
  setNodeVisibility([transformer, ...vertexHandles].filter(Boolean), true)
  transformer?.forceUpdate?.()
  regionLayer?.draw()
}

function createRectangleRegionNode(region) {
  const { scaleX, scaleY } = getRegionScale()
  const visibleRegion = toVisibleRectangle(region, scaleX, scaleY, props.zoomLevel)
  let node

  node = new Konva.Rect({
    ...visibleRegion,
    id: region.id,
    draggable: props.activeTool === 'select',
    fill: `${region.color}26`,
    stroke: region.color,
    strokeWidth: props.selectedRegionId === region.id ? 3 : 2,
    strokeScaleEnabled: false,
    dragBoundFunc: (position) => getRectangleDragBoundPosition(node, position),
  })

  attachRegionCursorHandlers(node, region.id)

  node.on('click tap', () => {
    if (props.activeTool !== 'select') return
    clearSelectedPoint()
    emit('select-region', region.id)
  })

  attachRectangleEditing({ node, region, transformer, scaleX, scaleY })

  return node
}

function createPointRegionNode(region) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, props.zoomLevel)
  const flatVisiblePoints = flattenPoints(visiblePoints)
  const isPolygon = region.type === 'polygon'

  const node = new Konva.Line({
    points: flatVisiblePoints,
    closed: isPolygon,
    id: region.id,
    draggable: props.activeTool === 'select',
    fill: isPolygon ? `${region.color}26` : 'transparent',
    stroke: region.color,
    strokeWidth: props.selectedRegionId === region.id ? 3 : 2,
    strokeScaleEnabled: false,
    dragBoundFunc: (position) => getPointRegionDragBoundPosition(visiblePoints, position),
  })

  attachRegionCursorHandlers(node, region.id)

  node.on('click tap', (event) => {
    if (props.activeTool !== 'select') return
    if (handleRegionClickSuppression(region, event)) return

    emit('select-region', region.id)
  })

  node.on('dblclick dbltap', () => {
    if (props.activeTool !== 'select') return

    if (handleRegionDoubleClickSuppression()) return

    if (
      insertPointIntoSegment({
        region,
        visiblePoints,
        isPolygon,
        pointerPosition: stage.getPointerPosition(),
      })
    ) {
      return
    }

    emit('select-region', region.id)
  })

  attachPointRegionDragging({ node, region, visiblePoints, scaleX, scaleY })

  return node
}

function createRegionNode(region) {
  if (region.type === 'polygon' || region.type === 'polyline') {
    return createPointRegionNode(region)
  }

  return createRectangleRegionNode(region)
}

function renderRegions() {
  if (!regionLayer || !hasPageImage()) return

  clearPolylineEndpointPreview(false)
  regionLayer.destroyChildren()
  vertexHandles = []
  const selectedRectangle = currentPageRegions.value.find(
    (region) => region.id === props.selectedRegionId && region.type === 'rectangle'
  )
  const transformerColor = getRegionColor(selectedRectangle)

  transformer = new Konva.Transformer({
    rotateEnabled: false,
    flipEnabled: false,
    keepRatio: false,
    anchorSize: RECTANGLE_TRANSFORMER_ANCHOR_SIZE,
    anchorCornerRadius: RECTANGLE_TRANSFORMER_ANCHOR_CORNER_RADIUS,
    anchorFill: '#ffffff',
    anchorStroke: transformerColor,
    anchorStrokeWidth: 2,
    borderStroke: transformerColor,
    borderStrokeWidth: 1,
    boundBoxFunc: (oldBox, newBox) => clampTransformerBox(
      oldBox,
      newBox,
      getVisibleBounds(),
      MIN_VISIBLE_RECTANGLE_SIZE
    ),
  })

  let selectedNode = null

  currentPageRegions.value.forEach((region) => {
    const node = createRegionNode(region)
    regionLayer.add(node)

    if (region.id === props.selectedRegionId) {
      selectedNode = node
    }

    if (
      (region.type === 'polygon' || region.type === 'polyline') &&
      region.id === props.selectedRegionId &&
      props.activeTool === 'select'
    ) {
      vertexHandles = createRegionVertexHandles(region, node)
      vertexHandles.forEach((handle) => regionLayer.add(handle))
    }
  })

  regionLayer.add(transformer)

  if (
    selectedNode &&
    props.activeTool === 'select' &&
    !['polygon', 'polyline'].includes(
      currentPageRegions.value.find((region) => region.id === props.selectedRegionId)?.type
    )
  ) {
    transformer.nodes([selectedNode])
  } else {
    transformer.nodes([])
  }

  regionLayer.draw()
}

function hasValidPointRegionSegments(points, type) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(points, scaleX, scaleY, props.zoomLevel)

  return hasValidVisiblePointRegionSegments(visiblePoints, type, MIN_VISIBLE_SEGMENT_LENGTH)
}

function handleStageMouseDown(event) {
  beginRectangleRegion()
  beginPointRegionDrag(event)
}

function handleStageMouseUp() {
  commitDraftRectangleRegion()
  addPointRegionDragReleasePoint()
}

function handleStageClick(event) {
  if (event?.evt?.detail > 1) return

  handlePointRegionClick()

  if (props.activeTool !== 'select') return

  const clickTarget = event?.target

  if (clickTarget && clickTarget !== stage && !isPageImageNode(clickTarget)) return

  if (insertPolylineEndpoint(stage.getPointerPosition())) return

  clearSelectedPoint()
  emit('clear-selected-region')
}

function resetTransientInteractionState() {
  cancelDraftRectangleRegion()
  cancelDraftPointRegion(false)
  resetPointEditing()
  clearRegionCursorState()
  resetStageCursor()

  isVertexHandleDragging = false
}

function handleMouseMove(event) {
  resetStaleRegionCursor(event)
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
  clearSelectedRegion: () => emit('clear-selected-region'),
  deleteSelectedRegion: () => emit('delete-selected-region'),
})

onMounted(() => {
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
  loadSelectedPage(newPage)
})

watch(() => props.zoomLevel, () => {
  updateZoom()
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
    renderRegions()
  },
  { deep: true }
)

watch(() => props.activeTool, (newTool, previousTool) => {
  if (newTool !== previousTool) {
    resetStageCursor()
  }

  if (['polygon', 'polyline'].includes(previousTool) && previousTool !== newTool) {
    cancelDraftPointRegion(false)
  }

  if (previousTool === 'select' && newTool !== previousTool) {
    clearRegionCursorState()
    isVertexHandleDragging = false
    clearSelectedPoint()
    resetStageCursor()
  }
})

onBeforeUnmount(() => {
  resetStageCursor()

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
  transformer = null
  vertexHandles = []
  clearRegionCursorState()
  isVertexHandleDragging = false
})

defineExpose({
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
