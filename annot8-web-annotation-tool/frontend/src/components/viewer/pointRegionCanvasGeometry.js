export function clampValue(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function getPointToSegmentDistance(point, segmentStart, segmentEnd) {
  const segmentX = segmentEnd.x - segmentStart.x
  const segmentY = segmentEnd.y - segmentStart.y
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y)
  }

  const projection = (
    ((point.x - segmentStart.x) * segmentX + (point.y - segmentStart.y) * segmentY) /
    segmentLengthSquared
  )
  const clampedProjection = clampValue(projection, 0, 1)
  const closestPoint = {
    x: segmentStart.x + clampedProjection * segmentX,
    y: segmentStart.y + clampedProjection * segmentY,
  }

  return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y)
}

export function getClosestPointRegionSegmentIndex(
  pointerPosition,
  visiblePoints,
  closed = false,
  hitTolerance = 8
) {
  if (!pointerPosition) return -1

  let closestSegmentIndex = -1
  let closestDistance = Number.POSITIVE_INFINITY
  const segmentCount = closed ? visiblePoints.length : visiblePoints.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const distance = getPointToSegmentDistance(
      pointerPosition,
      visiblePoints[index],
      visiblePoints[(index + 1) % visiblePoints.length]
    )

    if (distance < closestDistance) {
      closestDistance = distance
      closestSegmentIndex = index
    }
  }

  return closestDistance <= hitTolerance ? closestSegmentIndex : -1
}
