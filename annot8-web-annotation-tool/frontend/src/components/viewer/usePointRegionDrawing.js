import Konva from 'konva'
import { hasValidVisiblePointRegionSegments } from '../../utils/pointRegionValidation'
import {
  clampPointToBounds,
  clampPolygonToBounds,
  createPolygonRegion,
  createPolylineRegion,
  flattenPoints,
  isDrawableRegion,
  toVisiblePoints,
} from '../../utils/regionGeometry'
import {
  MIN_VISIBLE_SEGMENT_LENGTH,
  POINT_REGION_DRAG_POINT_DISTANCE,
  POLYGON_CLOSE_DISTANCE,
} from './annotationCanvasConstants'

export function usePointRegionDrawing({
  getStage,
  getRegionLayer,
  hasPageImage,
  getActiveTool,
  getPageIndex,
  getNextRegionId,
  getZoomLevel,
  getRegionCreationColor,
  getRegionScale,
  getDocumentBounds,
  getClampedDocumentPointer,
  clearSelectedRegion,
  addRegion,
  renderRegions,
}) {
  let draftPointRegionNode = null
  let draftPointRegionPoints = []
  let skipNextPointRegionClick = false
  let skipNextPointRegionClickPosition = null
  let pointRegionDragStart = null

  function isPointRegionToolActive() {
    return ['polygon', 'polyline'].includes(getActiveTool())
  }

  function updateDraftPointPreview() {
    const stage = getStage()
    const regionLayer = getRegionLayer()

    if (!stage || !regionLayer || !draftPointRegionNode || !isPointRegionToolActive()) return

    const pointerPosition = stage.getPointerPosition()
    const shouldClosePolygon =
      getActiveTool() === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)
    const documentHoverPoint = getClampedDocumentPointer()

    // Draft data stays in document coordinates; only the transient Konva line is visible-space.
    const visiblePoints = toVisiblePoints(
      documentHoverPoint && !shouldClosePolygon
        ? [...draftPointRegionPoints, documentHoverPoint]
        : draftPointRegionPoints,
      getRegionScale().scaleX,
      getRegionScale().scaleY,
      getZoomLevel()
    )

    draftPointRegionNode.points(flattenPoints(visiblePoints))
    draftPointRegionNode.closed(shouldClosePolygon)
    draftPointRegionNode.fill(
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
      getZoomLevel()
    )
    const distance = Math.hypot(
      pointerPosition.x - firstVisiblePoint.x,
      pointerPosition.y - firstVisiblePoint.y
    )

    return distance <= POLYGON_CLOSE_DISTANCE
  }

  function isDraftPointRegionSegmentTooShort(documentPoint) {
    if (draftPointRegionPoints.length === 0) return false

    // Segment usability is judged on screen so it remains clickable at the current zoom.
    const { scaleX, scaleY } = getRegionScale()
    const [previousVisiblePoint, nextVisiblePoint] = toVisiblePoints(
      [draftPointRegionPoints.at(-1), documentPoint],
      scaleX,
      scaleY,
      getZoomLevel()
    )
    const distance = Math.hypot(
      nextVisiblePoint.x - previousVisiblePoint.x,
      nextVisiblePoint.y - previousVisiblePoint.y
    )

    return distance < MIN_VISIBLE_SEGMENT_LENGTH
  }

  function hasValidDraftPointRegionSegments(points, type) {
    const { scaleX, scaleY } = getRegionScale()
    const visiblePoints = toVisiblePoints(points, scaleX, scaleY, getZoomLevel())

    return hasValidVisiblePointRegionSegments(visiblePoints, type, MIN_VISIBLE_SEGMENT_LENGTH)
  }

  function addDraftPoint(pointerPosition, shouldClearSelection = true) {
    const stage = getStage()
    const regionLayer = getRegionLayer()

    if (!stage || !regionLayer || !hasPageImage()) return
    if (!isPointRegionToolActive()) return

    const documentPoint = getClampedDocumentPointer(pointerPosition)

    if (!documentPoint) return

    if (getActiveTool() === 'polygon' && isPointerNearFirstPolygonPoint(pointerPosition)) {
      commitDraftPointRegion()
      return true
    }

    if (isDraftPointRegionSegmentTooShort(documentPoint)) return false

    if (shouldClearSelection) {
      clearSelectedRegion()
    }

    draftPointRegionPoints.push(clampPointToBounds(documentPoint, getDocumentBounds()))

    if (!draftPointRegionNode) {
      draftPointRegionNode = new Konva.Line({
        points: [],
        closed: false,
        fill: getActiveTool() === 'polygon' ? `${getRegionCreationColor()}12` : 'transparent',
        stroke: getRegionCreationColor(),
        strokeWidth: 2,
        strokeScaleEnabled: false,
        dash: [6, 4],
      })
      regionLayer.add(draftPointRegionNode)
    }

    updateDraftPointPreview()

    return true
  }

  function beginPointRegion() {
    return addDraftPoint(getStage()?.getPointerPosition())
  }

  function beginPointRegionDrag(event) {
    if (!isPointRegionToolActive()) return
    if (event?.evt?.detail > 1) return

    const pointerPosition = getStage()?.getPointerPosition()

    if (beginPointRegion()) {
      pointRegionDragStart = pointerPosition
      skipNextPointRegionClick = true
      skipNextPointRegionClickPosition = pointerPosition
    }
  }

  function addPointRegionDragReleasePoint() {
    if (!isPointRegionToolActive() || !pointRegionDragStart) return

    const pointerPosition = getStage()?.getPointerPosition()
    const distance = pointerPosition
      ? Math.hypot(
          pointerPosition.x - pointRegionDragStart.x,
          pointerPosition.y - pointRegionDragStart.y
        )
      : 0

    pointRegionDragStart = null

    if (distance <= POINT_REGION_DRAG_POINT_DISTANCE) return

    if (addDraftPoint(pointerPosition, false)) {
      skipNextPointRegionClick = true
      skipNextPointRegionClickPosition = pointerPosition
    }
  }

  function handlePointRegionClick() {
    // Konva emits a click after mousedown; suppress the duplicate point from a drag gesture.
    if (skipNextPointRegionClick) {
      const pointerPosition = getStage()?.getPointerPosition()
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
  }

  function cancelDraftPointRegion(shouldRender = true) {
    if (draftPointRegionNode) {
      draftPointRegionNode.destroy()
    }

    draftPointRegionNode = null
    draftPointRegionPoints = []
    skipNextPointRegionClick = false
    skipNextPointRegionClickPosition = null
    pointRegionDragStart = null

    if (shouldRender) {
      renderRegions()
    }
  }

  function commitDraftPointRegion() {
    if (!draftPointRegionNode || !isPointRegionToolActive()) return

    const createRegion = getActiveTool() === 'polygon' ? createPolygonRegion : createPolylineRegion
    const region = createRegion({
      id: getNextRegionId(),
      pageIndex: getPageIndex(),
      points: draftPointRegionPoints,
      color: getRegionCreationColor(),
    })
    const draftRegion = {
      ...region,
      ...clampPolygonToBounds(region, getDocumentBounds()),
    }

    draftPointRegionNode.destroy()
    draftPointRegionNode = null
    draftPointRegionPoints = []
    skipNextPointRegionClick = false
    skipNextPointRegionClickPosition = null
    pointRegionDragStart = null

    // Reject degenerate drafts instead of adding geometry that cannot be edited reliably.
    if (
      isDrawableRegion(draftRegion) &&
      hasValidDraftPointRegionSegments(draftRegion.points, draftRegion.type)
    ) {
      addRegion(draftRegion)
    } else {
      renderRegions()
    }
  }

  function hasDraftPointRegion() {
    return Boolean(draftPointRegionNode)
  }

  function disposePointRegionDrawing() {
    if (draftPointRegionNode) {
      draftPointRegionNode.destroy()
    }

    draftPointRegionNode = null
    draftPointRegionPoints = []
    skipNextPointRegionClick = false
    skipNextPointRegionClickPosition = null
    pointRegionDragStart = null
  }

  return {
    beginPointRegionDrag,
    addPointRegionDragReleasePoint,
    handlePointRegionClick,
    updateDraftPointPreview,
    commitDraftPointRegion,
    cancelDraftPointRegion,
    hasDraftPointRegion,
    disposePointRegionDrawing,
  }
}
