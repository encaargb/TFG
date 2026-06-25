import { toDocumentRectangle, toVisibleRectangle } from '../../utils/regionGeometry'
import {
  applyVisibleRectangleToNode,
  clampVisibleRectangle,
  getAnchorAwareVisibleRectangle,
  getNodeVisibleRectangle,
  getTransformedRectangleEdges,
} from './rectangleCanvasGeometry'
import { MIN_VISIBLE_RECTANGLE_SIZE } from './annotationCanvasConstants'

export function useRectangleEditing({
  getZoomLevel,
  getRegionLayer,
  getVisibleBounds,
  getDocumentBounds,
  clampRectangleToBounds,
  autoScrollCanvasWrapper,
  beginRegionDrag,
  endRegionDrag,
  hideActiveEditHandles,
  showActiveEditHandles,
  getSelectedRegionId,
  updateRegion,
}) {
  function syncTransformedRectangleNode(node) {
    const visibleRectangle = clampVisibleRectangle(
      getNodeVisibleRectangle(node),
      getVisibleBounds(),
      MIN_VISIBLE_RECTANGLE_SIZE
    )
    applyVisibleRectangleToNode(node, visibleRectangle)

    return visibleRectangle
  }

  function syncResizedRectangleNode(node, region, transformer, scaleX, scaleY) {
    const visibleRectangle = getAnchorAwareVisibleRectangle(
      toVisibleRectangle(region, scaleX, scaleY, getZoomLevel()),
      getNodeVisibleRectangle(node),
      transformer?.getActiveAnchor?.(),
      getVisibleBounds(),
      MIN_VISIBLE_RECTANGLE_SIZE
    )
    applyVisibleRectangleToNode(node, visibleRectangle)

    return visibleRectangle
  }

  function getRectangleDragBoundPosition(node, position) {
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
  }

  function attachRectangleEditing({ node, region, transformer, scaleX, scaleY }) {
    node.on('dragmove', (event) => {
      autoScrollCanvasWrapper(event)
      applyVisibleRectangleToNode(
        node,
        clampVisibleRectangle(getNodeVisibleRectangle(node), getVisibleBounds())
      )
      getRegionLayer()?.draw()
    })

    node.on('dragstart', () => {
      beginRegionDrag(region.id)

      if (getSelectedRegionId() === region.id) {
        hideActiveEditHandles()
      }
    })

    node.on('transform', () => {
      syncResizedRectangleNode(node, region, transformer, scaleX, scaleY)
      getRegionLayer()?.draw()
    })

    // Commit only at the end of a gesture so ViewerPage persists one stable document-space shape.
    const commitRegionChange = () => {
      const visibleRectangle = transformer?.getActiveAnchor?.()
        ? syncResizedRectangleNode(node, region, transformer, scaleX, scaleY)
        : syncTransformedRectangleNode(node)

      const documentRectangle = getTransformedRectangleEdges(
        region,
        clampRectangleToBounds(
          toDocumentRectangle(visibleRectangle, scaleX, scaleY, getZoomLevel()),
          getDocumentBounds()
        ),
        transformer?.getActiveAnchor?.()
      )

      updateRegion({ id: region.id, changes: documentRectangle })

      if (typeof node.scaleX === 'function') node.scaleX(1)
      if (typeof node.scaleY === 'function') node.scaleY(1)

      if (getSelectedRegionId() === region.id) {
        showActiveEditHandles()
      }
    }

    node.on('dragend', () => {
      commitRegionChange()
      endRegionDrag(region.id)
    })

    node.on('transformend', commitRegionChange)
  }

  return {
    attachRectangleEditing,
    getRectangleDragBoundPosition,
  }
}
