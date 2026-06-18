<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Konva from 'konva'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getVisibleDimensions,
} from '../../utils/viewerMath'
import {
  getPointRegionMinimumPointCount,
  hasValidVisiblePointRegionSegments,
} from '../../utils/pointRegionValidation'
import {
  clampVisiblePointRegionDelta,
  getClosestPointRegionSegmentIndex,
} from './pointRegionCanvasGeometry'
import {
  applyVisibleRectangleToNode,
  clampTransformerBox,
  clampVisibleRectangle,
  getAnchorAwareVisibleRectangle,
  getNodeVisibleRectangle,
  getTransformedRectangleEdges,
  hasValidVisibleRectangleSize,
} from './rectangleCanvasGeometry'
import { useCanvasAutoScroll } from './useCanvasAutoScroll'
import { useCanvasCursor } from './useCanvasCursor'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
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
import {
  MIN_VISIBLE_RECTANGLE_SIZE,
  MIN_VISIBLE_SEGMENT_LENGTH,
  POINT_REGION_DRAG_POINT_DISTANCE,
  POINT_REGION_SEGMENT_HIT_TOLERANCE,
  POINT_REGION_VERTEX_HANDLE_RADIUS,
  POLYGON_CLOSE_DISTANCE,
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
let pageImageNode = null
let transformer = null
let draftRegionNode = null
let draftRegionStart = null
let draftPointRegionPoints = []
let polylineEndpointExtensionPreviewNode = null
let skipNextPointRegionClick = false
let skipNextPointRegionClickPosition = null
let pointRegionDragStart = null
let vertexHandles = []
let imageLoadSequence = 0
let isVertexHandleDragging = false
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
  return Boolean(draftRegionNode || getDraggedRegionId() || isVertexHandleDragging)
}

const { autoScrollCanvasWrapper } = useCanvasAutoScroll({
  canvasWrapper,
  isInteractionActive: hasActiveCanvasInteraction,
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
    getVisibleBounds(),
    MIN_VISIBLE_RECTANGLE_SIZE
  )
  applyVisibleRectangleToNode(node, visibleRectangle)

  return visibleRectangle
}

function syncResizedRectangleNode(node, region, scaleX, scaleY) {
  const visibleRectangle = getAnchorAwareVisibleRectangle(
    toVisibleRectangle(region, scaleX, scaleY, props.zoomLevel),
    getNodeVisibleRectangle(node),
    transformer?.getActiveAnchor?.(),
    getVisibleBounds(),
    MIN_VISIBLE_RECTANGLE_SIZE
  )
  applyVisibleRectangleToNode(node, visibleRectangle)

  return visibleRectangle
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
      const clamped = clampVisibleRectangle(
        {
          x: position.x,
          y: position.y,
          width: node.width(),
          height: node.height(),
        },
        getVisibleBounds()
      )

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

  node.on('dragmove', (event) => {
    autoScrollCanvasWrapper(event)
    applyVisibleRectangleToNode(
      node,
      clampVisibleRectangle(getNodeVisibleRectangle(node), getVisibleBounds())
    )
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
      ),
      transformer?.getActiveAnchor?.()
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
    dragBoundFunc: (position) => clampVisiblePointRegionDelta(
      visiblePoints,
      position,
      getVisibleBounds()
    ),
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
    const documentPoint = getDocumentCoordinates(
      pointerPosition,
      props.zoomLevel,
      baseImageWidth,
      baseImageHeight,
      originalImageWidth,
      originalImageHeight
    )

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

  node.on('dragmove', (event) => {
    autoScrollCanvasWrapper(event)
    const delta = clampVisiblePointRegionDelta(
      visiblePoints,
      { x: node.x(), y: node.y() },
      getVisibleBounds()
    )
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
    const delta = clampVisiblePointRegionDelta(
      visiblePoints,
      { x: node.x(), y: node.y() },
      getVisibleBounds()
    )
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
    clearPolylineEndpointExtensionPreview(false)
    selectedPointRegionPoint = { regionId: region.id, pointIndex }
    vertexHandles.forEach((vertexHandle) => vertexHandle.fill('#ffffff'))
    handle.fill(region.color)
    regionLayer.draw()
  }

  return visiblePoints.map((point, index) => {
    let isHandleHovered = false
    let isHandleDragging = false

    const handle = new Konva.Circle({
      x: point.x,
      y: point.y,
      radius: POINT_REGION_VERTEX_HANDLE_RADIUS,
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

    handle.on('mouseenter', () => {
      if (props.activeTool !== 'select') return

      isHandleHovered = true
      setStageCursor('grab')
    })

    handle.on('mouseleave', () => {
      isHandleHovered = false
      if (isHandleDragging) return

      resetStageCursor()
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

    handle.on('dragstart', () => {
      if (props.activeTool !== 'select') return

      isHandleDragging = true
      isVertexHandleDragging = true
      setStageCursor('grabbing')
    })

    handle.on('dblclick dbltap', (event) => {
      if (event) {
        event.cancelBubble = true
      }
    })

    handle.on('dragmove', (event) => {
      autoScrollCanvasWrapper(event)
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

      if (hasValidPointRegionSegments(documentPoints, region.type)) {
        emit('update-region', {
          id: region.id,
          changes: clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()),
        })
      } else {
        renderRegions()
      }

      isHandleDragging = false
      isVertexHandleDragging = false

      if (props.activeTool === 'select' && isHandleHovered) {
        setStageCursor('grab')
        return
      }

      resetStageCursor()
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
    fill: `${getRegionCreationColor()}26`,
    stroke: getRegionCreationColor(),
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
    color: getRegionCreationColor(),
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
  draftRegionNode.fill(
    shouldClosePolygon ? `${getRegionCreationColor()}26` : `${getRegionCreationColor()}12`
  )
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

function hasValidPointRegionSegments(points, type) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(points, scaleX, scaleY, props.zoomLevel)

  return hasValidVisiblePointRegionSegments(visiblePoints, type, MIN_VISIBLE_SEGMENT_LENGTH)
}

function hasValidDraftRectangleSize(region) {
  const { scaleX, scaleY } = getRegionScale()
  const visibleRectangle = toVisibleRectangle(region, scaleX, scaleY, props.zoomLevel)

  return hasValidVisibleRectangleSize(visibleRectangle, MIN_VISIBLE_RECTANGLE_SIZE)
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
      color: getRegionCreationColor(),
    })

    draftRegion = {
      ...region,
      ...clampRectangleToBounds(region, getDocumentBounds()),
    }
  }

  draftRegionNode.destroy()
  draftRegionNode = null
  draftRegionStart = null

  if (draftRegion && hasValidDraftRectangleSize(draftRegion)) {
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
      fill: props.activeTool === 'polygon' ? `${getRegionCreationColor()}12` : 'transparent',
      stroke: getRegionCreationColor(),
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

function resetTransientInteractionState() {
  cancelDraftRectangleRegion()
  cancelDraftPointRegion(false)
  clearSelectedPointRegionPoint()
  clearPolylineEndpointExtensionPreview(false)
  clearRegionCursorState()
  resetStageCursor()

  pointRegionDragStart = null
  skipNextPointRegionClick = false
  skipNextPointRegionClickPosition = null
  isVertexHandleDragging = false
  selectedPointRegionPoint = null
  suppressPointRegionClick = false
  suppressPointRegionDoubleClick = false
}

function commitDraftPointRegion() {
  if (!draftRegionNode || !['polygon', 'polyline'].includes(props.activeTool)) return

  const createRegion = props.activeTool === 'polygon' ? createPolygonRegion : createPolylineRegion
  const region = createRegion({
    id: props.nextRegionId,
    pageIndex: props.pageIndex,
    points: draftPointRegionPoints,
    color: getRegionCreationColor(),
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

  if (
    isDrawableRegion(draftRegion) &&
    hasValidPointRegionSegments(draftRegion.points, draftRegion.type)
  ) {
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
  autoScrollCanvasWrapper(event)

  const pos = stage.getPointerPosition()
  updateCreationToolCursor(pos)

  const coordinates = getDocumentCoordinates(
    pos,
    props.zoomLevel,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!coordinates) {
    clearPolylineEndpointExtensionPreview()
    return
  }

  emit('mouse-position-change', coordinates)

  if (draftRegionNode) {
    if (['polygon', 'polyline'].includes(props.activeTool)) {
      updateDraftPointRegion()
    } else {
      updateDraftRectangleRegion()
    }
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

  loadSelectedPageInKonva(props.selectedPage)
})

watch(() => props.selectedPage, (newPage) => {
  loadSelectedPageInKonva(newPage)
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
  pageImageNode = null
  transformer = null
  draftRegionNode = null
  draftRegionStart = null
  draftPointRegionPoints = []
  polylineEndpointExtensionPreviewNode = null
  skipNextPointRegionClick = false
  skipNextPointRegionClickPosition = null
  pointRegionDragStart = null
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
