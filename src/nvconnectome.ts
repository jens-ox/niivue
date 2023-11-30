import { NVMesh, MeshType } from './nvmesh.js'
import { NVUtilities } from './nvutilities.js'
import { NiivueObject3D } from './niivue-object3D.js'
import { NVMeshUtilities } from './nvmesh-utilities.js'
import { cmapper } from './colortables.js'
import { NVLabel3D, LabelTextAlignment } from './nvlabel.js'
import { Connectome, ConnectomeEdge, FreeSurferConnectome, LegacyConnectome } from './types.js'

const defaultOptions: Omit<Connectome, 'nodes' | 'edges'> = {
  name: 'untitled connectome',
  nodeColormap: 'warm',
  nodeColormapNegative: 'winter',
  nodeMinColor: 0,
  nodeMaxColor: 4,
  nodeScale: 3,
  edgeColormap: 'warm',
  edgeColormapNegative: 'winter',
  edgeMin: 2,
  edgeMax: 6,
  edgeScale: 1,
  legendLineThickness: 0
}

/**
 * Represents a connectome
 *
 * TODO `implements Conectome`?
 */
export class NVConnectome extends NVMesh {
  gl: WebGL2RenderingContext
  nodesChanged: EventTarget
  edges: ConnectomeEdge[] = []

  constructor(gl: WebGL2RenderingContext, connectome: Connectome) {
    super([], [], connectome.name, [], 1.0, true, gl, connectome)
    this.gl = gl
    this.type = MeshType.CONNECTOME

    if (this.nodes) {
      // TODO: will this ever happen? this.nodes wasn't defined
      this.updateLabels()
    }

    this.nodesChanged = new EventTarget()
  }

  static convertLegacyConnectome(json: LegacyConnectome): Connectome {
    const { nodes, edges, ...filteredJson } = json
    const connectome: Connectome = { nodes: [], edges: [], ...defaultOptions, ...filteredJson }

    for (let i = 0; i < nodes.names.length; i++) {
      connectome.nodes.push({
        name: nodes.names[i],
        x: nodes.X[i],
        y: nodes.Y[i],
        z: nodes.Z[i],
        colorValue: nodes.Color[i],
        sizeValue: nodes.Size[i]
      })
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const colorValue = edges[i * nodes.length + j].colorValue
        connectome.edges.push({
          first: i,
          second: j,
          colorValue
        })
      }
    }

    return connectome
  }

  static convertFreeSurferConnectome(json: FreeSurferConnectome, colormap = 'warm'): Connectome {
    // TODO use zod for schema validation
    let isValid = true
    if (!json.data_type) {
      isValid = false
    } else if (json.data_type !== 'fs_pointset') {
      isValid = false
    }
    if (!('points' in json)) {
      isValid = false
    }
    if (!isValid) {
      throw Error('not a valid FreeSurfer json pointset')
    }

    const nodes = json.points.map((p) => ({
      name: Array.isArray(p.comments) && p.comments.length > 0 && 'text' in p.comments[0] ? p.comments[0].text : '',
      x: p.coordinates.x,
      y: p.coordinates.y,
      z: p.coordinates.z,
      colorValue: 1,
      sizeValue: 1,
      metadata: p.comments
    }))
    const connectome = {
      ...defaultOptions,
      nodeColormap: colormap,
      edgeColormap: colormap,
      nodes,
      edges: []
    }
    return connectome
  }

  updateLabels(): void {
    const nodes = this.nodes
    if (nodes.length > 0) {
      // largest node
      const largest = nodes.reduce((a, b) => (a.sizeValue > b.sizeValue ? a : b)).sizeValue
      const min = this.nodeMinColor
        ? this.nodeMinColor
        : nodes.reduce((a, b) => (a.colorValue < b.colorValue ? a : b)).colorValue
      const max = this.nodeMaxColor
        ? this.nodeMaxColor
        : nodes.reduce((a, b) => (a.colorValue > b.colorValue ? a : b)).colorValue
      const lut = cmapper.colormap(this.nodeColormap, this.colormapInvert)
      const lutNeg = cmapper.colormap(this.nodeColormapNegative, this.colormapInvert)

      const hasNeg = 'nodeColormapNegative' in this
      const legendLineThickness = this.legendLineThickness ? this.legendLineThickness : 0.0

      for (let i = 0; i < nodes.length; i++) {
        let color = nodes[i].colorValue
        let isNeg = false
        if (hasNeg && color < 0) {
          isNeg = true
          color = -color
        }

        if (min < max) {
          if (color < min) {
            console.log('color value lower than min')
            continue
          }
          color = (color - min) / (max - min)
        } else {
          color = 1.0
        }

        color = Math.round(Math.max(Math.min(255, color * 255)), 1) * 4
        let rgba = [lut[color], lut[color + 1], lut[color + 2], 255]
        if (isNeg) {
          rgba = [lutNeg[color], lutNeg[color + 1], lutNeg[color + 2], 255]
        }
        rgba = rgba.map((c) => c / 255)
        console.log('adding label for ', nodes[i])
        nodes[i].label = new NVLabel3D(
          nodes[i].name,
          {
            textColor: rgba,
            bulletScale: nodes[i].sizeValue / largest,
            bulletColor: rgba,
            lineWidth: legendLineThickness,
            lineColor: rgba,
            textScale: 1.0,
            textAlignment: LabelTextAlignment.LEFT
          },
          [nodes[i].x, nodes[i].y, nodes[i].z]
        )
        console.log('label for node:', nodes[i].label)
      }
    }
  }

  addConnectomeNode(node) {
    console.log('adding node', node)
    this.nodes.push(node)
    this.updateLabels()
    this.nodesChanged.dispatchEvent(new CustomEvent('nodeAdded', { detail: { node } }))
  }

  deleteConnectomeNode(node) {
    // delete any connected edges
    const index = this.nodes.indexOf(node)
    this.edges = this.edges.filter((e) => e.first !== index && e.second !== index)
    this.nodes = this.nodes.filter((n) => n !== node)

    this.updateLabels()
    this.updateConnectome(this.gl)
    this.nodesChanged.dispatchEvent(new CustomEvent('nodeDeleted', { detail: { node } }))
  }

  updateConnectomeNodeByIndex(index, updatedNode) {
    this.nodes[index] = updatedNode
    this.updateLabels()
    this.updateConnectome(this.gl)
    this.nodesChanged.dispatchEvent(new CustomEvent('nodeChanged', { detail: { node: updatedNode } }))
  }

  updateConnectomeNodeByPoint(point, updatedNode) {
    if (!this.connectome.nodes) {
      throw new Error('Node to update does not exist')
    }
    const node = this.connectome.nodes.find((node) => NVUtilities.arraysAreEqual([node.x, node.y, node.z], point))
    if (!node) {
      throw new Error(`Node with point ${point} to update does not exist`)
    }
    const index = this.connectome.nodes.findIndex((n) => n === node)
    this.updateConnectomeNodeByIndex(index, updatedNode)
  }

  addConnectomeEdge(first, second, colorValue) {
    let edge = this.edges.find(
      (f) => (f.first === first || f.second === first) && f.first + f.second === first + second
    )
    if (edge) {
      return edge
    }
    edge = { first, second, colorValue }
    this.edges.push(edge)
    this.updateConnectome(this.gl)
    return edge
  }

  deleteConnectomeEdge(first, second) {
    const edge = this.edges.find(
      (f) => (f.first === first || f.first === second) && f.first + f.second === first + second
    )
    if (edge) {
      this.edges = this.edges.filter((e) => e !== edge)
    } else {
      throw new Error(`edge between ${first} and ${second} not found`)
    }
    this.updateConnectome(this.gl)
    return edge
  }

  /**
   *
   * @param {number[]} point
   * @param {number} distance
   * @returns {NVConnectomeNode|null}
   */
  findClosestConnectomeNode(point, distance) {
    if (!this.nodes || this.nodes.length === 0) {
      return null
    }

    let closeNodes = this.nodes.map((n, i) => ({
      distance: Math.sqrt(Math.pow(n.x - point[0], 2) + Math.pow(n.y - point[1], 2) + Math.pow(n.z - point[2], 2)),
      index: i
    }))

    closeNodes = closeNodes.filter((n) => n.distance < distance)
    if (closeNodes) {
      closeNodes.sort((a, b) => a.distance - b.distance)
    } else {
      return null
    }

    return this.nodes[closeNodes[0].index]
  }

  updateConnectome(gl) {
    const tris = []
    const pts = []
    const rgba255 = []
    let lut = cmapper.colormap(this.nodeColormap, this.colormapInvert)
    let lutNeg = cmapper.colormap(this.nodeColormapNegative, this.colormapInvert)
    let hasNeg = 'nodeColormapNegative' in this
    let min = this.nodeMinColor
    let max = this.nodeMaxColor
    const nNode = this.nodes.length
    for (let i = 0; i < nNode; i++) {
      const radius = this.nodes[i].sizeValue * this.nodeScale
      if (radius <= 0.0) {
        continue
      }
      let color = this.nodes[i].colorValue
      let isNeg = false
      if (hasNeg && color < 0) {
        isNeg = true
        color = -color
      }
      if (min < max) {
        if (color < min) {
          continue
        }
        color = (color - min) / (max - min)
      } else {
        color = 1.0
      }
      color = Math.round(Math.max(Math.min(255, color * 255)), 1) * 4
      let rgba = [lut[color], lut[color + 1], lut[color + 2], 255]
      if (isNeg) {
        rgba = [lutNeg[color], lutNeg[color + 1], lutNeg[color + 2], 255]
      }
      const pt = [this.nodes[i].x, this.nodes[i].y, this.nodes[i].z]

      NiivueObject3D.makeColoredSphere(pts, tris, rgba255, radius, pt, rgba)
    }

    lut = cmapper.colormap(this.edgeColormap, this.colormapInvert)
    lutNeg = cmapper.colormap(this.edgeColormapNegative, this.colormapInvert)
    hasNeg = 'edgeColormapNegative' in this
    min = this.edgeMin
    max = this.edgeMax
    for (const edge of this.edges) {
      let color = edge.colorValue
      const isNeg = hasNeg && color < 0
      if (isNeg) {
        color = -color
      }
      const radius = color * this.edgeScale
      if (radius <= 0) {
        continue
      }
      if (min < max) {
        if (color < min) {
          continue
        }
        color = (color - min) / (max - min)
      } else {
        color = 1.0
      }
      color = Math.round(Math.max(Math.min(255, color * 255)), 1) * 4
      let rgba = [lut[color], lut[color + 1], lut[color + 2], 255]
      if (isNeg) {
        rgba = [lutNeg[color], lutNeg[color + 1], lutNeg[color + 2], 255]
      }
      const pti = [this.nodes[edge.first].x, this.nodes[edge.first].y, this.nodes[edge.first].z]
      const ptj = [this.nodes[edge.second].x, this.nodes[edge.second].y, this.nodes[edge.second].z]
      NiivueObject3D.makeColoredCylinder(pts, tris, rgba255, pti, ptj, radius, rgba)
    }

    // calculate spatial extent of connectome: user adjusting node sizes may influence size
    const obj = NVMeshUtilities.getExtents(pts)

    this.furthestVertexFromOrigin = obj.mxDx
    this.extentsMin = obj.extentsMin
    this.extentsMax = obj.extentsMax
    const posNormClr = this.generatePosNormClr(pts, tris, rgba255)
    // generate webGL buffers and vao
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int32Array(tris), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(posNormClr), gl.STATIC_DRAW)
    this.indexCount = tris.length
  }

  updateMesh(gl: WebGL2RenderingContext): void {
    this.updateConnectome(gl)
  }

  json(): Record<string, unknown> {
    const json: Record<string, unknown> = {}
    for (const prop in this) {
      if (prop in defaultOptions || prop === 'nodes' || prop === 'edges') {
        json[prop] = this[prop]
      }
    }
    return json
  }

  /**
   * Factory method to create connectome from options
   * @static
   * @param {WebGL2RenderingContext} gl
   * @param {string} url
   * @returns {NVConnectome}
   */
  static async loadConnectomeFromUrl(gl: WebGL2RenderingContext, url: string): Promise<NVConnectome> {
    const response = await fetch(url)
    const json = await response.json()
    return new NVConnectome(gl, json)
  }
}
