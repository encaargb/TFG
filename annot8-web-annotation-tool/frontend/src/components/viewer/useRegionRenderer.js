import Konva from 'konva'
import { flattenPoints, toVisiblePoints, toVisibleRectangle } from '../../utils/regionGeometry'
import { compareRegionsBackToFront } from '../../utils/regionZIndex'
import { clampTransformerBox } from './rectangleCanvasGeometry'
import {
  MIN_VISIBLE_RECTANGLE_SIZE,
  RECTANGLE_TRANSFORMER_ANCHOR_CORNER_RADIUS,
  RECTANGLE_TRANSFORMER_ANCHOR_SIZE,
  REGION_COLOR,
  REGION_STROKE_WIDTH,
  SELECTED_REGION_STROKE_WIDTH,
} from './annotationCanvasConstants'

export function useRegionRenderer({
  getRegionLayer,
  hasPageImage,
  getCurrentPageRegions,
  getActiveTool,
  getSelectedRegionId,
  getZoomLevel,
  getRegionScale,
  getVisibleBounds,
  clearPolylineEndpointPreview,
  clearSelectedPoint,
  attachRegionCursorHandlers,
  handleRegionContextMenu,
  attachRectangleEditing,
  getRectangleDragBoundPosition,
  attachPointRegionDragging,
  getPointRegionDragBoundPosition,
  createRegionVertexHandles,
  handleRegionBodyClick,
}) {
  let transformer = null
  let vertexHandles = []
  const regionNodesById = new Map()

  function getRegionColor(region) {
    return /^#[0-9a-fA-F]{6}$/.test(region?.color) ? region.color : REGION_COLOR
  }

  function showActiveEditHandles() {
    const controls = [transformer, ...vertexHandles].filter(Boolean)

    controls.forEach((node) => {
      if (typeof node.visible === 'function') {
        node.visible(true)
      }
    })
    transformer?.forceUpdate?.()
    getRegionLayer()?.draw()
  }

  function clearSelectionControls() {
    const regionLayer = getRegionLayer()

    // Body drags must keep their Konva nodes alive; only the temporary selection UI is removed.
    clearPolylineEndpointPreview(false)
    vertexHandles.forEach((handle) => handle.destroy?.())
    vertexHandles = []

    transformer?.nodes?.([])
    transformer?.destroy?.()
    transformer = null

    regionLayer?.draw()
  }

  function updateRegionSelectionAppearance(previousRegionId, selectedRegionId) {
    const regionLayer = getRegionLayer()
    const previousNode = previousRegionId ? regionNodesById.get(previousRegionId) : null
    const selectedNode = selectedRegionId ? regionNodesById.get(selectedRegionId) : null

    if (previousNode && previousRegionId !== selectedRegionId) {
      previousNode.strokeWidth?.(REGION_STROKE_WIDTH)
    }

    selectedNode?.strokeWidth?.(SELECTED_REGION_STROKE_WIDTH)
    if (typeof regionLayer?.batchDraw === 'function') {
      regionLayer.batchDraw()
      return
    }

    regionLayer?.draw?.()
  }

  function createRectangleRegionNode(region) {
    const { scaleX, scaleY } = getRegionScale()
    const visibleRegion = toVisibleRectangle(region, scaleX, scaleY, getZoomLevel())
    let node

    node = new Konva.Rect({
      ...visibleRegion,
      id: region.id,
      draggable: getActiveTool() === 'select',
      fill: `${region.color}26`,
      stroke: region.color,
      strokeWidth: getSelectedRegionId() === region.id
        ? SELECTED_REGION_STROKE_WIDTH
        : REGION_STROKE_WIDTH,
      strokeScaleEnabled: false,
      dragBoundFunc: (position) => getRectangleDragBoundPosition(node, position),
    })

    attachRegionCursorHandlers(node, region.id)

    node.on('click tap', (event) => {
      if (getActiveTool() !== 'select') return
      if (event?.evt?.detail > 1) return
      clearSelectedPoint()
      handleRegionBodyClick(event, region.id)
    })

    node.on('contextmenu', (event) => {
      handleRegionContextMenu({ event, region, visiblePoints: null, isPolygon: false })
    })

    attachRectangleEditing({ node, region, transformer, scaleX, scaleY })

    return node
  }

  function createPointRegionNode(region) {
    const { scaleX, scaleY } = getRegionScale()
    const visiblePoints = toVisiblePoints(region.points, scaleX, scaleY, getZoomLevel())
    const flatVisiblePoints = flattenPoints(visiblePoints)
    const isPolygon = region.type === 'polygon'

    const node = new Konva.Line({
      points: flatVisiblePoints,
      closed: isPolygon,
      id: region.id,
      draggable: getActiveTool() === 'select',
      fill: isPolygon ? `${region.color}26` : 'transparent',
      stroke: region.color,
      strokeWidth: getSelectedRegionId() === region.id
        ? SELECTED_REGION_STROKE_WIDTH
        : REGION_STROKE_WIDTH,
      strokeScaleEnabled: false,
      dragBoundFunc: (position) => getPointRegionDragBoundPosition(visiblePoints, position),
    })

    attachRegionCursorHandlers(node, region.id)

    node.on('click tap', (event) => {
      if (getActiveTool() !== 'select') return
      if (event?.evt?.detail > 1) return
      clearSelectedPoint()

      handleRegionBodyClick(event, region.id)
    })

    node.on('contextmenu', (event) => {
      handleRegionContextMenu({ event, region, visiblePoints, isPolygon })
    })

    attachPointRegionDragging({ node, region, visiblePoints, scaleX, scaleY })

    return node
  }

  function createRegionNode(region) {
    if (region.type === 'polygon' || region.type === 'polyline') {
      return createPointRegionNode(region)
    }

    return createRectangleRegionNode(region)
  }

  function renderRegions() {
    const regionLayer = getRegionLayer()

    if (!regionLayer || !hasPageImage()) return

    // Rebuilding avoids stale Konva listeners and keeps selection handles aligned with model data.
    clearSelectionControls()
    regionLayer.destroyChildren()
    vertexHandles = []
    regionNodesById.clear()
    const currentPageRegions = getCurrentPageRegions()
    const selectedRectangle = currentPageRegions.find(
      (region) => region.id === getSelectedRegionId() && region.type === 'rectangle'
    )
    const transformerColor = getRegionColor(selectedRectangle)

    transformer = new Konva.Transformer({
      rotateEnabled: false,
      flipEnabled: false,
      keepRatio: false,
      anchorSize: RECTANGLE_TRANSFORMER_ANCHOR_SIZE,
      anchorCornerRadius: RECTANGLE_TRANSFORMER_ANCHOR_CORNER_RADIUS,
      anchorFill: '#ffffff',
      anchorStroke: transformerColor,
      anchorStrokeWidth: 2,
      borderStroke: transformerColor,
      borderStrokeWidth: 1,
      boundBoxFunc: (oldBox, newBox) => clampTransformerBox(
        oldBox,
        newBox,
        getVisibleBounds(),
        MIN_VISIBLE_RECTANGLE_SIZE
      ),
    })

    let selectedNode = null
    let selectedPointRegion = null
    const sortedPageRegions = currentPageRegions
      .map((region, index) => ({ region, index }))
      .sort(compareRegionsBackToFront)
      .map(({ region }) => region)

    sortedPageRegions.forEach((region) => {
      const node = createRegionNode(region)
      regionNodesById.set(region.id, node)
      regionLayer.add(node)

      if (region.id === getSelectedRegionId()) {
        selectedNode = node
      }

      if (
        (region.type === 'polygon' || region.type === 'polyline') &&
        region.id === getSelectedRegionId() &&
        getActiveTool() === 'select'
      ) {
        selectedPointRegion = { region, node }
      }
    })

    if (selectedPointRegion) {
      vertexHandles = createRegionVertexHandles(
        selectedPointRegion.region,
        selectedPointRegion.node
      )
      vertexHandles.forEach((handle) => regionLayer.add(handle))
    }

    regionLayer.add(transformer)

    if (
      selectedNode &&
      getActiveTool() === 'select' &&
      !['polygon', 'polyline'].includes(
        currentPageRegions.find((region) => region.id === getSelectedRegionId())?.type
      )
    ) {
      transformer.nodes([selectedNode])
    } else {
      transformer.nodes([])
    }

    regionLayer.draw()
  }

  function disposeRegionRenderer() {
    clearSelectionControls()
    transformer = null
    vertexHandles = []
    regionNodesById.clear()
  }

  return {
    renderRegions,
    showActiveEditHandles,
    clearSelectionControls,
    updateRegionSelectionAppearance,
    disposeRegionRenderer,
  }
}
