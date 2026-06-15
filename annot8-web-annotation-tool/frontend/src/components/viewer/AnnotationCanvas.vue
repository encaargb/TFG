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
  toEdgeRectangle,
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
const POINT_REGION_SEGMENT_HIT_TOLERANCE = 8
const POINT_REGION_DRAG_POINT_DISTANCE = 8
const MIN_VISIBLE_SEGMENT_LENGTH = 4
const MIN_VISIBLE_RECTANGLE_SIZE = 4

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
let skipNextPointRegionClick = false
let skipNextPointRegionClickPosition = null
let pointRegionDragStart = null
let vertexHandles = []
let imageLoadSequence = 0
let hoveredRegionId = null
let draggedRegionId = null
let selectedPointRegionPoint = null
let suppressPointRegionClick = false
let suppressPointRegionDoubleClick = false

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

function setStageCursor(cursor) {
  const container = stage?.container?.()

  if (container) {
    container.style.cursor = cursor
  }
}

function resetStageCursor() {
  setStageCursor('default')
}

function handleRegionMouseEnter(regionId) {
  hoveredRegionId = regionId

  if (props.activeTool === 'select' && !draggedRegionId) {
    setStageCursor('grab')
  }
}

function handleRegionMouseLeave(regionId) {
  if (hoveredRegionId === regionId) {
    hoveredRegionId = null
  }

  if (!draggedRegionId) {
    resetStageCursor()
  }
}

function beginRegionDrag(regionId) {
  draggedRegionId = regionId

  if (props.activeTool === 'select') {
    setStageCursor('grabbing')
  }
}

function endRegionDrag(regionId) {
  if (draggedRegionId === regionId) {
    draggedRegionId = null
  }

  if (props.activeTool === 'select' && hoveredRegionId === regionId) {
    setStageCursor('grab')
    return
  }

  resetStageCursor()
}

function attachRegionCursorHandlers(node, regionId) {
  node.on('mouseenter', () => handleRegionMouseEnter(regionId))
  node.on('mouseleave', () => handleRegionMouseLeave(regionId))
}

function getNodeRegionId(node) {
  return typeof node?.id === 'function' ? node.id() : node?.config?.id
}

function resetStaleRegionCursor(event) {
  if (props.activeTool !== 'select' || draggedRegionId || !hoveredRegionId) return

  const targetRegionId = getNodeRegionId(event?.target)

  if (targetRegionId === hoveredRegionId) return
  if (currentPageRegions.value.some((region) => region.id === targetRegionId)) {
    hoveredRegionId = targetRegionId
    setStageCursor('grab')
    return
  }

  hoveredRegionId = null
  resetStageCursor()
}

function clearSelectedPointRegionPoint() {
  selectedPointRegionPoint = null
}

function getClampedDocumentPointer(pointerPosition = stage?.getPointerPosition()) {
  const documentPoint = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  return documentPoint ? clampPointToBounds(documentPoint, getDocumentBounds()) : null
}

function isPointerInsideVisibleDocument(pointerPosition) {
  if (!pointerPosition || !baseImageWidth || !baseImageHeight) return false

  const bounds = getVisibleBounds()

  return (
    pointerPosition.x >= 0 &&
    pointerPosition.x <= bounds.width &&
    pointerPosition.y >= 0 &&
    pointerPosition.y <= bounds.height
  )
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
    newBox.width < MIN_VISIBLE_RECTANGLE_SIZE ||
    newBox.height < MIN_VISIBLE_RECTANGLE_SIZE
  ) {
    return oldBox
  }

  return {
    ...newBox,
    ...clampVisibleRectangle(newBox, MIN_VISIBLE_RECTANGLE_SIZE),
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

function syncTransformedRectangleNode(node) {
  const visibleRectangle = clampVisibleRectangle(
    getNodeVisibleRectangle(node),
    MIN_VISIBLE_RECTANGLE_SIZE
  )
  applyVisibleRectangleToNode(node, visibleRectangle)

  return visibleRectangle
}

function clampValue(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function getPointToSegmentDistance(point, segmentStart, segmentEnd) {
  const segmentX = segmentEnd.x - segmentStart.x
  const segmentY = segmentEnd.y - segmentStart.y
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y)
  }

  const projection = (
    ((point.x - segmentStart.x) * segmentX + (point.y - segmentStart.y) * segmentY) /
    segmentLengthSquared
  )
  const clampedProjection = clampValue(projection, 0, 1)
  const closestPoint = {
    x: segmentStart.x + clampedProjection * segmentX,
    y: segmentStart.y + clampedProjection * segmentY,
  }

  return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y)
}

function getClosestPointRegionSegmentIndex(pointerPosition, visiblePoints, closed = false) {
  if (!pointerPosition) return -1

  let closestSegmentIndex = -1
  let closestDistance = Number.POSITIVE_INFINITY
  const segmentCount = closed ? visiblePoints.length : visiblePoints.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const distance = getPointToSegmentDistance(
      pointerPosition,
      visiblePoints[index],
      visiblePoints[(index + 1) % visiblePoints.length]
    )

    if (distance < closestDistance) {
      closestDistance = distance
      closestSegmentIndex = index
    }
  }

  return closestDistance <= POINT_REGION_SEGMENT_HIT_TOLERANCE ? closestSegmentIndex : -1
}

function getAnchorAwareVisibleRectangle(originalRectangle, transformedRectangle) {
  const anchor = transformer?.getActiveAnchor?.()

  if (!anchor) {
    return clampVisibleRectangle(transformedRectangle, MIN_VISIBLE_RECTANGLE_SIZE)
  }

  const bounds = getVisibleBounds()
  const original = normalizeVisibleRectangle(originalRectangle)
  const transformed = normalizeVisibleRectangle(transformedRectangle)

  let left = original.x
  let top = original.y
  let right = original.x + original.width
  let bottom = original.y + original.height

  if (anchor.includes('left')) {
    left = clampValue(transformed.x, 0, right - MIN_VISIBLE_RECTANGLE_SIZE)
  }

  if (anchor.includes('right')) {
    right = clampValue(
      transformed.x + transformed.width,
      left + MIN_VISIBLE_RECTANGLE_SIZE,
      bounds.width
    )
  }

  if (anchor.includes('top')) {
    top = clampValue(transformed.y, 0, bottom - MIN_VISIBLE_RECTANGLE_SIZE)
  }

  if (anchor.includes('bottom')) {
    bottom = clampValue(
      transformed.y + transformed.height,
      top + MIN_VISIBLE_RECTANGLE_SIZE,
      bounds.height
    )
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function syncResizedRectangleNode(node, region, scaleX, scaleY) {
  const visibleRectangle = getAnchorAwareVisibleRectangle(
    toVisibleRectangle(region, scaleX, scaleY, props.zoomLevel),
    getNodeVisibleRectangle(node)
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

function getTransformedRectangleEdges(originalRegion, transformedRectangle) {
  const originalRectangle = toEdgeRectangle(originalRegion)
  const nextRectangle = toEdgeRectangle(transformedRectangle)
  const anchor = transformer?.getActiveAnchor?.()

  if (!anchor) {
    return nextRectangle
  }

  return {
    left: anchor.includes('left') ? nextRectangle.left : originalRectangle.left,
    top: anchor.includes('top') ? nextRectangle.top : originalRectangle.top,
    right: anchor.includes('right') ? nextRectangle.right : originalRectangle.right,
    bottom: anchor.includes('bottom') ? nextRectangle.bottom : originalRectangle.bottom,
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

  attachRegionCursorHandlers(node, region.id)

  node.on('click tap', () => {
    if (props.activeTool !== 'select') return
    clearSelectedPointRegionPoint()
    emit('select-region', region.id)
  })

  node.on('dragmove', () => {
    applyVisibleRectangleToNode(node, clampVisibleRectangle(getNodeVisibleRectangle(node)))
    regionLayer.draw()
  })

  node.on('dragstart', () => {
    beginRegionDrag(region.id)

    if (props.selectedRegionId === region.id) {
      hideActiveEditHandles()
    }
  })

  node.on('transform', () => {
    syncResizedRectangleNode(node, region, scaleX, scaleY)
    regionLayer.draw()
  })

  const commitRegionChange = () => {
    const visibleRectangle = transformer?.getActiveAnchor?.()
      ? syncResizedRectangleNode(node, region, scaleX, scaleY)
      : syncTransformedRectangleNode(node)

    const documentRectangle = getTransformedRectangleEdges(
      region,
      clampRectangleToBounds(
        toDocumentRectangle(visibleRectangle, scaleX, scaleY, props.zoomLevel),
        getDocumentBounds()
      )
    )

    emit('update-region', { id: region.id, changes: documentRectangle })

    if (typeof node.scaleX === 'function') node.scaleX(1)
    if (typeof node.scaleY === 'function') node.scaleY(1)

    if (props.selectedRegionId === region.id) {
      showActiveEditHandles()
    }
  }

  node.on('dragend', () => {
    commitRegionChange()
    endRegionDrag(region.id)
  })

  node.on('transformend', commitRegionChange)

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
      isPolygon
    )
    const documentPoint = getDocumentCoordinates(
      pointerPosition,
      props.zoomLevel,
      baseImageWidth,
      baseImageHeight,
      originalImageWidth,
      originalImageHeight
    )

    if (segmentIndex === -1 || !documentPoint) return false

    clearSelectedPointRegionPoint()
    const insertIndex = segmentIndex + 1

    emit('update-region', {
      id: region.id,
      changes: {
        points: [
          ...region.points.slice(0, insertIndex),
          documentPoint,
          ...region.points.slice(insertIndex),
        ],
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

  node.on('dragmove', () => {
    const delta = clampVisiblePolygonDelta(visiblePoints, { x: node.x(), y: node.y() })
    node.x(delta.x)
    node.y(delta.y)
    regionLayer.draw()
  })

  node.on('dragstart', () => {
    suppressPointRegionClick = true
    suppressPointRegionDoubleClick = true
    clearSelectedPointRegionPoint()
    beginRegionDrag(region.id)

    if (props.selectedRegionId === region.id) {
      hideActiveEditHandles()
    }
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

    if (props.selectedRegionId === region.id) {
      showActiveEditHandles()
    }

    endRegionDrag(region.id)
  })

  return node
}

function createPointRegionVertexHandles(region, pointRegionNode) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, props.zoomLevel)
  const editedVisiblePoints = visiblePoints.map((point) => ({ ...point }))

  function selectVertexHandle(pointIndex, handle) {
    selectedPointRegionPoint = { regionId: region.id, pointIndex }
    vertexHandles.forEach((vertexHandle) => vertexHandle.fill('#ffffff'))
    handle.fill(region.color)
    regionLayer.draw()
  }

  return visiblePoints.map((point, index) => {
    const handle = new Konva.Circle({
      x: point.x,
      y: point.y,
      radius: 5,
      draggable: true,
      fill:
        selectedPointRegionPoint?.regionId === region.id &&
        selectedPointRegionPoint.pointIndex === index
          ? region.color
          : '#ffffff',
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

    handle.on('click tap', (event) => {
      if (props.activeTool !== 'select') return
      if (event) {
        event.cancelBubble = true
      }

      selectVertexHandle(index, handle)

      emit('select-region', region.id)
    })

    handle.on('mousedown touchstart', (event) => {
      if (props.activeTool !== 'select') return
      if (event) {
        event.cancelBubble = true
      }

      selectVertexHandle(index, handle)
      emit('select-region', region.id)
    })

    handle.on('dblclick dbltap', (event) => {
      if (event) {
        event.cancelBubble = true
      }
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
  vertexHandles = []
  transformer = new Konva.Transformer({
    rotateEnabled: false,
    flipEnabled: false,
    keepRatio: false,
    anchorSize: 10,
    anchorCornerRadius: 5,
    anchorFill: '#ffffff',
    anchorStroke: '#0d6efd',
    anchorStrokeWidth: 2,
    borderStroke: '#0d6efd',
    borderStrokeWidth: 1,
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
      vertexHandles = createPointRegionVertexHandles(region, node)
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

function beginRectangleRegion() {
  if (!stage || !regionLayer || !pageImageNode || props.activeTool !== 'rectangle') return

  const pointerPosition = stage.getPointerPosition()

  if (!isPointerInsideVisibleDocument(pointerPosition)) return

  const documentStart = getClampedDocumentPointer(pointerPosition)

  if (!documentStart) return

  emit('clear-selected-region')
  draftRegionStart = documentStart

  const { scaleX, scaleY } = getRegionScale()
  const visibleStart = toVisibleRectangle(
    {
      left: documentStart.x,
      top: documentStart.y,
      right: documentStart.x,
      bottom: documentStart.y,
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

  const documentEnd = getClampedDocumentPointer()

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
  const documentHoverPoint = getClampedDocumentPointer()

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

function isDraftPointRegionSegmentTooShort(documentPoint) {
  if (draftPointRegionPoints.length === 0) return false

  const { scaleX, scaleY } = getRegionScale()
  const [previousVisiblePoint, nextVisiblePoint] = toVisiblePoints(
    [draftPointRegionPoints.at(-1), documentPoint],
    scaleX,
    scaleY,
    props.zoomLevel
  )
  const distance = Math.hypot(
    nextVisiblePoint.x - previousVisiblePoint.x,
    nextVisiblePoint.y - previousVisiblePoint.y
  )

  return distance < MIN_VISIBLE_SEGMENT_LENGTH
}

function commitDraftRectangleRegion() {
  if (!stage || !draftRegionNode || !draftRegionStart) return

  const documentEnd = getClampedDocumentPointer()

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
  } else {
    renderRegions()
  }
}

function cancelDraftRectangleRegion() {
  if (!draftRegionNode || !draftRegionStart) return false

  draftRegionNode.destroy()
  draftRegionNode = null
  draftRegionStart = null
  regionLayer?.draw()

  return true
}

function addDraftPointRegionPoint(pointerPosition, shouldClearSelection = true) {
  if (!stage || !regionLayer || !pageImageNode) return
  if (!['polygon', 'polyline'].includes(props.activeTool)) return

  const documentPoint = getClampedDocumentPointer(pointerPosition)

  if (!documentPoint) return

  if (props.activeTool === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)) {
    commitDraftPointRegion()
    return true
  }

  if (isDraftPointRegionSegmentTooShort(documentPoint)) return false

  if (shouldClearSelection) {
    emit('clear-selected-region')
  }

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

  return true
}

function beginPointRegion() {
  return addDraftPointRegionPoint(stage?.getPointerPosition())
}

function handleStageMouseDown(event) {
  beginRectangleRegion()

  if (['polygon', 'polyline'].includes(props.activeTool)) {
    if (event?.evt?.detail > 1) return

    const pointerPosition = stage?.getPointerPosition()

    if (beginPointRegion()) {
      pointRegionDragStart = pointerPosition
      skipNextPointRegionClick = true
      skipNextPointRegionClickPosition = pointerPosition
    }
  }
}

function addPointRegionDragReleasePoint() {
  if (!['polygon', 'polyline'].includes(props.activeTool) || !pointRegionDragStart) return

  const pointerPosition = stage?.getPointerPosition()
  const distance = pointerPosition
    ? Math.hypot(
        pointerPosition.x - pointRegionDragStart.x,
        pointerPosition.y - pointRegionDragStart.y
      )
    : 0

  pointRegionDragStart = null

  if (distance <= POINT_REGION_DRAG_POINT_DISTANCE) return

  if (addDraftPointRegionPoint(pointerPosition, false)) {
    skipNextPointRegionClick = true
    skipNextPointRegionClickPosition = pointerPosition
  }
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

  const documentPoint = getDocumentCoordinates(
    pointerPosition,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentPoint) return false

  clearSelectedPointRegionPoint()
  emit('update-region', {
    id: region.id,
    changes: {
      points:
        pointIndex === 0
          ? [documentPoint, ...region.points]
          : [...region.points, documentPoint],
    },
  })

  return true
}

function handleStageClick(event) {
  if (event?.evt?.detail > 1) return

  if (skipNextPointRegionClick) {
    const pointerPosition = stage?.getPointerPosition()
    const shouldSkipClick =
      !skipNextPointRegionClickPosition ||
      !pointerPosition ||
      Math.hypot(
        pointerPosition.x - skipNextPointRegionClickPosition.x,
        pointerPosition.y - skipNextPointRegionClickPosition.y
      ) <= POINT_REGION_DRAG_POINT_DISTANCE

    skipNextPointRegionClick = false
    skipNextPointRegionClickPosition = null

    if (!shouldSkipClick) {
      beginPointRegion()
    }
  } else {
    beginPointRegion()
  }

  if (props.activeTool !== 'select') return

  const clickTarget = event?.target

  if (clickTarget && clickTarget !== stage && clickTarget !== pageImageNode) return

  if (insertPolylineEndpointPoint(stage.getPointerPosition())) return

  clearSelectedPointRegionPoint()
  emit('clear-selected-region')
}

function cancelDraftPointRegion(shouldRender = true) {
  if (draftRegionNode) {
    draftRegionNode.destroy()
  }

  draftRegionNode = null
  draftPointRegionPoints = []
  skipNextPointRegionClick = false
  skipNextPointRegionClickPosition = null
  pointRegionDragStart = null

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
  skipNextPointRegionClick = false
  skipNextPointRegionClickPosition = null
  pointRegionDragStart = null

  if (isDrawableRegion(draftRegion)) {
    emit('add-region', draftRegion)
  } else {
    renderRegions()
  }
}

function deleteSelectedPointRegionPoint() {
  if (!selectedPointRegionPoint) return false

  const { regionId, pointIndex } = selectedPointRegionPoint
  const region = props.regions.find((candidate) => candidate.id === regionId)
  clearSelectedPointRegionPoint()

  if (!region || !['polygon', 'polyline'].includes(region.type)) return false

  const minimumPointCount = region.type === 'polygon' ? 3 : 2

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

function handleKeydown(event) {
  if (['polygon', 'polyline'].includes(props.activeTool) && event.key === 'Enter') {
    commitDraftPointRegion()
    return
  }

  if (['polygon', 'polyline'].includes(props.activeTool) && event.key === 'Escape') {
    cancelDraftPointRegion()
    return
  }

  if (
    props.activeTool === 'rectangle' &&
    event.key === 'Escape' &&
    cancelDraftRectangleRegion()
  ) {
    return
  }

  if (event.key === 'Escape') {
    emit('clear-selected-region')
    return
  }

  if (event.key !== 'Delete' && event.key !== 'Backspace') return

  if (deleteSelectedPointRegionPoint()) return

  emit('delete-selected-region')
}

function loadSelectedPageInKonva(src) {
  if (!imageLayer || !stage || !src) return

  const loadId = imageLoadSequence + 1
  imageLoadSequence = loadId

  const img = new window.Image()

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

  img.src = src

}

function handleMouseMove(event) {
  resetStaleRegionCursor(event)

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

function handleMouseLeave() {
  emit('mouse-position-change', null)
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
  stage.on('mouseleave', handleMouseLeave)
  stage.on('mousedown', handleStageMouseDown)
  stage.on('click', handleStageClick)
  stage.on('mouseup', handleStageMouseUp)
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

watch(() => props.selectedRegionId, (newSelectedRegionId) => {
  if (selectedPointRegionPoint?.regionId !== newSelectedRegionId) {
    clearSelectedPointRegionPoint()
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
  if (['polygon', 'polyline'].includes(previousTool) && previousTool !== newTool) {
    cancelDraftPointRegion(false)
  }

  if (previousTool === 'select' && newTool !== previousTool) {
    hoveredRegionId = null
    draggedRegionId = null
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

  window.removeEventListener('keydown', handleKeydown)

  imageLayer = null
  regionLayer = null
  pageImageNode = null
  transformer = null
  draftRegionNode = null
  draftRegionStart = null
  draftPointRegionPoints = []
  skipNextPointRegionClick = false
  skipNextPointRegionClickPosition = null
  pointRegionDragStart = null
  vertexHandles = []
  hoveredRegionId = null
  draggedRegionId = null
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
