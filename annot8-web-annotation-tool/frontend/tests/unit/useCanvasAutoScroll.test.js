import { describe, expect, it } from 'vitest'
import { useCanvasAutoScroll } from '../../src/components/viewer/useCanvasAutoScroll'

function createWrapper() {
  return {
    scrollLeft: 100,
    scrollTop: 100,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 300,
      bottom: 200,
      width: 300,
      height: 200,
    }),
  }
}

function createAutoScroll({ active = true, wrapper = createWrapper() } = {}) {
  return {
    wrapper,
    ...useCanvasAutoScroll({
      canvasWrapper: { value: wrapper },
      isInteractionActive: () => active,
    }),
  }
}

describe('useCanvasAutoScroll', () => {
  it('does nothing when there is no active interaction', () => {
    const { wrapper, autoScrollCanvasWrapper } = createAutoScroll({ active: false })

    autoScrollCanvasWrapper({ evt: { clientX: 295, clientY: 100 } })

    expect(wrapper.scrollLeft).toBe(100)
    expect(wrapper.scrollTop).toBe(100)
  })

  it('scrolls right when the pointer is near the right edge', () => {
    const { wrapper, autoScrollCanvasWrapper } = createAutoScroll()

    autoScrollCanvasWrapper({ evt: { clientX: 295, clientY: 100 } })

    expect(wrapper.scrollLeft).toBe(112)
  })

  it('scrolls left when the pointer is near the left edge', () => {
    const { wrapper, autoScrollCanvasWrapper } = createAutoScroll()

    autoScrollCanvasWrapper({ evt: { clientX: 5, clientY: 100 } })

    expect(wrapper.scrollLeft).toBe(88)
  })

  it('scrolls down when the pointer is near the bottom edge', () => {
    const { wrapper, autoScrollCanvasWrapper } = createAutoScroll()

    autoScrollCanvasWrapper({ evt: { clientX: 150, clientY: 195 } })

    expect(wrapper.scrollTop).toBe(112)
  })

  it('scrolls up when the pointer is near the top edge', () => {
    const { wrapper, autoScrollCanvasWrapper } = createAutoScroll()

    autoScrollCanvasWrapper({ evt: { clientX: 150, clientY: 5 } })

    expect(wrapper.scrollTop).toBe(88)
  })

  it('does nothing if the event has no valid client coordinates', () => {
    const { wrapper, autoScrollCanvasWrapper } = createAutoScroll()

    autoScrollCanvasWrapper({})

    expect(wrapper.scrollLeft).toBe(100)
    expect(wrapper.scrollTop).toBe(100)
  })
})
