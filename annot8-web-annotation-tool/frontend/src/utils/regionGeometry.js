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
  return normalizeRectangleEdges(rectangle)
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
  const edgeRectangle = normalizeRectangleEdges(rectangle)
  const width = Math.min(Math.max(0, getRectangleWidth(edgeRectangle)), bounds.width)
  const height = Math.min(Math.max(0, getRectangleHeight(edgeRectangle)), bounds.height)

  const maxLeft = Math.max(0, bounds.width - width)
  const maxTop = Math.max(0, bounds.height - height)

  const left = Math.round(Math.max(0, Math.min(maxLeft, edgeRectangle.left)))
  const top = Math.round(Math.max(0, Math.min(maxTop, edgeRectangle.top)))

  return {
    left,
    top,
    right: Math.round(left + width),
    bottom: Math.round(top + height),
  }
}

export function toVisibleRectangle(region, scaleX, scaleY, zoomLevel) {
  const rectangle = normalizeRectangleEdges(region)
  const visibleScaleX = scaleX * zoomLevel
  const visibleScaleY = scaleY * zoomLevel

  return {
    x: rectangle.left * visibleScaleX,
    y: rectangle.top * visibleScaleY,
    width: (rectangle.right - rectangle.left) * visibleScaleX,
    height: (rectangle.bottom - rectangle.top) * visibleScaleY,
  }
}

export function toDocumentRectangle(rectangle, scaleX, scaleY, zoomLevel) {
  const visibleScaleX = scaleX * zoomLevel
  const visibleScaleY = scaleY * zoomLevel

  return normalizeRectangleEdges({
    left: Math.round(rectangle.x / visibleScaleX),
    top: Math.round(rectangle.y / visibleScaleY),
    right: Math.round((rectangle.x + rectangle.width) / visibleScaleX),
    bottom: Math.round((rectangle.y + rectangle.height) / visibleScaleY),
  })
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
