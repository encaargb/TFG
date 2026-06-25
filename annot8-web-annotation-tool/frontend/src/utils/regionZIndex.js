export function isValidRegionZIndex(value) {
  return Number.isInteger(value) && value >= 0
}

export function getNextRegionZIndex(regions, pageIndex) {
  const pageRegions = regions.filter((region) => region.pageIndex === pageIndex)

  if (pageRegions.length === 0) return 0

  const highestZIndex = pageRegions.reduce(
    (highest, region) =>
      isValidRegionZIndex(region.zIndex) ? Math.max(highest, region.zIndex) : highest,
    -1
  )

  return highestZIndex + 1
}

function getNormalisationPlan(pageRegions) {
  const seenZIndexes = new Set()
  let requiresNormalisation = false
  const plannedRegions = pageRegions.map((entry) => {
    const isValidUnique =
      isValidRegionZIndex(entry.region.zIndex) && !seenZIndexes.has(entry.region.zIndex)

    if (isValidUnique) {
      seenZIndexes.add(entry.region.zIndex)
    } else {
      requiresNormalisation = true
    }

    return {
      ...entry,
      isValidUnique,
    }
  })

  return {
    requiresNormalisation,
    plannedRegions,
  }
}

export function normalizeRegionZIndexes(regions) {
  const pageGroups = new Map()

  regions.forEach((region, originalIndex) => {
    const pageRegions = pageGroups.get(region.pageIndex) ?? []
    pageRegions.push({ region, originalIndex })
    pageGroups.set(region.pageIndex, pageRegions)
  })

  const normalizedZIndexes = new Map()

  pageGroups.forEach((pageRegions) => {
    const { requiresNormalisation, plannedRegions } = getNormalisationPlan(pageRegions)

    if (!requiresNormalisation) {
      plannedRegions.forEach(({ region, originalIndex }) => {
        normalizedZIndexes.set(originalIndex, region.zIndex)
      })
      return
    }

    const orderedPageRegions = [...plannedRegions].sort((first, second) => {
      if (first.isValidUnique && second.isValidUnique) {
        return (
          first.region.zIndex - second.region.zIndex ||
          first.originalIndex - second.originalIndex
        )
      }

      if (first.isValidUnique) return -1
      if (second.isValidUnique) return 1

      return first.originalIndex - second.originalIndex
    })

    orderedPageRegions.forEach((entry, zIndex) => {
      normalizedZIndexes.set(entry.originalIndex, zIndex)
    })
  })

  return regions.map((region, originalIndex) => ({
    ...region,
    zIndex: normalizedZIndexes.get(originalIndex) ?? 0,
  }))
}

function getComparableRegionZIndex(entry) {
  return isValidRegionZIndex(entry.region.zIndex) ? entry.region.zIndex : 0
}

export function compareRegionsBackToFront(first, second) {
  return (
    getComparableRegionZIndex(first) - getComparableRegionZIndex(second) ||
    first.index - second.index
  )
}

export function compareRegionsFrontToBack(first, second) {
  return (
    getComparableRegionZIndex(second) - getComparableRegionZIndex(first) ||
    second.index - first.index
  )
}
