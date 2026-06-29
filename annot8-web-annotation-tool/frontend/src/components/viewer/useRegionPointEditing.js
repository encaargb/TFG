import Konva from 'konva'
import { getPointRegionMinimumPointCount } from '../../utils/pointRegionValidation'
import {
  flattenPoints,
  toVisiblePoints,
} from '../../utils/regionGeometry'
import { getClosestPointRegionSegmentIndex } from './pointRegionCanvasGeometry'
import { POINT_REGION_SEGMENT_HIT_TOLERANCE, REGION_COLOR } from './annotationCanvasConstants'

export function useRegionPointEditing({
  getActiveTool,
  getSelectedRegionId,
  getRegions,
  getStage,
  getRegionLayer,
  getRegionScale,
  getZoomLevel,
  getDocumentBounds,
  getDocumentCoordinatesFromPointer,
  getClampedDocumentPointer,
  isPointerInsideVisibleDocument,
  isVertexHandleDragging,
  hasValidPointRegionSegments,
  deleteSelectedRegion,
  updateRegion,
}) {
  let selectedPointRegionPoint = null
  let polylineEndpointExtensionPreviewNode = null

  function getSelectedPoint() {
    return selectedPointRegionPoint
  }

  function setSelectedPoint(point) {
    selectedPointRegionPoint = point
  }

  function clearPolylineEndpointPreview(shouldDraw = true) {
    if (!polylineEndpointExtensionPreviewNode) return

    polylineEndpointExtensionPreviewNode.destroy()
    polylineEndpointExtensionPreviewNode = null

    if (shouldDraw) {
      getRegionLayer()?.draw()
    }
  }

  function clearSelectedPoint() {
    selectedPointRegionPoint = null
    clearPolylineEndpointPreview()
  }

  function getPolylineEndpointPreviewContext() {
    if (getActiveTool() !== 'select' || !selectedPointRegionPoint) return null
    if (isVertexHandleDragging()) return null

    const { regionId, pointIndex } = selectedPointRegionPoint
    const region = getRegions().find((candidate) => candidate.id === regionId)

    if (!region || region.type !== 'polyline' || getSelectedRegionId() !== region.id) return null
    if (pointIndex !== 0 && pointIndex !== region.points.length - 1) return null

    return {
      endpoint: region.points[pointIndex],
      isFirstEndpoint: pointIndex === 0,
      region,
    }
  }

  function updatePolylineEndpointPreview(pointerPosition = getStage()?.getPointerPosition()) {
    const stage = getStage()
    const regionLayer = getRegionLayer()

    if (!stage || !regionLayer || !isPointerInsideVisibleDocument(pointerPosition)) {
      clearPolylineEndpointPreview()
      return
    }

    const previewContext = getPolylineEndpointPreviewContext()
    const documentHoverPoint = getClampedDocumentPointer(pointerPosition)

    if (!previewContext || !documentHoverPoint) {
      clearPolylineEndpointPreview()
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
      getZoomLevel()
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

  function insertPointIntoSegment({ region, visiblePoints, isPolygon, pointerPosition, segmentIndex }) {
    if (
      !['polygon', 'polyline'].includes(region.type) ||
      getActiveTool() !== 'select' ||
      getSelectedRegionId() !== region.id
    ) {
      return false
    }

    const targetSegmentIndex = Number.isInteger(segmentIndex)
      ? segmentIndex
      : getInsertPointSegmentIndex({ visiblePoints, isPolygon, pointerPosition })
    const documentPoint = getDocumentCoordinatesFromPointer(pointerPosition)

    if (targetSegmentIndex === -1 || !documentPoint) return false

    return insertPointAtSegmentIndex({ region, segmentIndex: targetSegmentIndex, documentPoint })
  }

  function getInsertPointSegmentIndex({ visiblePoints, isPolygon, pointerPosition }) {
    return getClosestPointRegionSegmentIndex(
      pointerPosition,
      visiblePoints,
      isPolygon,
      POINT_REGION_SEGMENT_HIT_TOLERANCE
    )
  }

  function insertPointAtSegmentIndex({ region, segmentIndex, documentPoint }) {
    // Inserting after the hit segment preserves the existing polygon or polyline order.
    const insertIndex = segmentIndex + 1
    const points = [
      ...region.points.slice(0, insertIndex),
      documentPoint,
      ...region.points.slice(insertIndex),
    ]

    if (!hasValidPointRegionSegments(points, region.type)) return false

    clearSelectedPoint()

    updateRegion({
      id: region.id,
      changes: {
        points,
      },
    })

    return true
  }

  function insertPolylineEndpoint(pointerPosition) {
    if (getActiveTool() !== 'select' || !selectedPointRegionPoint) return false
    if (!isPointerInsideVisibleDocument(pointerPosition)) return false

    const { regionId, pointIndex } = selectedPointRegionPoint
    const region = getRegions().find((candidate) => candidate.id === regionId)

    if (!region || region.type !== 'polyline' || getSelectedRegionId() !== region.id) return false
    if (pointIndex !== 0 && pointIndex !== region.points.length - 1) return false

    const documentPoint = getDocumentCoordinatesFromPointer(pointerPosition)

    if (!documentPoint) return false

    const points =
      pointIndex === 0
        ? [documentPoint, ...region.points]
        : [...region.points, documentPoint]

    if (!hasValidPointRegionSegments(points, region.type)) return false

    clearSelectedPoint()
    updateRegion({
      id: region.id,
      changes: {
        points,
      },
    })

    return true
  }

  function deleteSelectedPoint() {
    if (!selectedPointRegionPoint) return false

    const { regionId, pointIndex } = selectedPointRegionPoint
    const region = getRegions().find((candidate) => candidate.id === regionId)
    clearSelectedPoint()

    if (!region || !['polygon', 'polyline'].includes(region.type)) return false

    const minimumPointCount = getPointRegionMinimumPointCount(region.type)

    if (region.points.length <= minimumPointCount) {
      // Removing a required vertex removes the whole shape rather than leaving invalid geometry.
      deleteSelectedRegion()
      return true
    }

    updateRegion({
      id: region.id,
      changes: {
        points: region.points.filter((_, index) => index !== pointIndex),
      },
    })

    return true
  }

  function canDeleteSelectedPoint() {
    if (!selectedPointRegionPoint) return false

    const { regionId } = selectedPointRegionPoint
    const region = getRegions().find((candidate) => candidate.id === regionId)

    if (!region || !['polygon', 'polyline'].includes(region.type)) return false

    return region.points.length > getPointRegionMinimumPointCount(region.type)
  }

  function prepareRegionClick() {
    clearSelectedPoint()
  }

  function resetPointEditing() {
    clearSelectedPoint()
    clearPolylineEndpointPreview(false)
  }

  function disposePointEditing() {
    if (polylineEndpointExtensionPreviewNode) {
      polylineEndpointExtensionPreviewNode.destroy()
    }

    selectedPointRegionPoint = null
    polylineEndpointExtensionPreviewNode = null
  }

  return {
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
  }
}
