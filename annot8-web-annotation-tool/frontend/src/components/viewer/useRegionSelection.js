import { createRegionSpatialIndex } from '../../utils/regionSpatialIndex'
import {
  isPointInsidePolygon,
  normalizeRectangleEdges,
  toVisiblePoints,
} from '../../utils/regionGeometry'
import { compareRegionsFrontToBack } from '../../utils/regionZIndex'
import { getPointToSegmentDistance } from './pointRegionCanvasGeometry'
import {
  POINT_REGION_SEGMENT_HIT_TOLERANCE,
  REGION_DRAG_THRESHOLD,
  REGION_SELECTION_POSITION_TOLERANCE,
} from './annotationCanvasConstants'

function getScreenDistance(first, second) {
  if (!first || !second) return Number.POSITIVE_INFINITY

  return Math.hypot(first.x - second.x, first.y - second.y)
}

function areSameOrderedIds(first, second) {
  return (
    first.length === second.length &&
    first.every((id, index) => id === second[index])
  )
}

function isPointInsideRectangle(region, point) {
  const rectangle = normalizeRectangleEdges(region)

  return (
    point.x >= rectangle.left &&
    point.x <= rectangle.right &&
    point.y >= rectangle.top &&
    point.y <= rectangle.bottom
  )
}

function isNearPointRegionSegment(pointerPosition, visiblePoints, isPolygon) {
  const segmentCount = isPolygon ? visiblePoints.length : visiblePoints.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const distance = getPointToSegmentDistance(
      pointerPosition,
      visiblePoints[index],
      visiblePoints[(index + 1) % visiblePoints.length]
    )

    if (distance <= POINT_REGION_SEGMENT_HIT_TOLERANCE) {
      return true
    }
  }

  return false
}

export function useRegionSelection({
  getStage,
  getCurrentPageRegions,
  getDocumentBounds,
  getRegionScale,
  getZoomLevel,
  getDocumentCoordinatesFromPointer,
  clearSelectedPoint,
  insertPolylineEndpoint,
  selectRegion,
  clearSelectedRegion,
}) {
  const spatialIndex = createRegionSpatialIndex()
  let cycleState = null
  let pointerDownPosition = null
  let hasMovedBeyondClickThreshold = false

  function resetSelectionCycle() {
    cycleState = null
  }

  function resetPointerInteraction() {
    pointerDownPosition = null
    hasMovedBeyondClickThreshold = false
  }

  function rebuildSpatialIndex() {
    spatialIndex.rebuild(getDocumentBounds(), getCurrentPageRegions())
    resetSelectionCycle()
  }

  function clearSpatialIndex() {
    spatialIndex.clear()
    resetSelectionCycle()
  }

  function getDocumentQueryBounds(documentPoint) {
    const { scaleX, scaleY } = getRegionScale()
    const zoomLevel = getZoomLevel()
    const documentToleranceX = POINT_REGION_SEGMENT_HIT_TOLERANCE / (scaleX * zoomLevel)
    const documentToleranceY = POINT_REGION_SEGMENT_HIT_TOLERANCE / (scaleY * zoomLevel)

    return {
      x: documentPoint.x - documentToleranceX,
      y: documentPoint.y - documentToleranceY,
      width: documentToleranceX * 2,
      height: documentToleranceY * 2,
    }
  }

  function isPreciseHit(region, documentPoint, pointerPosition) {
    if (region.type === 'rectangle') {
      return isPointInsideRectangle(region, documentPoint)
    }

    if (!['polygon', 'polyline'].includes(region.type) || !Array.isArray(region.points)) {
      return false
    }

    const { scaleX, scaleY } = getRegionScale()
    const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, getZoomLevel())
    const isPolygon = region.type === 'polygon'

    if (isNearPointRegionSegment(pointerPosition, visiblePoints, isPolygon)) {
      return true
    }

    return isPolygon && isPointInsidePolygon(documentPoint, region.points)
  }

  function getOrderedHitRegionIds(documentPoint, pointerPosition) {
    const currentPageRegions = getCurrentPageRegions()
    const regionsById = new Map(
      currentPageRegions.map((region, index) => [region.id, { region, index }])
    )

    return spatialIndex
      // The spatial index is broad-phase only; precise geometry removes bounding-box false positives.
      .query(getDocumentQueryBounds(documentPoint))
      .map((regionId) => regionsById.get(regionId))
      .filter(Boolean)
      .filter(({ region }) => isPreciseHit(region, documentPoint, pointerPosition))
      .sort(compareRegionsFrontToBack)
      .map(({ region }) => region.id)
  }

  function beginPointerInteraction() {
    pointerDownPosition = getStage()?.getPointerPosition?.() ?? null
    hasMovedBeyondClickThreshold = false
  }

  function updatePointerInteraction() {
    if (!pointerDownPosition || hasMovedBeyondClickThreshold) return

    const pointerPosition = getStage()?.getPointerPosition?.()

    if (getScreenDistance(pointerDownPosition, pointerPosition) > REGION_DRAG_THRESHOLD) {
      hasMovedBeyondClickThreshold = true
      resetSelectionCycle()
    }
  }

  function markEditInteractionStarted() {
    hasMovedBeyondClickThreshold = true
    resetSelectionCycle()
  }

  function markEditInteractionFinished() {
    resetSelectionCycle()
  }

  function clearSelectionFromPointer() {
    resetSelectionCycle()
    clearSelectedPoint()
    clearSelectedRegion()
  }

  function selectFromPointer(
    pointerPosition = getStage()?.getPointerPosition?.(),
    fallbackRegionId = null
  ) {
    if (hasMovedBeyondClickThreshold) {
      hasMovedBeyondClickThreshold = false
      return true
    }

    const documentPoint = getDocumentCoordinatesFromPointer(pointerPosition)

    if (!documentPoint) {
      clearSelectionFromPointer()
      return true
    }

    if (insertPolylineEndpoint(pointerPosition)) {
      resetSelectionCycle()
      return true
    }

    let orderedRegionIds = getOrderedHitRegionIds(documentPoint, pointerPosition)

    if (orderedRegionIds.length === 0 && fallbackRegionId) {
      const fallbackRegion = getCurrentPageRegions().find(
        (region) => region.id === fallbackRegionId
      )

      orderedRegionIds = fallbackRegion ? [fallbackRegion.id] : []
    }

    if (orderedRegionIds.length === 0) {
      clearSelectionFromPointer()
      return true
    }

    const continuesCycle =
      cycleState &&
      getScreenDistance(cycleState.previousScreenPoint, pointerPosition) <=
        REGION_SELECTION_POSITION_TOLERANCE &&
      areSameOrderedIds(cycleState.orderedRegionIds, orderedRegionIds)
    const selectedIndex = continuesCycle
      ? (cycleState.selectedIndex + 1) % orderedRegionIds.length
      : 0

    cycleState = {
      previousScreenPoint: { ...pointerPosition },
      orderedRegionIds,
      selectedIndex,
    }

    clearSelectedPoint()
    selectRegion({
      regionId: orderedRegionIds[selectedIndex],
      overlappingRegionCount: orderedRegionIds.length - 1,
    })

    return true
  }

  function disposeRegionSelection() {
    spatialIndex.clear()
    cycleState = null
    pointerDownPosition = null
    hasMovedBeyondClickThreshold = false
  }

  return {
    rebuildSpatialIndex,
    clearSpatialIndex,
    resetSelectionCycle,
    resetPointerInteraction,
    beginPointerInteraction,
    updatePointerInteraction,
    markEditInteractionStarted,
    markEditInteractionFinished,
    selectFromPointer,
    disposeRegionSelection,
  }
}
