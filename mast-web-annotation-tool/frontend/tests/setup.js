import { vi } from 'vitest'

const stageInstances = []
const layerInstances = []
const imageInstances = []

function createBaseNodeMock() {
  return {
    destroy: vi.fn(),
    width: vi.fn().mockReturnThis(),
    height: vi.fn().mockReturnThis(),
    x: vi.fn().mockReturnThis(),
    y: vi.fn().mockReturnThis(),
  }
}

function createStageMock(config) {
  const handlers = new Map()
  const stage = {
    ...createBaseNodeMock(),
    config,
    add: vi.fn().mockReturnThis(),
    on: vi.fn((eventName, handler) => {
      handlers.set(eventName, handler)
      return stage
    }),
    getPointerPosition: vi.fn(() => ({ x: 0, y: 0 })),
    trigger: (eventName) => handlers.get(eventName)?.(),
  }

  return stage
}

function createLayerMock() {
  return {
    ...createBaseNodeMock(),
    add: vi.fn().mockReturnThis(),
    draw: vi.fn(),
  }
}

function createImageNodeMock(config) {
  return {
    ...createBaseNodeMock(),
    config,
  }
}

vi.mock('konva', () => {
  const Stage = vi.fn(function Stage(config) {
    const stage = createStageMock(config)
    stageInstances.push(stage)
    return stage
  })

  const Layer = vi.fn(function Layer() {
    const layer = createLayerMock()
    layerInstances.push(layer)
    return layer
  })

  const Image = vi.fn(function Image(config) {
    const image = createImageNodeMock(config)
    imageInstances.push(image)
    return image
  })

  return {
    default: {
      Stage,
      Layer,
      Image,
    },
  }
})

global.window.Image = class {
  constructor() {
    this.width = 2000
    this.height = 1000
  }

  set src(value) {
    this._src = value
    setTimeout(() => {
      if (this.onload) {
        this.onload()
      }
    }, 0)
  }

  get src() {
    return this._src
  }
}

export function resetKonvaMocks() {
  stageInstances.length = 0
  layerInstances.length = 0
  imageInstances.length = 0
}

export function getLatestStage() {
  return stageInstances.at(-1)
}

export function getLatestLayer() {
  return layerInstances.at(-1)
}

export function getImageInstances() {
  return imageInstances
}
