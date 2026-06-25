import Konva from 'konva'
import {
  getDocumentCoordinates,
  getFittedDimensions,
  getVisibleDimensions,
} from '../../utils/viewerMath'

export function useCanvasPageImage({
  getStage,
  getImageLayer,
  canvasWrapper,
  getZoomLevel,
  renderRegions,
  onPageImageLoaded = () => {},
}) {
  let pageImageNode = null
  let imageLoadSequence = 0
  let baseImageWidth = 0
  let baseImageHeight = 0
  let originalImageWidth = 0
  let originalImageHeight = 0

  function getRegionScale() {
    // This is the original-page to fitted-canvas ratio, before the user zoom is applied.
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

  function getVisibleBounds() {
    return getVisibleDimensions(baseImageWidth, baseImageHeight, getZoomLevel())
  }

  function getDocumentCoordinatesFromPointer(pointerPosition) {
    return getDocumentCoordinates(
      pointerPosition,
      getZoomLevel(),
      baseImageWidth,
      baseImageHeight,
      originalImageWidth,
      originalImageHeight
    )
  }

  function hasPageImage() {
    return Boolean(pageImageNode)
  }

  function isPageImageNode(node) {
    return node === pageImageNode
  }

  function updateZoom() {
    const stage = getStage()
    const imageLayer = getImageLayer()

    if (!stage || !pageImageNode) return

    const { width: visibleWidth, height: visibleHeight } = getVisibleBounds()

    stage.width(visibleWidth)
    stage.height(visibleHeight)

    pageImageNode.x(0)
    pageImageNode.y(0)
    pageImageNode.width(visibleWidth)
    pageImageNode.height(visibleHeight)

    // Region nodes use the same visible coordinate system and must be rebuilt after zoom changes.
    imageLayer.draw()
    renderRegions()
  }

  function loadSelectedPage(src) {
    const stage = getStage()
    const imageLayer = getImageLayer()

    if (!imageLayer || !stage || !src) return

    const loadId = imageLoadSequence + 1
    imageLoadSequence = loadId

    const img = new window.Image()

    img.onload = () => {
      // Ignore a completed image request after navigation has selected a newer page.
      if (loadId !== imageLoadSequence || !getStage() || !getImageLayer()) return

      if (pageImageNode) {
        pageImageNode.destroy()
        pageImageNode = null
      }

      const fittedDimensions = getFittedDimensions(img.width, img.height, 1000, 700)
      const currentStage = getStage()
      const currentImageLayer = getImageLayer()

      originalImageWidth = img.width
      originalImageHeight = img.height
      baseImageWidth = fittedDimensions.width
      baseImageHeight = fittedDimensions.height

      currentStage.width(baseImageWidth)
      currentStage.height(baseImageHeight)

      pageImageNode = new Konva.Image({
        x: 0,
        y: 0,
        image: img,
        width: baseImageWidth,
        height: baseImageHeight,
      })

      currentImageLayer.add(pageImageNode)
      updateZoom()
      onPageImageLoaded()

      canvasWrapper.value.scrollTop = 0
      canvasWrapper.value.scrollLeft = 0
    }

    img.src = src
  }

  function disposePageImage() {
    // Invalidate outstanding image callbacks before releasing the current Konva node.
    imageLoadSequence += 1

    if (pageImageNode) {
      pageImageNode.destroy()
      pageImageNode = null
    }

    baseImageWidth = 0
    baseImageHeight = 0
    originalImageWidth = 0
    originalImageHeight = 0
  }

  return {
    loadSelectedPage,
    updateZoom,
    getRegionScale,
    getDocumentBounds,
    getVisibleBounds,
    getDocumentCoordinatesFromPointer,
    hasPageImage,
    isPageImageNode,
    disposePageImage,
  }
}
