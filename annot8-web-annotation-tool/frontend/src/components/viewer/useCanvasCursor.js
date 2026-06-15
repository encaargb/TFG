function getNodeRegionId(node) {
  return typeof node?.id === 'function' ? node.id() : node?.config?.id
}

export function useCanvasCursor({
  getStage,
  getActiveTool,
  getCurrentPageRegions,
}) {
  let hoveredRegionId = null
  let draggedRegionId = null

  function getHoveredRegionId() {
    return hoveredRegionId
  }

  function getDraggedRegionId() {
    return draggedRegionId
  }

  function setStageCursor(cursor) {
    const container = getStage()?.container?.()

    if (container) {
      container.style.cursor = cursor
    }
  }

  function resetStageCursor() {
    setStageCursor('default')
  }

  function handleRegionMouseEnter(regionId) {
    hoveredRegionId = regionId

    if (getActiveTool() === 'select' && !draggedRegionId) {
      setStageCursor('grab')
    }
  }

  function handleRegionMouseLeave(regionId) {
    if (hoveredRegionId === regionId) {
      hoveredRegionId = null
    }

    if (!draggedRegionId) {
      resetStageCursor()
    }
  }

  function beginRegionDrag(regionId) {
    draggedRegionId = regionId

    if (getActiveTool() === 'select') {
      setStageCursor('grabbing')
    }
  }

  function endRegionDrag(regionId) {
    if (draggedRegionId === regionId) {
      draggedRegionId = null
    }

    if (getActiveTool() === 'select' && hoveredRegionId === regionId) {
      setStageCursor('grab')
      return
    }

    resetStageCursor()
  }

  function attachRegionCursorHandlers(node, regionId) {
    node.on('mouseenter', () => handleRegionMouseEnter(regionId))
    node.on('mouseleave', () => handleRegionMouseLeave(regionId))
  }

  function resetStaleRegionCursor(event) {
    if (getActiveTool() !== 'select' || draggedRegionId || !hoveredRegionId) return

    const targetRegionId = getNodeRegionId(event?.target)

    if (targetRegionId === hoveredRegionId) return
    if (getCurrentPageRegions().some((region) => region.id === targetRegionId)) {
      hoveredRegionId = targetRegionId
      setStageCursor('grab')
      return
    }

    hoveredRegionId = null
    resetStageCursor()
  }

  function clearRegionCursorState() {
    hoveredRegionId = null
    draggedRegionId = null
  }

  return {
    getHoveredRegionId,
    getDraggedRegionId,
    setStageCursor,
    resetStageCursor,
    handleRegionMouseEnter,
    handleRegionMouseLeave,
    beginRegionDrag,
    endRegionDrag,
    attachRegionCursorHandlers,
    resetStaleRegionCursor,
    clearRegionCursorState,
  }
}
