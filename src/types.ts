import { LUT } from './colortables.js'
import { NVLabel3D } from './nvlabel.js'

export type ColorArray = [number, number, number] | [number, number, number, number]

// TODO: add nifti header type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NiftiHeader = Record<string, any>

// TODO: add volume type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Volume = Record<string, any>

export type Layer = {
  colormapInvert: boolean
  alphaThreshold: boolean
  isTransparentBelowCalMin: boolean
  isAdditiveBlend: boolean
  colorbarVisible: boolean
  colormapLabel: unknown[]
}

/**
 * Represents the vertices of a connectome
 * @property name name of node
 * @property colorValue color value of node (actual color determined by colormap)
 * @property sizeValue size value of node (actual size determined by node scale times this value in mms)
 */
export type ConnectomeNode = {
  name: string
  x: number
  y: number
  z: number
  colorValue: number
  sizeValue: number
  label?: NVLabel3D
}

type LegacyConnectomeNodes = {
  names: string[]
  X: number[]
  Y: number[]
  Z: number[]
  Color: number[]
  Size: number[]
}

/**
 * Represents edges between connectome nodes
 */
export type ConnectomeEdge = {
  first: number // index of the first node
  second: number // index of the second node
  colorValue: number // color value to determin color of edge based on color map
}

export type Connectome = {
  name: string
  nodeColormap: string
  nodeColormapNegative: string
  nodeMinColor: number
  nodeMaxColor: number
  nodeScale: number // scale factor for node, e.g. if 2 and a node has size 3, a 6mm ball is drawn
  edgeColormap: string
  edgeColormapNegative: string
  edgeMin: number
  edgeMax: number
  edgeScale: number
  legendLineThickness: number

  nodes: ConnectomeNode[]
  edges: ConnectomeEdge[]
}

export type LegacyConnectome = Connectome & {
  nodes: LegacyConnectomeNodes
}

export type FreeSurferConnectome = {
  data_type: string
  points: Array<{
    comments: Array<{
      text: string
    }>
    coordinates: {
      x: number
      y: number
      z: number
    }
  }>
}

export type NVMeshLayer = {
  url: string
  opacity: number
  colormap: string
  colormapNegative: string
  useNegativeCmap: boolean
  alphaThreshold: boolean
  isTransparentBelowCalMin: boolean
  isAdditiveBlend?: boolean // TODO check where this is used
  isOutlineBorder: boolean
  cal_min: number | null
  cal_max: number | null
  cal_minNeg: number
  cal_maxNeg: number
  global_min: number
  global_max: number
  nFrame4D: number
  frame4D: number
  colormapLabel?: LUT
  colormapInvert: boolean
  base64?: string
  colorbarVisible: boolean

  values?: number[] | Float32Array | Uint32Array
}

export type ReadResult = {
  positions: Float32Array
  indices: Int32Array
  colors?: Float32Array
}
