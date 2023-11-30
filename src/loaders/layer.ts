import { NVMesh } from '../nvmesh.js'
import { NVMeshLayer } from '../types.js'
import { NVMeshLoaders } from './index.js'

export const readLayer = (
  name: string,
  buffer: ArrayBuffer,
  nvmesh: NVMesh,
  opacity = 0.5,
  colormap = 'warm',
  colormapNegative = 'winter',
  useNegativeCmap = false,
  cal_min = null,
  cal_max = null,
  isOutlineBorder = false
): void => {
  const layer: Partial<NVMeshLayer> = {
    colormapInvert: false,
    alphaThreshold: false,
    isTransparentBelowCalMin: true,
    isAdditiveBlend: false,
    colorbarVisible: true,
    colormapLabel: []
  }

  const isReadColortables = true
  const n_vert = nvmesh.vertexCount ?? 0 / 3 // each vertex has XYZ component
  if (n_vert < 3) {
    // TODO should this throw an error?
    return
  }
  const re = /(?:\.([^.]+))?$/
  let ext = re.exec(name)![1] // TODO can we guarantee this?
  ext = ext.toUpperCase()
  if (ext === 'GZ') {
    ext = re.exec(name.slice(0, -3))![1] // img.trk.gz -> img.trk TODO can we guarantee this?
    ext = ext.toUpperCase()
  }
  if (ext === 'MZ3') {
    layer.values = NVMeshLoaders.readMZ3(buffer, n_vert)
  } else if (ext === 'ANNOT') {
    if (!isReadColortables) {
      layer.values = NVMeshLoaders.readANNOT(buffer, n_vert)
    } else {
      const obj = NVMeshLoaders.readANNOT(buffer, n_vert, true)
      if ('scalars' in obj) {
        layer.values = obj.scalars
        layer.colormapLabel = obj.colormapLabel
      } // unable to decode colormapLabel
      else {
        layer.values = obj
      }
    }
  } else if (ext === 'CRV' || ext === 'CURV') {
    layer.values = NVMeshLoaders.readCURV(buffer, n_vert)
    layer.isTransparentBelowCalMin = false
  } else if (ext === 'GII') {
    const obj = NVMeshLoaders.readGII(buffer, n_vert)
    layer.values = obj.scalars // colormapLabel
    layer.colormapLabel = obj.colormapLabel
  } else if (ext === 'MGH' || ext === 'MGZ') {
    if (!isReadColortables) {
      layer.values = NVMeshLoaders.readMGH(buffer, n_vert)
    } else {
      const obj = NVMeshLoaders.readMGH(buffer, n_vert, true)
      if ('scalars' in obj) {
        layer.values = obj.scalars
        layer.colormapLabel = obj.colormapLabel
      } // unable to decode colormapLabel
      else {
        layer.values = obj
      }
    }
  } else if (ext === 'NII') {
    layer.values = NVMeshLoaders.readNII(buffer, n_vert)
  } else if (ext === 'SMP') {
    layer.values = NVMeshLoaders.readSMP(buffer, n_vert)
  } else if (ext === 'STC') {
    layer.values = NVMeshLoaders.readSTC(buffer, n_vert)
  } else {
    console.log('Unknown layer overlay format ' + name)
    return
  }
  if (!layer.values) {
    return
  }
  layer.nFrame4D = layer.values.length / n_vert
  layer.frame4D = 0
  layer.isOutlineBorder = isOutlineBorder
  // determine global min..max
  let mn = layer.values[0]
  let mx = layer.values[0]
  for (let i = 0; i < layer.values.length; i++) {
    mn = Math.min(mn, layer.values[i])
    mx = Math.max(mx, layer.values[i])
  }
  // console.log('layer range: ', mn, mx);
  layer.global_min = mn
  layer.global_max = mx
  layer.cal_min = cal_min
  if (!cal_min) {
    layer.cal_min = mn
  }
  layer.cal_max = cal_max
  if (!cal_max) {
    layer.cal_max = mx
  }
  layer.cal_minNeg = NaN
  layer.cal_maxNeg = NaN
  layer.opacity = opacity
  layer.colormap = colormap
  layer.colormapNegative = colormapNegative
  layer.useNegativeCmap = useNegativeCmap
  nvmesh.layers.push(layer as NVMeshLayer)
}
