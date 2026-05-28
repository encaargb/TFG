export function createRectangleRegion({
  id,
  pageIndex,
  start,
  end,
  color = '#0d6efd',
}) {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  return {
    id,
    pageIndex,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    color,
    annotations: [],
  }
}

export function isDrawableRegion(region, minimumSize = 4) {
  return region.width >= minimumSize && region.height >= minimumSize
}

export function clampRectangleToBounds(rectangle, bounds) {
  const width = Math.min(Math.max(0, rectangle.width), bounds.width)
  const height = Math.min(Math.max(0, rectangle.height), bounds.height)
  const maxX = Math.max(0, bounds.width - width)
  const maxY = Math.max(0, bounds.height - height)

  return {
    x: Math.round(Math.max(0, Math.min(maxX, rectangle.x))),
    y: Math.round(Math.max(0, Math.min(maxY, rectangle.y))),
    width: Math.round(width),
    height: Math.round(height),
  }
}

export function toVisibleRectangle(region, scaleX, scaleY, zoomLevel) {
  const visibleScaleX = scaleX * zoomLevel
  const visibleScaleY = scaleY * zoomLevel

  return {
    x: region.x * visibleScaleX,
    y: region.y * visibleScaleY,
    width: region.width * visibleScaleX,
    height: region.height * visibleScaleY,
  }
}

export function toDocumentRectangle(rectangle, scaleX, scaleY, zoomLevel) {
  const visibleScaleX = scaleX * zoomLevel
  const visibleScaleY = scaleY * zoomLevel

  return {
    x: Math.round(rectangle.x / visibleScaleX),
    y: Math.round(rectangle.y / visibleScaleY),
    width: Math.round(rectangle.width / visibleScaleX),
    height: Math.round(rectangle.height / visibleScaleY),
  }
}
