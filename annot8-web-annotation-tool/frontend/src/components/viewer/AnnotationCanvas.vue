<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Konva from 'konva'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getVisibleDimensions,
} from '../../utils/viewerMath'
import {
  clampPointToBounds,
  clampPolygonToBounds,
  clampRectangleToBounds,
  createPolygonRegion,
  createPolylineRegion,
  createRectangleRegion,
  flattenPoints,
  isDrawableRegion,
  toDocumentPoints,
  toDocumentRectangle,
  toVisiblePoints,
  toVisibleRectangle,
} from '../../utils/regionGeometry'

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
})

const emit = defineEmits([
  'add-region',
  'update-region',
  'select-region',
  'clear-selected-region',
  'delete-selected-region',
  'mouse-position-change',
])

const REGION_COLOR = '#0d6efd'
const POLYGON_CLOSE_DISTANCE = 8
const MIN_VISIBLE_REGION_SIZE = 4

const canvasContainer = ref(null)
const canvasWrapper = ref(null)

const currentPageRegions = computed(() =>
  props.regions.filter((region) => region.pageIndex === props.pageIndex)
)

let stage = null
let imageLayer = null
let regionLayer = null
let pageImageNode = null
let transformer = null
let draftRegionNode = null
let draftRegionStart = null
let draftPointRegionPoints = []
let imageLoadSequence = 0

let baseImageWidth = 0
let baseImageHeight = 0
let originalImageWidth = 0
let originalImageHeight = 0

function getRegionScale() {
  return {
    scaleX: baseImageWidth / originalImageWidth,
    scaleY: baseImageHeight / originalImageHeight,
  }
}

function getDocumentBounds() {
  return {
    width: originalImageWidth,
    height: originalImageHeight,
  }
}

function updateZoom() {
  if (!stage || !pageImageNode) return

  const { width: visibleWidth, height: visibleHeight } = getVisibleDimensions(
    baseImageWidth,
    baseImageHeight,
    props.zoomLevel
  )

  stage.width(visibleWidth)
  stage.height(visibleHeight)

  pageImageNode.x(0)
  pageImageNode.y(0)
  pageImageNode.width(visibleWidth)
  pageImageNode.height(visibleHeight)

  imageLayer.draw()
  renderRegions()
}

function getVisibleBounds() {
  return getVisibleDimensions(baseImageWidth, baseImageHeight, props.zoomLevel)
}

function normalizeVisibleRectangle(rectangle) {
  const x = rectangle.width < 0 ? rectangle.x + rectangle.width : rectangle.x
  const y = rectangle.height < 0 ? rectangle.y + rectangle.height : rectangle.y

  return {
    x,
    y,
    width: Math.abs(rectangle.width),
    height: Math.abs(rectangle.height),
  }
}

function clampVisibleRectangle(rectangle, minimumSize = 0) {
  const bounds = getVisibleBounds()
  const normalizedRectangle = normalizeVisibleRectangle(rectangle)
  const width = Math.min(Math.max(minimumSize, normalizedRectangle.width), bounds.width)
  const height = Math.min(Math.max(minimumSize, normalizedRectangle.height), bounds.height)
  const maxX = Math.max(0, bounds.width - width)
  const maxY = Math.max(0, bounds.height - height)

  return {
    x: Math.max(0, Math.min(maxX, normalizedRectangle.x)),
    y: Math.max(0, Math.min(maxY, normalizedRectangle.y)),
    width,
    height,
  }
}

function clampTransformerBox(oldBox, newBox) {
  if (
    newBox.width < MIN_VISIBLE_REGION_SIZE ||
    newBox.height < MIN_VISIBLE_REGION_SIZE
  ) {
    return oldBox
  }

  return {
    ...newBox,
    ...clampVisibleRectangle(newBox, MIN_VISIBLE_REGION_SIZE),
  }
}

function getNodeVisibleRectangle(node) {
  const scaleXNode = typeof node.scaleX === 'function' ? node.scaleX() : 1
  const scaleYNode = typeof node.scaleY === 'function' ? node.scaleY() : 1

  return {
    x: node.x(),
    y: node.y(),
    width: node.width() * scaleXNode,
    height: node.height() * scaleYNode,
  }
}

function applyVisibleRectangleToNode(node, rectangle) {
  node.x(rectangle.x)
  node.y(rectangle.y)
  node.width(rectangle.width)
  node.height(rectangle.height)

  if (typeof node.scaleX === 'function') node.scaleX(1)
  if (typeof node.scaleY === 'function') node.scaleY(1)
}

function syncTransformedRectangleNode(node) {
  const visibleRectangle = clampVisibleRectangle(
    getNodeVisibleRectangle(node),
    MIN_VISIBLE_REGION_SIZE
  )
  applyVisibleRectangleToNode(node, visibleRectangle)

  return visibleRectangle
}

function getVisiblePolygonBounds(points) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

function clampVisiblePolygonDelta(points, delta) {
  const bounds = getVisibleBounds()
  const polygonBounds = getVisiblePolygonBounds(points)

  return {
    x: Math.max(-polygonBounds.minX, Math.min(bounds.width - polygonBounds.maxX, delta.x)),
    y: Math.max(-polygonBounds.minY, Math.min(bounds.height - polygonBounds.maxY, delta.y)),
  }
}

function createRectangleRegionNode(region) {
  const { scaleX, scaleY } = getRegionScale()
  const visibleRegion = toVisibleRectangle(region, scaleX, scaleY, props.zoomLevel)

  const node = new Konva.Rect({
    ...visibleRegion,
    id: region.id,
    draggable: props.activeTool === 'select',
    fill: `${region.color}26`,
    stroke: region.color,
    strokeWidth: props.selectedRegionId === region.id ? 3 : 2,
    strokeScaleEnabled: false,
    dragBoundFunc: (position) => {
      const clamped = clampVisibleRectangle({
        x: position.x,
        y: position.y,
        width: node.width(),
        height: node.height(),
      })

      return {
        x: clamped.x,
        y: clamped.y,
      }
    },
  })

  node.on('click tap', () => {
    if (props.activeTool !== 'select') return
    emit('select-region', region.id)
  })

  node.on('dragmove', () => {
    applyVisibleRectangleToNode(node, clampVisibleRectangle(getNodeVisibleRectangle(node)))
    regionLayer.draw()
  })

  node.on('transform', () => {
    syncTransformedRectangleNode(node)
    regionLayer.draw()
  })

  node.on('dragend transformend', () => {
    const visibleRectangle = syncTransformedRectangleNode(node)

    const documentRectangle = clampRectangleToBounds(
      toDocumentRectangle(visibleRectangle, scaleX, scaleY, props.zoomLevel),
      getDocumentBounds()
    )

    emit('update-region', { id: region.id, changes: documentRectangle })

    if (typeof node.scaleX === 'function') node.scaleX(1)
    if (typeof node.scaleY === 'function') node.scaleY(1)
  })

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
    dragBoundFunc: (position) => clampVisiblePolygonDelta(visiblePoints, position),
  })

  node.on('click tap', () => {
    if (props.activeTool !== 'select') return
    emit('select-region', region.id)
  })

  node.on('dragmove', () => {
    const delta = clampVisiblePolygonDelta(visiblePoints, { x: node.x(), y: node.y() })
    node.x(delta.x)
    node.y(delta.y)
    regionLayer.draw()
  })

  node.on('dragend', () => {
    const delta = clampVisiblePolygonDelta(visiblePoints, { x: node.x(), y: node.y() })
    const movedVisiblePoints = visiblePoints.map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y,
    }))
    const documentPoints = toDocumentPoints(movedVisiblePoints, scaleX, scaleY, props.zoomLevel)

    emit('update-region', {
      id: region.id,
      changes: clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()),
    })
  })

  return node
}

function createPointRegionVertexHandles(region, pointRegionNode) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, props.zoomLevel)
  const editedVisiblePoints = visiblePoints.map((point) => ({ ...point }))

  return visiblePoints.map((point, index) => {
    const handle = new Konva.Circle({
      x: point.x,
      y: point.y,
      radius: 5,
      draggable: true,
      fill: '#ffffff',
      stroke: region.color,
      strokeWidth: 2,
      strokeScaleEnabled: false,
      hitStrokeWidth: 12,
      dragBoundFunc: (position) => {
        const bounds = getVisibleBounds()

        return {
          x: Math.max(0, Math.min(bounds.width, position.x)),
          y: Math.max(0, Math.min(bounds.height, position.y)),
        }
      },
    })

    handle.on('click tap', () => {
      if (props.activeTool !== 'select') return
      emit('select-region', region.id)
    })

    handle.on('dragmove', () => {
      const bounds = getVisibleBounds()
      const nextPoint = {
        x: Math.max(0, Math.min(bounds.width, handle.x())),
        y: Math.max(0, Math.min(bounds.height, handle.y())),
      }

      handle.x(nextPoint.x)
      handle.y(nextPoint.y)
      editedVisiblePoints[index] = nextPoint
      pointRegionNode.points(flattenPoints(editedVisiblePoints))
      regionLayer.draw()
    })

    handle.on('dragend', () => {
      const documentPoints = toDocumentPoints(
        editedVisiblePoints,
        scaleX,
        scaleY,
        props.zoomLevel
      )

      emit('update-region', {
        id: region.id,
        changes: clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()),
      })
    })

    return handle
  })
}

function createRegionNode(region) {
  if (region.type === 'polygon' || region.type === 'polyline') {
    return createPointRegionNode(region)
  }

  return createRectangleRegionNode(region)
}

function renderRegions() {
  if (!regionLayer || !baseImageWidth || !baseImageHeight) return

  regionLayer.destroyChildren()
  transformer = new Konva.Transformer({
    rotateEnabled: false,
    flipEnabled: false,
    keepRatio: false,
    boundBoxFunc: (oldBox, newBox) => clampTransformerBox(oldBox, newBox),
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
      createPointRegionVertexHandles(region, node).forEach((handle) => regionLayer.add(handle))
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

function beginRectangleRegion() {
  if (!stage || !regionLayer || !pageImageNode || props.activeTool !== 'rectangle') return

  const pointerPosition = stage.getPointerPosition()
  const documentStart = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentStart) return

  emit('clear-selected-region')
  draftRegionStart = documentStart

  const { scaleX, scaleY } = getRegionScale()
  const visibleStart = toVisibleRectangle(
    {
      x: documentStart.x,
      y: documentStart.y,
      width: 0,
      height: 0,
    },
    scaleX,
    scaleY,
    props.zoomLevel
  )

  draftRegionNode = new Konva.Rect({
    ...visibleStart,
    fill: `${REGION_COLOR}26`,
    stroke: REGION_COLOR,
    strokeWidth: 2,
    strokeScaleEnabled: false,
    dash: [6, 4],
  })

  regionLayer.add(draftRegionNode)
  regionLayer.draw()
}

function updateDraftRectangleRegion() {
  if (!stage || !draftRegionNode || !draftRegionStart) return

  const pointerPosition = stage.getPointerPosition()
  const documentEnd = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentEnd) return

  const draftRegion = createRectangleRegion({
    id: 'draft-region',
    pageIndex: props.pageIndex,
    start: draftRegionStart,
    end: documentEnd,
    color: REGION_COLOR,
  })
  const { scaleX, scaleY } = getRegionScale()
  const visibleRegion = toVisibleRectangle(draftRegion, scaleX, scaleY, props.zoomLevel)

  draftRegionNode.x(visibleRegion.x)
  draftRegionNode.y(visibleRegion.y)
  draftRegionNode.width(visibleRegion.width)
  draftRegionNode.height(visibleRegion.height)
  regionLayer.draw()
}

function updateDraftPointRegion() {
  if (!stage || !draftRegionNode || !['polygon', 'polyline'].includes(props.activeTool)) return

  const pointerPosition = stage.getPointerPosition()
  const shouldClosePolygon =
    props.activeTool === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)
  const documentHoverPoint = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  const visiblePoints = toVisiblePoints(
    documentHoverPoint && !shouldClosePolygon
      ? [...draftPointRegionPoints, documentHoverPoint]
      : draftPointRegionPoints,
    getRegionScale().scaleX,
    getRegionScale().scaleY,
    props.zoomLevel
  )

  draftRegionNode.points(flattenPoints(visiblePoints))
  draftRegionNode.closed(shouldClosePolygon)
  draftRegionNode.fill(shouldClosePolygon ? `${REGION_COLOR}26` : `${REGION_COLOR}12`)
  regionLayer.draw()
}

function isPointerNearFirstPolygonPoint(pointerPosition) {
  if (!pointerPosition || draftPointRegionPoints.length < 3) return false

  const { scaleX, scaleY } = getRegionScale()
  const [firstVisiblePoint] = toVisiblePoints(
    [draftPointRegionPoints[0]],
    scaleX,
    scaleY,
    props.zoomLevel
  )
  const distance = Math.hypot(
    pointerPosition.x - firstVisiblePoint.x,
    pointerPosition.y - firstVisiblePoint.y
  )

  return distance <= POLYGON_CLOSE_DISTANCE
}

function commitDraftRectangleRegion() {
  if (!stage || !draftRegionNode || !draftRegionStart) return

  const pointerPosition = stage.getPointerPosition()
  const documentEnd = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  let draftRegion = null

  if (documentEnd) {
    const region = createRectangleRegion({
      id: props.nextRegionId,
      pageIndex: props.pageIndex,
      start: draftRegionStart,
      end: documentEnd,
      color: REGION_COLOR,
    })

    draftRegion = {
      ...region,
      ...clampRectangleToBounds(region, getDocumentBounds()),
    }
  }

  draftRegionNode.destroy()
  draftRegionNode = null
  draftRegionStart = null

  if (draftRegion && isDrawableRegion(draftRegion)) {
    emit('add-region', draftRegion)
    emit('select-region', draftRegion.id)
  } else {
    renderRegions()
  }
}

function beginPointRegion() {
  if (!stage || !regionLayer || !pageImageNode) return
  if (!['polygon', 'polyline'].includes(props.activeTool)) return

  const pointerPosition = stage.getPointerPosition()
  const documentPoint = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentPoint) return

  if (props.activeTool === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)) {
    commitDraftPointRegion()
    return
  }

  emit('clear-selected-region')
  draftPointRegionPoints.push(clampPointToBounds(documentPoint, getDocumentBounds()))

  if (!draftRegionNode) {
    draftRegionNode = new Konva.Line({
      points: [],
      closed: false,
      fill: props.activeTool === 'polygon' ? `${REGION_COLOR}12` : 'transparent',
      stroke: REGION_COLOR,
      strokeWidth: 2,
      strokeScaleEnabled: false,
      dash: [6, 4],
    })
    regionLayer.add(draftRegionNode)
  }

  updateDraftPointRegion()
}

function handleStageClick(event) {
  beginPointRegion()

  if (props.activeTool !== 'select') return

  const clickTarget = event?.target

  if (clickTarget && clickTarget !== stage && clickTarget !== pageImageNode) return

  emit('clear-selected-region')
}

function cancelDraftPointRegion(shouldRender = true) {
  if (draftRegionNode) {
    draftRegionNode.destroy()
  }

  draftRegionNode = null
  draftPointRegionPoints = []

  if (shouldRender) {
    renderRegions()
  }
}

function commitDraftPointRegion() {
  if (!draftRegionNode || !['polygon', 'polyline'].includes(props.activeTool)) return

  const createRegion = props.activeTool === 'polygon' ? createPolygonRegion : createPolylineRegion
  const region = createRegion({
    id: props.nextRegionId,
    pageIndex: props.pageIndex,
    points: draftPointRegionPoints,
    color: REGION_COLOR,
  })
  const draftRegion = {
    ...region,
    ...clampPolygonToBounds(region, getDocumentBounds()),
  }

  draftRegionNode.destroy()
  draftRegionNode = null
  draftPointRegionPoints = []

  if (isDrawableRegion(draftRegion)) {
    emit('add-region', draftRegion)
    emit('select-region', draftRegion.id)
  } else {
    renderRegions()
  }
}

function handleKeydown(event) {
  if (['polygon', 'polyline'].includes(props.activeTool) && event.key === 'Enter') {
    commitDraftPointRegion()
    return
  }

  if (['polygon', 'polyline'].includes(props.activeTool) && event.key === 'Escape') {
    cancelDraftPointRegion()
    return
  }

  if (event.key === 'Escape') {
    emit('clear-selected-region')
    return
  }

  if (event.key !== 'Delete' && event.key !== 'Backspace') return

  emit('delete-selected-region')
}

function loadSelectedPageInKonva(src) {
  if (!imageLayer || !stage || !src) return

  const loadId = imageLoadSequence + 1
  imageLoadSequence = loadId

  const img = new window.Image()
  img.src = src

  img.onload = () => {
    if (loadId !== imageLoadSequence || !stage || !imageLayer) return

    if (pageImageNode) {
      pageImageNode.destroy()
      pageImageNode = null
    }

    const fittedDimensions = getFittedDimensions(img.width, img.height, 1000, 700)

    originalImageWidth = img.width
    originalImageHeight = img.height
    baseImageWidth = fittedDimensions.width
    baseImageHeight = fittedDimensions.height

    stage.width(baseImageWidth)
    stage.height(baseImageHeight)

    pageImageNode = new Konva.Image({
      x: 0,
      y: 0,
      image: img,
      width: baseImageWidth,
      height: baseImageHeight,
    })

    imageLayer.add(pageImageNode)
    updateZoom()

    canvasWrapper.value.scrollTop = 0
    canvasWrapper.value.scrollLeft = 0
  }
}

function handleMouseMove() {
  const pos = stage.getPointerPosition()
  const coordinates = getDocumentCoordinates(
    pos,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!coordinates) return

  emit('mouse-position-change', coordinates)

  if (draftRegionNode) {
    if (['polygon', 'polyline'].includes(props.activeTool)) {
      updateDraftPointRegion()
    } else {
      updateDraftRectangleRegion()
    }
  }
}

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
  stage.on('mousedown', beginRectangleRegion)
  stage.on('click', handleStageClick)
  stage.on('mouseup', commitDraftRectangleRegion)
  stage.on('dblclick', commitDraftPointRegion)
  window.addEventListener('keydown', handleKeydown)

  loadSelectedPageInKonva(props.selectedPage)
})

watch(() => props.selectedPage, (newPage) => {
  loadSelectedPageInKonva(newPage)
})

watch(() => props.zoomLevel, () => {
  updateZoom()
})

watch(
  () => [props.regions, props.selectedRegionId, props.activeTool, props.pageIndex],
  () => {
    renderRegions()
  },
  { deep: true }
)

watch(() => props.activeTool, (newTool, previousTool) => {
  if (['polygon', 'polyline'].includes(previousTool) && previousTool !== newTool) {
    cancelDraftPointRegion(false)
  }
})

onBeforeUnmount(() => {
  if (stage) {
    stage.destroy()
    stage = null
  }

  window.removeEventListener('keydown', handleKeydown)

  imageLayer = null
  regionLayer = null
  pageImageNode = null
  transformer = null
  draftRegionNode = null
  draftRegionStart = null
  draftPointRegionPoints = []
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

.canvas-wrapper--rectangle {
  cursor: crosshair;
}

.canvas-wrapper--polygon {
  cursor: crosshair;
}

.canvas-wrapper--polyline {
  cursor: crosshair;
}

.konva-container {
  display: inline-block;
  background: white;
  border: 1px solid #adb5bd;
}
</style>
