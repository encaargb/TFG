import { clampPolygonToBounds, toDocumentPoints } from '../../utils/regionGeometry'
import { clampVisiblePointRegionDelta } from './pointRegionCanvasGeometry'

export function usePointRegionDragging({
  getZoomLevel,
  getRegionLayer,
  getVisibleBounds,
  getDocumentBounds,
  autoScrollCanvasWrapper,
  beginRegionDrag,
  endRegionDrag,
  hideActiveEditHandles,
  showActiveEditHandles,
  getSelectedRegionId,
  preparePointRegionDrag,
  markEditInteractionStarted = () => {},
  markEditInteractionFinished = () => {},
  updateRegion,
}) {
  function getPointRegionDragBoundPosition(visiblePoints, position) {
    return clampVisiblePointRegionDelta(
      visiblePoints,
      position,
      getVisibleBounds()
    )
  }

  function attachPointRegionDragging({ node, region, visiblePoints, scaleX, scaleY }) {
    node.on('dragmove', (event) => {
      autoScrollCanvasWrapper(event)
      const delta = clampVisiblePointRegionDelta(
        visiblePoints,
        { x: node.x(), y: node.y() },
        getVisibleBounds()
      )
      node.x(delta.x)
      node.y(delta.y)
      getRegionLayer().draw()
    })

    node.on('dragstart', () => {
      preparePointRegionDrag()
      markEditInteractionStarted()
      beginRegionDrag(region.id)

      if (getSelectedRegionId() === region.id) {
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
      // The node offset is visible-space; persist translated vertices in document coordinates.
      const documentPoints = toDocumentPoints(movedVisiblePoints, scaleX, scaleY, getZoomLevel())

      updateRegion({
        id: region.id,
        changes: clampPolygonToBounds({ points: documentPoints }, getDocumentBounds()),
      })

      if (getSelectedRegionId() === region.id) {
        showActiveEditHandles()
      }

      endRegionDrag(region.id)
      markEditInteractionFinished()
    })
  }

  return {
    getPointRegionDragBoundPosition,
    attachPointRegionDragging,
  }
}
