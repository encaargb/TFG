import { vi } from 'vitest'

const stageInstances = []
const layerInstances = []
const imageInstances = []
const rectInstances = []
const transformerInstances = []

function createBaseNodeMock(initialConfig = {}) {
  const handlers = new Map()
  const state = {
    x: initialConfig.x ?? 0,
    y: initialConfig.y ?? 0,
    width: initialConfig.width ?? 0,
    height: initialConfig.height ?? 0,
    scaleX: initialConfig.scaleX ?? 1,
    scaleY: initialConfig.scaleY ?? 1,
  }

  const node = {
    destroy: vi.fn(),
    width: vi.fn((value) => {
      if (value === undefined) return state.width
      state.width = value
      return node
    }),
    height: vi.fn((value) => {
      if (value === undefined) return state.height
      state.height = value
      return node
    }),
    x: vi.fn((value) => {
      if (value === undefined) return state.x
      state.x = value
      return node
    }),
    y: vi.fn((value) => {
      if (value === undefined) return state.y
      state.y = value
      return node
    }),
    scaleX: vi.fn((value) => {
      if (value === undefined) return state.scaleX
      state.scaleX = value
      return node
    }),
    scaleY: vi.fn((value) => {
      if (value === undefined) return state.scaleY
      state.scaleY = value
      return node
    }),
    on: vi.fn((eventNames, handler) => {
      eventNames.split(' ').forEach((eventName) => handlers.set(eventName, handler))
      return node
    }),
    trigger: (eventName) => handlers.get(eventName)?.(),
  }

  return node
}

function createStageMock(config) {
  const handlers = new Map()
  const stage = {
    ...createBaseNodeMock(config),
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
    destroyChildren: vi.fn(),
    draw: vi.fn(),
  }
}

function createImageNodeMock(config) {
  return {
    ...createBaseNodeMock(config),
    config,
  }
}

function createRectNodeMock(config) {
  return {
    ...createBaseNodeMock(config),
    config,
  }
}

function createTransformerMock(config) {
  return {
    ...createBaseNodeMock(config),
    config,
    nodes: vi.fn().mockReturnThis(),
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

  const Rect = vi.fn(function Rect(config) {
    const rect = createRectNodeMock(config)
    rectInstances.push(rect)
    return rect
  })

  const Transformer = vi.fn(function Transformer(config) {
    const transformer = createTransformerMock(config)
    transformerInstances.push(transformer)
    return transformer
  })

  return {
    default: {
      Stage,
      Layer,
      Image,
      Rect,
      Transformer,
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
  rectInstances.length = 0
  transformerInstances.length = 0
}

export function getLatestStage() {
  return stageInstances.at(-1)
}

export function getLatestLayer() {
  return layerInstances.at(-1)
}

export function getLayerInstances() {
  return layerInstances
}

export function getImageInstances() {
  return imageInstances
}

export function getRectInstances() {
  return rectInstances
}

export function getTransformerInstances() {
  return transformerInstances
}
