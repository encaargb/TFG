import {
  AUTO_SCROLL_EDGE_THRESHOLD,
  AUTO_SCROLL_STEP,
} from './annotationCanvasConstants'

function getEventClientPosition(event) {
  const evt = event?.evt

  if (!evt || !Number.isFinite(evt.clientX) || !Number.isFinite(evt.clientY)) return null

  return {
    x: evt.clientX,
    y: evt.clientY,
  }
}

export function useCanvasAutoScroll({ canvasWrapper, isInteractionActive }) {
  function autoScrollCanvasWrapper(event) {
    if (!isInteractionActive()) return

    const wrapper = canvasWrapper.value
    const pointerPosition = getEventClientPosition(event)

    if (!wrapper || !pointerPosition || typeof wrapper.getBoundingClientRect !== 'function') {
      return
    }

    const bounds = wrapper.getBoundingClientRect()
    let scrollX = 0
    let scrollY = 0

    if (pointerPosition.x >= bounds.right - AUTO_SCROLL_EDGE_THRESHOLD) {
      scrollX = AUTO_SCROLL_STEP
    } else if (pointerPosition.x <= bounds.left + AUTO_SCROLL_EDGE_THRESHOLD) {
      scrollX = -AUTO_SCROLL_STEP
    }

    if (pointerPosition.y >= bounds.bottom - AUTO_SCROLL_EDGE_THRESHOLD) {
      scrollY = AUTO_SCROLL_STEP
    } else if (pointerPosition.y <= bounds.top + AUTO_SCROLL_EDGE_THRESHOLD) {
      scrollY = -AUTO_SCROLL_STEP
    }

    if (scrollX) {
      wrapper.scrollLeft += scrollX
    }

    if (scrollY) {
      wrapper.scrollTop += scrollY
    }
  }

  return {
    autoScrollCanvasWrapper,
  }
}
