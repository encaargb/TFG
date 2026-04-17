export function getZoomPercentage(zoomLevel) {
  return Math.round(zoomLevel * 100)
}

export function getNextZoom(currentZoom, factor, maxZoom) {
  if (currentZoom >= maxZoom) {
    return currentZoom
  }

  return Math.min(currentZoom * factor, maxZoom)
}

export function getPreviousZoom(currentZoom, factor, minZoom) {
  if (currentZoom <= minZoom) {
    return currentZoom
  }

  return Math.max(currentZoom / factor, minZoom)
}

export function getFittedDimensions(imageWidth, imageHeight, maxWidth, maxHeight) {
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

export function getDocumentCoordinates(pointerPosition, zoomLevel, baseWidth, baseHeight) {
  if (!pointerPosition) {
    return null
  }

  const rawX = pointerPosition.x / zoomLevel
  const rawY = pointerPosition.y / zoomLevel

  const x = Math.round(Math.max(0, Math.min(baseWidth, rawX)))
  const y = Math.round(Math.max(0, Math.min(baseHeight, rawY)))

  return { x, y }
}
