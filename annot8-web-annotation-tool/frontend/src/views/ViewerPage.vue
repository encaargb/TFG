<script setup>
import { computed, nextTick, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  BBadge,
  BButton,
  BButtonGroup,
  BButtonToolbar,
  BNavbar,
} from 'bootstrap-vue-next'
import Konva from 'konva'
import PageSidebar from '../components/viewer/PageSidebar.vue'
import { ProjectDocumentModel } from '../models/ProjectDocumentModel'
import { fetchProjectDocument, saveProjectRegions } from '../services/documentApi'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getNextZoom,
  getPreviousZoom,
  getVisibleDimensions,
  getZoomPercentage,
} from '../utils/viewerMath'
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
} from '../utils/regionGeometry'

const documentId = ref(ProjectDocumentModel.id)
const pages = ref(ProjectDocumentModel.pages)
const regions = ref(ProjectDocumentModel.regions)
const selectedIndex = ref(0)

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const ZOOM_STEP = 0.25
const REGION_COLOR = '#0d6efd'
const POLYGON_CLOSE_DISTANCE = 8
const MIN_VISIBLE_REGION_SIZE = 4

const zoomLevel = ref(1)
const activeTool = ref('select')
const selectedRegionId = ref(null)
const sidebarCollapsed = ref(false)

const selectedPage = computed(() => pages.value[selectedIndex.value])
const zoomPercentage = computed(() => getZoomPercentage(zoomLevel.value))
const currentPageRegions = computed(() =>
  regions.value.filter((region) => region.pageIndex === selectedIndex.value)
)

const mousePos = ref({ x: 0, y: 0 })

// Page changes always return to the default zoom so every page starts from
// a predictable view state.
function resetZoom() {
  zoomLevel.value = 1
  updateZoom()
}

function goToPreviousPage() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
    resetZoom()
  }
}

function goToNextPage() {
  if (selectedIndex.value < pages.value.length - 1) {
    selectedIndex.value++
    resetZoom()
  }
}

function selectPage(index) {
  selectedIndex.value = index
  selectedRegionId.value = null
  resetZoom()
}

async function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  await nextTick()
  updateZoom()
}

function setActiveTool(tool) {
  if (['polygon', 'polyline'].includes(activeTool.value) && activeTool.value !== tool) {
    cancelDraftPointRegion()
  }

  activeTool.value = tool

  if (tool === 'select') {
    renderRegions()
    return
  }

  if (tool !== 'select') {
    selectedRegionId.value = null
    renderRegions()
  }
}

function deleteSelectedRegion() {
  if (!selectedRegionId.value) return

  regions.value = regions.value.filter((region) => region.id !== selectedRegionId.value)
  persistRegions()
  selectedRegionId.value = null
  renderRegions()
}

function clearSelectedRegion() {
  if (!selectedRegionId.value) return

  selectedRegionId.value = null
  renderRegions()
}

// Saves the whole region list. The mock API intentionally stores a full
// replacement instead of individual region patches.
function persistRegions() {
  void saveProjectRegions(documentId.value, regions.value).catch((error) => {
    console.error(error)
  })
}

// Keeps generated region ids increasing after data is loaded from the backend.
function updateRegionSequence() {
  regionSequence = regions.value.reduce((highestId, region) => {
    const match = String(region.id).match(/^region-(\d+)$/)
    return match ? Math.max(highestId, Number(match[1])) : highestId
  }, 0)
}

function handleKeydown(event) {
  if (['polygon', 'polyline'].includes(activeTool.value) && event.key === 'Enter') {
    commitDraftPointRegion()
    return
  }

  if (['polygon', 'polyline'].includes(activeTool.value) && event.key === 'Escape') {
    cancelDraftPointRegion()
    return
  }

  if (event.key === 'Escape') {
    clearSelectedRegion()
    return
  }

  if (event.key !== 'Delete' && event.key !== 'Backspace') return

  deleteSelectedRegion()
}

function zoomIn() {
  if (zoomLevel.value < MAX_ZOOM) {
    zoomLevel.value = getNextZoom(zoomLevel.value, ZOOM_STEP, MAX_ZOOM)
    updateZoom()
  }
}

function zoomOut() {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = getPreviousZoom(zoomLevel.value, ZOOM_STEP, MIN_ZOOM)
    updateZoom()
  }
}

// ---------------- KONVA ----------------

const canvasContainer = ref(null)
const canvasWrapper = ref(null)

let stage = null
let imageLayer = null
let regionLayer = null
let pageImageNode = null
let transformer = null
let draftRegionNode = null
let draftRegionStart = null
let draftPointRegionPoints = []
let regionSequence = 0
let imageLoadSequence = 0

let baseImageWidth = 0
let baseImageHeight = 0
let originalImageWidth = 0
let originalImageHeight = 0

// Regions are stored in original document coordinates. This scale converts
// them to the fitted image size used by Konva.
function getRegionScale() {
  return {
    scaleX: baseImageWidth / originalImageWidth,
    scaleY: baseImageHeight / originalImageHeight,
  }
}

// Bounds are based on the original page size, not the scaled canvas size.
function getDocumentBounds() {
  return {
    width: originalImageWidth,
    height: originalImageHeight,
  }
}

// Applies the current zoom to the Konva stage, page image, and region overlay.
function updateZoom() {
  if (!stage || !pageImageNode) return

  const { width: visibleWidth, height: visibleHeight } = getVisibleDimensions(
    baseImageWidth,
    baseImageHeight,
    zoomLevel.value
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
  return getVisibleDimensions(baseImageWidth, baseImageHeight, zoomLevel.value)
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
  const visibleRegion = toVisibleRectangle(region, scaleX, scaleY, zoomLevel.value)

  const node = new Konva.Rect({
    ...visibleRegion,
    id: region.id,
    draggable: activeTool.value === 'select',
    fill: `${region.color}26`,
    stroke: region.color,
    strokeWidth: selectedRegionId.value === region.id ? 3 : 2,
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
    if (activeTool.value !== 'select') return
    selectedRegionId.value = region.id
    renderRegions()
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
    // Konva transforms can leave scale values on the node. The visible size is
    // converted back into document coordinates and the node scale is reset.
    const visibleRectangle = syncTransformedRectangleNode(node)

    const documentRectangle = clampRectangleToBounds(
      toDocumentRectangle(visibleRectangle, scaleX, scaleY, zoomLevel.value),
      getDocumentBounds()
    )

    Object.assign(region, documentRectangle)
    persistRegions()

    if (typeof node.scaleX === 'function') node.scaleX(1)
    if (typeof node.scaleY === 'function') node.scaleY(1)

    renderRegions()
  })

  return node
}

function createPointRegionNode(region) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, zoomLevel.value)
  const flatVisiblePoints = flattenPoints(visiblePoints)
  const isPolygon = region.type === 'polygon'

  const node = new Konva.Line({
    points: flatVisiblePoints,
    closed: isPolygon,
    id: region.id,
    draggable: activeTool.value === 'select',
    fill: isPolygon ? `${region.color}26` : 'transparent',
    stroke: region.color,
    strokeWidth: selectedRegionId.value === region.id ? 3 : 2,
    strokeScaleEnabled: false,
    dragBoundFunc: (position) => clampVisiblePolygonDelta(visiblePoints, position),
  })

  node.on('click tap', () => {
    if (activeTool.value !== 'select') return
    selectedRegionId.value = region.id
    renderRegions()
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
    const documentPoints = toDocumentPoints(movedVisiblePoints, scaleX, scaleY, zoomLevel.value)

    Object.assign(region, clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()))
    persistRegions()
    renderRegions()
  })

  return node
}

function createPointRegionVertexHandles(region, pointRegionNode) {
  const { scaleX, scaleY } = getRegionScale()
  const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, zoomLevel.value)
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
      if (activeTool.value !== 'select') return
      selectedRegionId.value = region.id
      renderRegions()
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
        zoomLevel.value
      )

      Object.assign(region, clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()))
      persistRegions()
      renderRegions()
    })

    return handle
  })
}

// Creates the interactive Konva node for an existing stored region.
function createRegionNode(region) {
  if (region.type === 'polygon' || region.type === 'polyline') {
    return createPointRegionNode(region)
  }

  return createRectangleRegionNode(region)
}

// Rebuilds the region layer for the current page and attaches the transformer
// to the selected region when the select tool is active.
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

    if (region.id === selectedRegionId.value) {
      selectedNode = node
    }

    if (
      (region.type === 'polygon' || region.type === 'polyline') &&
      region.id === selectedRegionId.value &&
      activeTool.value === 'select'
    ) {
      createPointRegionVertexHandles(region, node).forEach((handle) => regionLayer.add(handle))
    }
  })

  regionLayer.add(transformer)

  if (
    selectedNode &&
    activeTool.value === 'select' &&
    !['polygon', 'polyline'].includes(
      currentPageRegions.value.find((region) => region.id === selectedRegionId.value)?.type
    )
  ) {
    transformer.nodes([selectedNode])
  } else {
    transformer.nodes([])
  }

  regionLayer.draw()
}

// Starts drawing a rectangle region at the current pointer position.
function beginRectangleRegion() {
  if (!stage || !regionLayer || !pageImageNode || activeTool.value !== 'rectangle') return

  const pointerPosition = stage.getPointerPosition()
  const documentStart = getDocumentCoordinates(
    pointerPosition,
    zoomLevel.value,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentStart) return

  selectedRegionId.value = null
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
    zoomLevel.value
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

// Updates the temporary rectangle while the user is dragging.
function updateDraftRectangleRegion() {
  if (!stage || !draftRegionNode || !draftRegionStart) return

  const pointerPosition = stage.getPointerPosition()
  const documentEnd = getDocumentCoordinates(
    pointerPosition,
    zoomLevel.value,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentEnd) return

  const draftRegion = createRectangleRegion({
    id: 'draft-region',
    pageIndex: selectedIndex.value,
    start: draftRegionStart,
    end: documentEnd,
    color: REGION_COLOR,
  })
  const { scaleX, scaleY } = getRegionScale()
  const visibleRegion = toVisibleRectangle(draftRegion, scaleX, scaleY, zoomLevel.value)

  draftRegionNode.x(visibleRegion.x)
  draftRegionNode.y(visibleRegion.y)
  draftRegionNode.width(visibleRegion.width)
  draftRegionNode.height(visibleRegion.height)
  regionLayer.draw()
}

function updateDraftPointRegion() {
  if (!stage || !draftRegionNode || !['polygon', 'polyline'].includes(activeTool.value)) return

  const pointerPosition = stage.getPointerPosition()
  const shouldClosePolygon =
    activeTool.value === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)
  const documentHoverPoint = getDocumentCoordinates(
    pointerPosition,
    zoomLevel.value,
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
    zoomLevel.value
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
    zoomLevel.value
  )
  const distance = Math.hypot(
    pointerPosition.x - firstVisiblePoint.x,
    pointerPosition.y - firstVisiblePoint.y
  )

  return distance <= POLYGON_CLOSE_DISTANCE
}

// Converts the temporary rectangle into a stored region if it is large enough.
function commitDraftRectangleRegion() {
  if (!stage || !draftRegionNode || !draftRegionStart) return

  const pointerPosition = stage.getPointerPosition()
  const documentEnd = getDocumentCoordinates(
    pointerPosition,
    zoomLevel.value,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  let draftRegion = null

  if (documentEnd) {
    const region = createRectangleRegion({
      id: `region-${regionSequence + 1}`,
      pageIndex: selectedIndex.value,
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
    regionSequence += 1
    regions.value.push(draftRegion)
    persistRegions()
    selectedRegionId.value = draftRegion.id
  }

  renderRegions()
}

function beginPointRegion() {
  if (!stage || !regionLayer || !pageImageNode) return
  if (!['polygon', 'polyline'].includes(activeTool.value)) return

  const pointerPosition = stage.getPointerPosition()
  const documentPoint = getDocumentCoordinates(
    pointerPosition,
    zoomLevel.value,
    baseImageWidth,
    baseImageHeight,
    originalImageWidth,
    originalImageHeight
  )

  if (!documentPoint) return

  if (activeTool.value === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)) {
    commitDraftPointRegion()
    return
  }

  selectedRegionId.value = null
  draftPointRegionPoints.push(clampPointToBounds(documentPoint, getDocumentBounds()))

  if (!draftRegionNode) {
    draftRegionNode = new Konva.Line({
      points: [],
      closed: false,
      fill: activeTool.value === 'polygon' ? `${REGION_COLOR}12` : 'transparent',
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

  if (activeTool.value !== 'select') return

  const clickTarget = event?.target

  if (clickTarget && clickTarget !== stage && clickTarget !== pageImageNode) return

  clearSelectedRegion()
}

function cancelDraftPointRegion() {
  if (draftRegionNode) {
    draftRegionNode.destroy()
  }

  draftRegionNode = null
  draftPointRegionPoints = []
  renderRegions()
}

function commitDraftPointRegion() {
  if (!draftRegionNode || !['polygon', 'polyline'].includes(activeTool.value)) return

  const createRegion = activeTool.value === 'polygon' ? createPolygonRegion : createPolylineRegion
  const region = createRegion({
    id: `region-${regionSequence + 1}`,
    pageIndex: selectedIndex.value,
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
    regionSequence += 1
    regions.value.push(draftRegion)
    persistRegions()
    selectedRegionId.value = draftRegion.id
  }

  renderRegions()
}

// Loads a page image into Konva. The load sequence prevents stale image loads
// from overwriting the currently selected page after fast navigation.
function loadSelectedPageInKonva(src) {
  if (!imageLayer || !stage) return

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

    const maxWidth = 1000
    const maxHeight = 700

    const fittedDimensions = getFittedDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight
    )

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
      height: baseImageHeight
    })

    imageLayer.add(pageImageNode)
    updateZoom()

    // Reset scroll after changing pages so the next page starts at the top-left.
    if (canvasWrapper.value) {
      canvasWrapper.value.scrollTop = 0
      canvasWrapper.value.scrollLeft = 0
    }
  }
}

onMounted(() => {
  stage = new Konva.Stage({
    container: canvasContainer.value,
    width: 1000,
    height: 700
  })

  imageLayer = new Konva.Layer()
  regionLayer = new Konva.Layer()
  stage.add(imageLayer)
  stage.add(regionLayer)

  stage.on('mousemove', () => {
    const pos = stage.getPointerPosition()
    const coordinates = getDocumentCoordinates(
      pos,
      zoomLevel.value,
      baseImageWidth,
      baseImageHeight,
      originalImageWidth,
      originalImageHeight
    )

    if (!coordinates) return

    mousePos.value = coordinates

    if (draftRegionNode) {
      if (['polygon', 'polyline'].includes(activeTool.value)) {
        updateDraftPointRegion()
      } else {
        updateDraftRectangleRegion()
      }
    }
  })
  stage.on('mousedown', beginRectangleRegion)
  stage.on('click', handleStageClick)
  stage.on('mouseup', commitDraftRectangleRegion)
  stage.on('dblclick', commitDraftPointRegion)
  window.addEventListener('keydown', handleKeydown)

  if (selectedPage.value) {
    loadSelectedPageInKonva(selectedPage.value)
  }

  fetchProjectDocument()
    .then((document) => {
      if (document === ProjectDocumentModel) return

      documentId.value = document.id
      pages.value = document.pages
      regions.value = document.regions
      ProjectDocumentModel.regions = document.regions
      updateRegionSequence()

      if (selectedPage.value) {
        loadSelectedPageInKonva(selectedPage.value)
      }
    })
    .catch((error) => {
      console.error(error)
    })
})

watch(selectedPage, (newPage) => {
  loadSelectedPageInKonva(newPage)
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
      <BNavbar
        class="viewer-controls border-bottom px-3 py-2"
        variant="body"
        aria-label="Viewer controls"
      >
        <BButtonToolbar
          class="d-flex align-items-center gap-2 flex-wrap w-100"
          aria-label="Viewer actions"
        >
          <BButtonGroup size="sm" aria-label="Page navigation">
            <BButton
              type="button"
              variant="outline-secondary"
              @click="goToPreviousPage"
              :disabled="selectedIndex === 0"
            >
              Previous
            </BButton>

            <BButton
              type="button"
              variant="outline-secondary"
              @click="goToNextPage"
              :disabled="selectedIndex === pages.length - 1"
            >
              Next
            </BButton>
          </BButtonGroup>

          <BBadge variant="secondary">
            Page {{ selectedIndex + 1 }} / {{ pages.length }}
          </BBadge>

          <div class="vr d-none d-md-block"></div>

          <BButtonGroup size="sm" aria-label="Region tools">
            <BButton
              type="button"
              :variant="activeTool === 'select' ? 'primary' : 'outline-secondary'"
              :aria-pressed="activeTool === 'select'"
              @click="setActiveTool('select')"
            >
              Select
            </BButton>
            <BButton
              type="button"
              :variant="activeTool === 'rectangle' ? 'primary' : 'outline-secondary'"
              :aria-pressed="activeTool === 'rectangle'"
              @click="setActiveTool('rectangle')"
            >
              Rectangle
            </BButton>
            <BButton
              type="button"
              :variant="activeTool === 'polygon' ? 'primary' : 'outline-secondary'"
              :aria-pressed="activeTool === 'polygon'"
              @click="setActiveTool('polygon')"
            >
              Polygon
            </BButton>
            <BButton
              type="button"
              :variant="activeTool === 'polyline' ? 'primary' : 'outline-secondary'"
              :aria-pressed="activeTool === 'polyline'"
              @click="setActiveTool('polyline')"
            >
              Polyline
            </BButton>
          </BButtonGroup>

          <BBadge variant="light" class="border">
            Regions: {{ currentPageRegions.length }}
          </BBadge>

          <BButton
            type="button"
            size="sm"
            variant="outline-danger"
            :disabled="!selectedRegionId"
            @click="deleteSelectedRegion"
          >
            Delete
          </BButton>

          <div class="vr d-none d-md-block"></div>

          <BButtonGroup size="sm" aria-label="Zoom controls">
            <BButton
              type="button"
              variant="outline-secondary"
              @click="zoomOut"
              :disabled="zoomLevel <= MIN_ZOOM"
            >
              -
            </BButton>
            <BButton type="button" variant="outline-secondary" @click="resetZoom">
              Reset
            </BButton>
            <BButton
              type="button"
              variant="outline-secondary"
              @click="zoomIn"
              :disabled="zoomLevel >= MAX_ZOOM"
            >
              +
            </BButton>
          </BButtonGroup>

          <BBadge variant="light" class="border">
            Zoom: {{ zoomPercentage }}%
          </BBadge>

          <BBadge variant="light" class="coords border ms-md-auto">
            ({{ mousePos.x }}, {{ mousePos.y }})
          </BBadge>
        </BButtonToolbar>
      </BNavbar>

      <div
        ref="canvasWrapper"
        class="canvas-wrapper flex-grow-1 overflow-auto p-4"
        :class="`canvas-wrapper--${activeTool}`"
      >
        <div ref="canvasContainer" class="konva-container shadow-sm"></div>
      </div>

      <footer class="status-bar px-3">
        <div class="d-flex align-items-center status-bar-items">
          <span class="status-item">
            Page {{ selectedIndex + 1 }} / {{ pages.length }}
          </span>
          <span class="status-item">
            Zoom {{ zoomPercentage }}%
          </span>
          <span class="status-item">
            Tool {{ activeTool }}
          </span>
          <span class="status-item">
            Regions {{ currentPageRegions.length }}
          </span>
          <span class="status-item status-coords ms-md-auto">
            X {{ mousePos.x }} · Y {{ mousePos.y }}
          </span>
        </div>
      </footer>
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

.coords {
  font-family: monospace;
}

.status-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1030;
  flex-shrink: 0;
  min-height: 24px;
  background: #e9ecef;
  border-top: 1px solid #adb5bd;
  color: #495057;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.72rem;
  line-height: 23px;
}

.status-bar-items {
  min-height: 23px;
}

.status-item {
  padding: 0 0.75rem;
  white-space: nowrap;
}

.status-item:first-child {
  padding-left: 0;
}

.status-item:last-child {
  border-right: 0;
  padding-right: 0;
}

.status-coords {
  color: #212529;
  text-align: right;
}

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
