export function getPointRegionMinimumPointCount(type) {
  return type === 'polygon' ? 3 : 2
}

export function hasValidVisiblePointRegionSegments(
  visiblePoints,
  type,
  minimumSegmentLength = 4
) {
  if (visiblePoints.length < getPointRegionMinimumPointCount(type)) return false

  const segmentCount = type === 'polygon' ? visiblePoints.length : visiblePoints.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const start = visiblePoints[index]
    const end = visiblePoints[(index + 1) % visiblePoints.length]
    const distance = Math.hypot(end.x - start.x, end.y - start.y)

    if (distance < minimumSegmentLength) return false
  }

  return true
}
