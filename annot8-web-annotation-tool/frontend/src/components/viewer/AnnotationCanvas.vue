<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Konva from 'konva'
import {
  getPointRegionMinimumPointCount,
  hasValidVisiblePointRegionSegments,
} from '../../utils/pointRegionValidation'
import {
  getClosestPointRegionSegmentIndex,
} from './pointRegionCanvasGeometry'
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
  POINT_REGION_SEGMENT_HIT_TOLERANCE,
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
let polylineEndpointExtensionPreviewNode = null
let vertexHandles = []
let isVertexHandleDragging = false
let selectedPointRegionPoint = null
let suppressPointRegionClick = false
let suppressPointRegionDoubleClick = false

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
  preparePointRegionDrag: () => {
    suppressPointRegionClick = true
    suppressPointRegionDoubleClick = true
    clearSelectedPointRegionPoint()
  },
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
})

const { createRegionVertexHandles } = useRegionVertexHandles({
  getZoomLevel: () => props.zoomLevel,
  getActiveTool: () => props.activeTool,
  getRegionScale,
  getVisibleBounds,
  getDocumentBounds,
  getRegionLayer: () => regionLayer,
  getSelectedPointRegionPoint: () => selectedPointRegionPoint,
  setSelectedPointRegionPoint: (point) => {
    selectedPointRegionPoint = point
  },
  getVertexHandles: () => vertexHandles,
  setIsVertexHandleDragging: (isDragging) => {
    isVertexHandleDragging = isDragging
  },
  clearPolylineEndpointExtensionPreview,
  autoScrollCanvasWrapper,
  setStageCursor,
  resetStageCursor,
  hasValidPointRegionSegments,
  selectRegion: (id) => emit('select-region', id),
  updateRegion: ({ id, changes }) => emit('update-region', { id, changes }),
  renderRegions,
})

function clearSelectedPointRegionPoint() {
  selectedPointRegionPoint = null
  clearPolylineEndpointExtensionPreview()
}

function clearPolylineEndpointExtensionPreview(shouldDraw = true) {
  if (!polylineEndpointExtensionPreviewNode) return

  polylineEndpointExtensionPreviewNode.destroy()
  polylineEndpointExtensionPreviewNode = null

  if (shouldDraw) {
    regionLayer?.draw()
  }
}

function getPolylineEndpointExtensionPreviewContext() {
  if (props.activeTool !== 'select' || !selectedPointRegionPoint) return null
  if (isVertexHandleDragging) return null

  const { regionId, pointIndex } = selectedPointRegionPoint
  const region = props.regions.find((candidate) => candidate.id === regionId)

  if (!region || region.type !== 'polyline' || props.selectedRegionId !== region.id) return null
  if (pointIndex !== 0 && pointIndex !== region.points.length - 1) return null

  return {
    endpoint: region.points[pointIndex],
    isFirstEndpoint: pointIndex === 0,
    region,
  }
}

function updatePolylineEndpointExtensionPreview(pointerPosition = stage?.getPointerPosition()) {
  if (!stage || !regionLayer || !isPointerInsideVisibleDocument(pointerPosition)) {
    clearPolylineEndpointExtensionPreview()
    return
  }

  const previewContext = getPolylineEndpointExtensionPreviewContext()
  const documentHoverPoint = getClampedDocumentPointer(pointerPosition)

  if (!previewContext || !documentHoverPoint) {
    clearPolylineEndpointExtensionPreview()
    return
  }

  const { endpoint, isFirstEndpoint, region } = previewContext
  const previewDocumentPoints = isFirstEndpoint
    ? [documentHoverPoint, endpoint]
    : [endpoint, documentHoverPoint]
  const { scaleX, scaleY } = getRegionScale()
  const previewVisiblePoints = toVisiblePoints(
    previewDocumentPoints,
    scaleX,
    scaleY,
    props.zoomLevel
  )

  if (!polylineEndpointExtensionPreviewNode) {
    polylineEndpointExtensionPreviewNode = new Konva.Line({
      points: [],
      closed: false,
      fill: 'transparent',
      stroke: region.color || REGION_COLOR,
      strokeWidth: 2,
      strokeScaleEnabled: false,
      dash: [6, 4],
      listening: false,
    })
    regionLayer.add(polylineEndpointExtensionPreviewNode)
  }

  polylineEndpointExtensionPreviewNode.points(flattenPoints(previewVisiblePoints))
  regionLayer.draw()
}

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
    clearSelectedPointRegionPoint()
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

  function insertPointIntoSelectedRegionSegment(pointerPosition) {
    if (
      !['polygon', 'polyline'].includes(region.type) ||
      props.activeTool !== 'select' ||
      props.selectedRegionId !== region.id
    ) {
      return false
    }

    const segmentIndex = getClosestPointRegionSegmentIndex(
      pointerPosition,
      visiblePoints,
      isPolygon,
      POINT_REGION_SEGMENT_HIT_TOLERANCE
    )
    const documentPoint = getDocumentCoordinatesFromPointer(pointerPosition)

    if (segmentIndex === -1 || !documentPoint) return false

    const insertIndex = segmentIndex + 1
    const points = [
      ...region.points.slice(0, insertIndex),
      documentPoint,
      ...region.points.slice(insertIndex),
    ]

    if (!hasValidPointRegionSegments(points, region.type)) return false

    clearSelectedPointRegionPoint()

    emit('update-region', {
      id: region.id,
      changes: {
        points,
      },
    })

    return true
  }

  node.on('click tap', (event) => {
    if (props.activeTool !== 'select') return
    clearSelectedPointRegionPoint()

    if (suppressPointRegionClick) {
      suppressPointRegionClick = false
      return
    }

    if (props.selectedRegionId !== region.id) {
      suppressPointRegionDoubleClick = true
    } else if ((event?.evt?.detail ?? 1) <= 1) {
      suppressPointRegionDoubleClick = false
    }

    emit('select-region', region.id)
  })

  node.on('dblclick dbltap', () => {
    if (props.activeTool !== 'select') return

    if (suppressPointRegionClick || suppressPointRegionDoubleClick) {
      suppressPointRegionClick = false
      suppressPointRegionDoubleClick = false
      return
    }

    if (insertPointIntoSelectedRegionSegment(stage.getPointerPosition())) return

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

  clearPolylineEndpointExtensionPreview(false)
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

function insertPolylineEndpointPoint(pointerPosition) {
  if (props.activeTool !== 'select' || !selectedPointRegionPoint) return false
  if (!isPointerInsideVisibleDocument(pointerPosition)) return false

  const { regionId, pointIndex } = selectedPointRegionPoint
  const region = props.regions.find((candidate) => candidate.id === regionId)

  if (!region || region.type !== 'polyline' || props.selectedRegionId !== region.id) return false
  if (pointIndex !== 0 && pointIndex !== region.points.length - 1) return false

  const documentPoint = getDocumentCoordinatesFromPointer(pointerPosition)

  if (!documentPoint) return false

  const points =
    pointIndex === 0
      ? [documentPoint, ...region.points]
      : [...region.points, documentPoint]

  if (!hasValidPointRegionSegments(points, region.type)) return false

  clearSelectedPointRegionPoint()
  emit('update-region', {
    id: region.id,
    changes: {
      points,
    },
  })

  return true
}

function handleStageClick(event) {
  if (event?.evt?.detail > 1) return

  handlePointRegionClick()

  if (props.activeTool !== 'select') return

  const clickTarget = event?.target

  if (clickTarget && clickTarget !== stage && !isPageImageNode(clickTarget)) return

  if (insertPolylineEndpointPoint(stage.getPointerPosition())) return

  clearSelectedPointRegionPoint()
  emit('clear-selected-region')
}

function resetTransientInteractionState() {
  cancelDraftRectangleRegion()
  cancelDraftPointRegion(false)
  clearSelectedPointRegionPoint()
  clearPolylineEndpointExtensionPreview(false)
  clearRegionCursorState()
  resetStageCursor()

  isVertexHandleDragging = false
  selectedPointRegionPoint = null
  suppressPointRegionClick = false
  suppressPointRegionDoubleClick = false
}

function deleteSelectedPointRegionPoint() {
  if (!selectedPointRegionPoint) return false

  const { regionId, pointIndex } = selectedPointRegionPoint
  const region = props.regions.find((candidate) => candidate.id === regionId)
  clearSelectedPointRegionPoint()

  if (!region || !['polygon', 'polyline'].includes(region.type)) return false

  const minimumPointCount = getPointRegionMinimumPointCount(region.type)

  if (region.points.length <= minimumPointCount) {
    emit('delete-selected-region')
    return true
  }

  emit('update-region', {
    id: region.id,
    changes: {
      points: region.points.filter((_, index) => index !== pointIndex),
    },
  })

  return true
}

function handleMouseMove(event) {
  resetStaleRegionCursor(event)
  autoScrollCanvasWrapper(event)

  const pos = stage.getPointerPosition()
  updateCreationToolCursor(pos)

  const coordinates = getDocumentCoordinatesFromPointer(pos)

  if (!coordinates) {
    clearPolylineEndpointExtensionPreview()
    return
  }

  emit('mouse-position-change', coordinates)

  if (hasDraftRectangle()) {
    updateDraftRectangleRegion()
  } else if (hasDraftPointRegion()) {
    updateDraftPointPreview()
  } else {
    updatePolylineEndpointExtensionPreview(pos)
  }
}

function handleMouseLeave() {
  resetStageCursor()
  clearPolylineEndpointExtensionPreview()
  emit('mouse-position-change', null)
}

useCanvasKeyboardShortcuts({
  getActiveTool: () => props.activeTool,
  commitDraftPointRegion,
  cancelDraftPointRegion,
  cancelDraftRectangleRegion,
  clearSelectedPointRegionPoint,
  deleteSelectedPointRegionPoint,
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
  if (selectedPointRegionPoint?.regionId !== newSelectedRegionId) {
    clearSelectedPointRegionPoint()
  } else {
    clearPolylineEndpointExtensionPreview()
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
    clearSelectedPointRegionPoint()
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
  transformer = null
  polylineEndpointExtensionPreviewNode = null
  vertexHandles = []
  clearRegionCursorState()
  isVertexHandleDragging = false
  selectedPointRegionPoint = null
  suppressPointRegionClick = false
  suppressPointRegionDoubleClick = false
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
