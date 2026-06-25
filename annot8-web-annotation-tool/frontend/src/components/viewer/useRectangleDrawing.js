import Konva from 'konva'
import { createRectangleRegion, toVisibleRectangle } from '../../utils/regionGeometry'
import { hasValidVisibleRectangleSize } from './rectangleCanvasGeometry'
import { MIN_VISIBLE_RECTANGLE_SIZE } from './annotationCanvasConstants'

export function useRectangleDrawing({
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
  isPointerInsideVisibleDocument,
  clampRectangleToBounds,
  clearSelectedRegion,
  addRegion,
  renderRegions,
}) {
  let draftRectangleNode = null
  let draftRectangleStart = null

  function hasValidDraftRectangleSize(region) {
    const { scaleX, scaleY } = getRegionScale()
    const visibleRectangle = toVisibleRectangle(region, scaleX, scaleY, getZoomLevel())

    return hasValidVisibleRectangleSize(visibleRectangle, MIN_VISIBLE_RECTANGLE_SIZE)
  }

  function beginRectangleRegion() {
    const stage = getStage()
    const regionLayer = getRegionLayer()

    if (!stage || !regionLayer || !hasPageImage() || getActiveTool() !== 'rectangle') return

    const pointerPosition = stage.getPointerPosition()

    if (!isPointerInsideVisibleDocument(pointerPosition)) return

    const documentStart = getClampedDocumentPointer(pointerPosition)

    if (!documentStart) return

    // A new draft replaces selection before its temporary node is added to the region layer.
    clearSelectedRegion()
    draftRectangleStart = documentStart

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
      getZoomLevel()
    )

    draftRectangleNode = new Konva.Rect({
      ...visibleStart,
      fill: `${getRegionCreationColor()}26`,
      stroke: getRegionCreationColor(),
      strokeWidth: 2,
      strokeScaleEnabled: false,
      dash: [6, 4],
    })

    regionLayer.add(draftRectangleNode)
    regionLayer.draw()
  }

  function updateDraftRectangleRegion() {
    const stage = getStage()
    const regionLayer = getRegionLayer()

    if (!stage || !draftRectangleNode || !draftRectangleStart) return

    const documentEnd = getClampedDocumentPointer()

    if (!documentEnd) return

    const draftRegion = createRectangleRegion({
      id: 'draft-region',
      pageIndex: getPageIndex(),
      start: draftRectangleStart,
      end: documentEnd,
      color: getRegionCreationColor(),
    })
    const { scaleX, scaleY } = getRegionScale()
    const visibleRegion = toVisibleRectangle(draftRegion, scaleX, scaleY, getZoomLevel())

    draftRectangleNode.x(visibleRegion.x)
    draftRectangleNode.y(visibleRegion.y)
    draftRectangleNode.width(visibleRegion.width)
    draftRectangleNode.height(visibleRegion.height)
    regionLayer.draw()
  }

  function commitDraftRectangleRegion() {
    const stage = getStage()

    if (!stage || !draftRectangleNode || !draftRectangleStart) return

    const documentEnd = getClampedDocumentPointer()

    let draftRegion = null

    if (documentEnd) {
      const region = createRectangleRegion({
        id: getNextRegionId(),
        pageIndex: getPageIndex(),
        start: draftRectangleStart,
        end: documentEnd,
        color: getRegionCreationColor(),
      })

      draftRegion = {
        ...region,
        ...clampRectangleToBounds(region, getDocumentBounds()),
      }
    }

    draftRectangleNode.destroy()
    draftRectangleNode = null
    draftRectangleStart = null

    // Keep the minimum size in visible pixels so accidental clicks do not create regions.
    if (draftRegion && hasValidDraftRectangleSize(draftRegion)) {
      addRegion(draftRegion)
    } else {
      renderRegions()
    }
  }

  function cancelDraftRectangleRegion() {
    if (!draftRectangleNode || !draftRectangleStart) return false

    draftRectangleNode.destroy()
    draftRectangleNode = null
    draftRectangleStart = null
    getRegionLayer()?.draw()

    return true
  }

  function hasDraftRectangle() {
    return Boolean(draftRectangleNode)
  }

  function disposeRectangleDrawing() {
    if (draftRectangleNode) {
      draftRectangleNode.destroy()
    }

    draftRectangleNode = null
    draftRectangleStart = null
  }

  return {
    beginRectangleRegion,
    updateDraftRectangleRegion,
    commitDraftRectangleRegion,
    cancelDraftRectangleRegion,
    hasDraftRectangle,
    disposeRectangleDrawing,
  }
}
