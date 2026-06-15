import { toEdgeRectangle } from '../../utils/regionGeometry'

function clampValue(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function normalizeVisibleRectangle(rectangle) {
  const x = rectangle.width < 0 ? rectangle.x + rectangle.width : rectangle.x
  const y = rectangle.height < 0 ? rectangle.y + rectangle.height : rectangle.y

  return {
    x,
    y,
    width: Math.abs(rectangle.width),
    height: Math.abs(rectangle.height),
  }
}

export function clampVisibleRectangle(rectangle, bounds, minimumSize = 0) {
  const normalizedRectangle = normalizeVisibleRectangle(rectangle)
  const width = Math.min(Math.max(minimumSize, normalizedRectangle.width), bounds.width)
  const height = Math.min(Math.max(minimumSize, normalizedRectangle.height), bounds.height)
  const maxX = Math.max(0, bounds.width - width)
  const maxY = Math.max(0, bounds.height - height)

  return {
    x: Math.max(0, Math.min(maxX, normalizedRectangle.x)),
    y: Math.max(0, Math.min(maxY, normalizedRectangle.y)),
    width,
    height,
  }
}

export function hasValidVisibleRectangleSize(rectangle, minimumSize) {
  const normalizedRectangle = normalizeVisibleRectangle(rectangle)

  return (
    normalizedRectangle.width >= minimumSize &&
    normalizedRectangle.height >= minimumSize
  )
}

export function getNodeVisibleRectangle(node) {
  const scaleXNode = typeof node.scaleX === 'function' ? node.scaleX() : 1
  const scaleYNode = typeof node.scaleY === 'function' ? node.scaleY() : 1

  return {
    x: node.x(),
    y: node.y(),
    width: node.width() * scaleXNode,
    height: node.height() * scaleYNode,
  }
}

export function applyVisibleRectangleToNode(node, rectangle) {
  node.x(rectangle.x)
  node.y(rectangle.y)
  node.width(rectangle.width)
  node.height(rectangle.height)

  if (typeof node.scaleX === 'function') node.scaleX(1)
  if (typeof node.scaleY === 'function') node.scaleY(1)
}

export function clampTransformerBox(oldBox, newBox, bounds, minimumSize) {
  if (newBox.width < minimumSize || newBox.height < minimumSize) {
    return oldBox
  }

  return {
    ...newBox,
    ...clampVisibleRectangle(newBox, bounds, minimumSize),
  }
}

export function getAnchorAwareVisibleRectangle(
  originalRectangle,
  transformedRectangle,
  activeAnchor,
  bounds,
  minimumSize
) {
  if (!activeAnchor) {
    return clampVisibleRectangle(transformedRectangle, bounds, minimumSize)
  }

  const original = normalizeVisibleRectangle(originalRectangle)
  const transformed = normalizeVisibleRectangle(transformedRectangle)

  let left = original.x
  let top = original.y
  let right = original.x + original.width
  let bottom = original.y + original.height

  if (activeAnchor.includes('left')) {
    left = clampValue(transformed.x, 0, right - minimumSize)
  }

  if (activeAnchor.includes('right')) {
    right = clampValue(transformed.x + transformed.width, left + minimumSize, bounds.width)
  }

  if (activeAnchor.includes('top')) {
    top = clampValue(transformed.y, 0, bottom - minimumSize)
  }

  if (activeAnchor.includes('bottom')) {
    bottom = clampValue(transformed.y + transformed.height, top + minimumSize, bounds.height)
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

export function getTransformedRectangleEdges(
  originalRegion,
  transformedRectangle,
  activeAnchor
) {
  const originalRectangle = toEdgeRectangle(originalRegion)
  const nextRectangle = toEdgeRectangle(transformedRectangle)

  if (!activeAnchor) {
    return nextRectangle
  }

  return {
    left: activeAnchor.includes('left') ? nextRectangle.left : originalRectangle.left,
    top: activeAnchor.includes('top') ? nextRectangle.top : originalRectangle.top,
    right: activeAnchor.includes('right') ? nextRectangle.right : originalRectangle.right,
    bottom: activeAnchor.includes('bottom') ? nextRectangle.bottom : originalRectangle.bottom,
  }
}
