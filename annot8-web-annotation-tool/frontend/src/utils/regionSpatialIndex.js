import {
  Quadtree,
  Rectangle,
} from '@timohausmann/quadtree-ts'
import { getRegionBounds } from './regionGeometry'

export const REGION_SPATIAL_INDEX_MAX_OBJECTS = 10
export const REGION_SPATIAL_INDEX_MAX_LEVELS = 4

function hasValidDocumentBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  )
}

function hasValidRectangleBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width >= 0 &&
    bounds.height >= 0
  )
}

export function createRegionSpatialIndex(options = {}) {
  let tree = null

  function createTree(documentBounds) {
    return new Quadtree({
      x: 0,
      y: 0,
      width: documentBounds.width,
      height: documentBounds.height,
      maxObjects: options.maxObjects ?? REGION_SPATIAL_INDEX_MAX_OBJECTS,
      minLevels: options.minLevels ?? 0,
      maxLevels: options.maxLevels ?? REGION_SPATIAL_INDEX_MAX_LEVELS,
    })
  }

  function clear() {
    tree?.clear()
    tree = null
  }

  function rebuild(documentBounds, regions = []) {
    clear()

    if (!hasValidDocumentBounds(documentBounds)) return

    tree = createTree(documentBounds)

    regions.forEach((region) => {
      const bounds = getRegionBounds(region)

      if (!region?.id || !hasValidRectangleBounds(bounds)) return

      tree.insert(new Rectangle({
        ...bounds,
        data: {
          regionId: region.id,
        },
      }))
    })
  }

  function query(queryBounds) {
    if (!tree || !hasValidRectangleBounds(queryBounds)) return []

    const queryRectangle = new Rectangle(queryBounds)
    const regionIds = new Set()

    tree.retrieve(queryRectangle).forEach((candidate) => {
      const regionId = candidate?.data?.regionId

      if (regionId) {
        regionIds.add(regionId)
      }
    })

    return [...regionIds]
  }

  return {
    rebuild,
    query,
    clear,
  }
}
