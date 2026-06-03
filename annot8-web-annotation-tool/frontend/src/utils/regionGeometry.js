export function createRectangleRegion({
  id,
  pageIndex,
  start,
  end,
  color = '#0d6efd',
}) {
  const rectangle = normalizeRectangleEdges({
    left: start.x,
    top: start.y,
    right: end.x,
    bottom: end.y,
  })

  return {
    id,
    pageIndex,
    type: 'rectangle',
    ...rectangle,
    color,
    annotations: [],
  }
}

export function normalizeRectangleEdges(rectangle) {
  return {
    left: Math.min(rectangle.left, rectangle.right),
    top: Math.min(rectangle.top, rectangle.bottom),
    right: Math.max(rectangle.left, rectangle.right),
    bottom: Math.max(rectangle.top, rectangle.bottom),
  }
}

export function toEdgeRectangle(rectangle) {
  if ('left' in rectangle && 'top' in rectangle && 'right' in rectangle && 'bottom' in rectangle) {
    return normalizeRectangleEdges(rectangle)
  }

  if (!('x' in rectangle) || !('y' in rectangle)) {
    return normalizeRectangleEdges({
      left: 0,
      top: 0,
      right: rectangle.width,
      bottom: rectangle.height,
    })
  }

  return normalizeRectangleEdges({
    left: rectangle.x,
    top: rectangle.y,
    right: rectangle.x + rectangle.width,
    bottom: rectangle.y + rectangle.height,
  })
}

export function getRectangleWidth(rectangle) {
  const edgeRectangle = toEdgeRectangle(rectangle)

  return edgeRectangle.right - edgeRectangle.left
}

export function getRectangleHeight(rectangle) {
  const edgeRectangle = toEdgeRectangle(rectangle)

  return edgeRectangle.bottom - edgeRectangle.top
}

export function toKonvaRectangle(rectangle) {
  const edgeRectangle = toEdgeRectangle(rectangle)

  return {
    x: edgeRectangle.left,
    y: edgeRectangle.top,
    width: getRectangleWidth(edgeRectangle),
    height: getRectangleHeight(edgeRectangle),
  }
}

export function createPolygonRegion({
  id,
  pageIndex,
  points,
  color = '#0d6efd',
}) {
  return {
    id,
    pageIndex,
    type: 'polygon',
    points: points.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
    })),
    color,
    annotations: [],
  }
}

export function createPolylineRegion({
  id,
  pageIndex,
  points,
  color = '#0d6efd',
}) {
  return {
    id,
    pageIndex,
    type: 'polyline',
    points: points.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
    })),
    color,
    annotations: [],
  }
}

export function isDrawableRegion(region, minimumSize = 4) {
  if (region.type === 'polygon') {
    return Array.isArray(region.points) && region.points.length >= 3
  }

  if (region.type === 'polyline') {
    return Array.isArray(region.points) && region.points.length >= 2
  }

  return getRectangleWidth(region) >= minimumSize && getRectangleHeight(region) >= minimumSize
}

export function clampRectangleToBounds(rectangle, bounds) {
  const konvaRectangle = toKonvaRectangle(rectangle)
  const width = Math.min(Math.max(0, konvaRectangle.width), bounds.width)
  const height = Math.min(Math.max(0, konvaRectangle.height), bounds.height)
  const maxX = Math.max(0, bounds.width - width)
  const maxY = Math.max(0, bounds.height - height)

  return {
    x: Math.round(Math.max(0, Math.min(maxX, konvaRectangle.x))),
    y: Math.round(Math.max(0, Math.min(maxY, konvaRectangle.y))),
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

export function clampPointToBounds(point, bounds) {
  return {
    x: Math.round(Math.max(0, Math.min(bounds.width, point.x))),
    y: Math.round(Math.max(0, Math.min(bounds.height, point.y))),
  }
}

export function clampPolygonToBounds(polygon, bounds) {
  return {
    points: polygon.points.map((point) => clampPointToBounds(point, bounds)),
  }
}

export function toVisiblePoints(points, scaleX, scaleY, zoomLevel) {
  const visibleScaleX = scaleX * zoomLevel
  const visibleScaleY = scaleY * zoomLevel

  return points.map((point) => ({
    x: point.x * visibleScaleX,
    y: point.y * visibleScaleY,
  }))
}

export function toDocumentPoints(points, scaleX, scaleY, zoomLevel) {
  const visibleScaleX = scaleX * zoomLevel
  const visibleScaleY = scaleY * zoomLevel

  return points.map((point) => ({
    x: Math.round(point.x / visibleScaleX),
    y: Math.round(point.y / visibleScaleY),
  }))
}

export function flattenPoints(points) {
  return points.flatMap((point) => [point.x, point.y])
}

export function unflattenPoints(points) {
  const normalizedPoints = []

  for (let index = 0; index < points.length; index += 2) {
    normalizedPoints.push({
      x: points[index],
      y: points[index + 1],
    })
  }

  return normalizedPoints
}
