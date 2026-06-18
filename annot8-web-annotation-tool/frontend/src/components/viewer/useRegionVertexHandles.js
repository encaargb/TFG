import Konva from 'konva'
import { clampPolygonToBounds, flattenPoints, toDocumentPoints, toVisiblePoints } from '../../utils/regionGeometry'
import { POINT_REGION_VERTEX_HANDLE_RADIUS } from './annotationCanvasConstants'

export function useRegionVertexHandles({
  getZoomLevel,
  getActiveTool,
  getRegionScale,
  getVisibleBounds,
  getDocumentBounds,
  getRegionLayer,
  getSelectedPointRegionPoint,
  setSelectedPointRegionPoint,
  getVertexHandles,
  setIsVertexHandleDragging,
  clearPolylineEndpointExtensionPreview,
  autoScrollCanvasWrapper,
  setStageCursor,
  resetStageCursor,
  hasValidPointRegionSegments,
  selectRegion,
  updateRegion,
  renderRegions,
}) {
  function createRegionVertexHandles(region, pointRegionNode) {
    const { scaleX, scaleY } = getRegionScale()
    const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, getZoomLevel())
    const editedVisiblePoints = visiblePoints.map((point) => ({ ...point }))

    function selectVertexHandle(pointIndex, handle) {
      clearPolylineEndpointExtensionPreview(false)
      setSelectedPointRegionPoint({ regionId: region.id, pointIndex })
      getVertexHandles().forEach((vertexHandle) => vertexHandle.fill('#ffffff'))
      handle.fill(region.color)
      getRegionLayer().draw()
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
          getSelectedPointRegionPoint()?.regionId === region.id &&
          getSelectedPointRegionPoint().pointIndex === index
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
        if (getActiveTool() !== 'select') return

        isHandleHovered = true
        setStageCursor('grab')
      })

      handle.on('mouseleave', () => {
        isHandleHovered = false
        if (isHandleDragging) return

        resetStageCursor()
      })

      handle.on('click tap', (event) => {
        if (getActiveTool() !== 'select') return
        if (event) {
          event.cancelBubble = true
        }

        selectVertexHandle(index, handle)

        selectRegion(region.id)
      })

      handle.on('mousedown touchstart', (event) => {
        if (getActiveTool() !== 'select') return
        if (event) {
          event.cancelBubble = true
        }

        selectVertexHandle(index, handle)
        selectRegion(region.id)
      })

      handle.on('dragstart', () => {
        if (getActiveTool() !== 'select') return

        isHandleDragging = true
        setIsVertexHandleDragging(true)
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
        getRegionLayer().draw()
      })

      handle.on('dragend', () => {
        const documentPoints = toDocumentPoints(
          editedVisiblePoints,
          scaleX,
          scaleY,
          getZoomLevel()
        )

        if (hasValidPointRegionSegments(documentPoints, region.type)) {
          updateRegion({
            id: region.id,
            changes: clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()),
          })
        } else {
          renderRegions()
        }

        isHandleDragging = false
        setIsVertexHandleDragging(false)

        if (getActiveTool() === 'select' && isHandleHovered) {
          setStageCursor('grab')
          return
        }

        resetStageCursor()
      })

      return handle
    })
  }

  return {
    createRegionVertexHandles,
  }
}
