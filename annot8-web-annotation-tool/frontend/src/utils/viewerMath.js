export function getZoomPercentage(zoomLevel) {
  return Math.round(zoomLevel * 100)
}

export function getNextZoom(currentZoom, step, maxZoom) {
  if (currentZoom >= maxZoom) {
    return currentZoom
  }

  return Math.min(currentZoom + step, maxZoom)
}

export function getPreviousZoom(currentZoom, step, minZoom) {
  if (currentZoom <= minZoom) {
    return currentZoom
  }

  return Math.max(currentZoom - step, minZoom)
}

export function getFittedDimensions(imageWidth, imageHeight, maxWidth, maxHeight) {
  // The unzoomed canvas fits the page first, then zoom expands that fitted size.
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight)

  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
    scale,
  }
}

export function getVisibleDimensions(baseWidth, baseHeight, zoomLevel) {
  return {
    width: baseWidth * zoomLevel,
    height: baseHeight * zoomLevel,
  }
}

/**
 * Maps a visible Konva pointer position to clamped original document coordinates.
 */
export function getDocumentCoordinates(
  pointerPosition,
  zoomLevel,
  fittedWidth,
  fittedHeight,
  originalWidth,
  originalHeight
) {
  if (!pointerPosition) {
    return null
  }

  // Konva reports visible coordinates, so remove zoom before restoring original image pixels.
  const rawX = pointerPosition.x / zoomLevel
  const rawY = pointerPosition.y / zoomLevel

  const scaleX = originalWidth / fittedWidth
  const scaleY = originalHeight / fittedHeight

  const originalX = rawX * scaleX
  const originalY = rawY * scaleY

  const x = Math.round(Math.max(0, Math.min(originalWidth, originalX)))
  const y = Math.round(Math.max(0, Math.min(originalHeight, originalY)))

  return { x, y }
}
