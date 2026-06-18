import { onBeforeUnmount, onMounted } from 'vue'

export function useCanvasKeyboardShortcuts({
  getActiveTool,
  commitDraftPointRegion,
  cancelDraftPointRegion,
  cancelDraftRectangleRegion,
  clearSelectedPointRegionPoint,
  deleteSelectedPointRegionPoint,
  clearSelectedRegion,
  deleteSelectedRegion,
}) {
  function handleKeydown(event) {
    const activeTool = getActiveTool()

    if (['polygon', 'polyline'].includes(activeTool) && event.key === 'Enter') {
      commitDraftPointRegion()
      return
    }

    if (['polygon', 'polyline'].includes(activeTool) && event.key === 'Escape') {
      cancelDraftPointRegion()
      return
    }

    if (
      activeTool === 'rectangle' &&
      event.key === 'Escape' &&
      cancelDraftRectangleRegion()
    ) {
      return
    }

    if (event.key === 'Escape') {
      clearSelectedPointRegionPoint()
      clearSelectedRegion()
      return
    }

    if (event.key !== 'Delete' && event.key !== 'Backspace') return

    if (deleteSelectedPointRegionPoint()) return

    deleteSelectedRegion()
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
