import { LUT, cmapper } from '../colortables.js'

export type ANNOT =
  | {
      scalars: Float32Array
      colormapLabel: LUT
    }
  | Uint32Array

export const readANNOT = (buffer: ArrayBuffer, n_vert: number, isReadColortables = false): ANNOT => {
  const view = new DataView(buffer) // ArrayBuffer to dataview
  // ALWAYS big endian
  const n_vertex = view.getUint32(0, false)
  if (n_vert !== n_vertex) {
    throw new Error('ANNOT file has different number of vertices than mesh')
  }
  if (buffer.byteLength < 4 + 8 * n_vertex) {
    throw new Error('ANNOT file smaller than specified')
  }
  let pos = 0
  // reading all floats with .slice() would be faster, but lets handle endian-ness
  const rgba32 = new Uint32Array(n_vertex)
  for (let i = 0; i < n_vertex; i++) {
    const idx = view.getUint32((pos += 4), false)
    rgba32[idx] = view.getUint32((pos += 4), false)
  }
  if (!isReadColortables) {
    // only read label colors, ignore labels
    return rgba32
  }
  let tag = 0
  try {
    tag = view.getInt32((pos += 4), false)
  } catch (error) {
    return rgba32
  }
  const TAG_OLD_COLORTABLE = 1
  if (tag !== TAG_OLD_COLORTABLE) {
    // undocumented old format
    return rgba32
  }
  const ctabversion = view.getInt32((pos += 4), false)
  if (ctabversion > 0) {
    // undocumented old format
    return rgba32
  }
  const maxstruc = view.getInt32((pos += 4), false)
  const len = view.getInt32((pos += 4), false)
  pos += len
  const num_entries = view.getInt32((pos += 4), false)
  if (num_entries < 1) {
    // undocumented old format
    return rgba32
  }
  // preallocate lookuptable
  const LUT = {
    R: Array(maxstruc).fill(0),
    G: Array(maxstruc).fill(0),
    B: Array(maxstruc).fill(0),
    A: Array(maxstruc).fill(0),
    I: Array(maxstruc).fill(0),
    labels: Array(maxstruc).fill('')
  }
  for (let i = 0; i < num_entries; i++) {
    const struc = view.getInt32((pos += 4), false)
    const labelLen = view.getInt32((pos += 4), false)
    pos += 4
    let txt = ''
    for (let c = 0; c < labelLen; c++) {
      const val = view.getUint8(pos++)
      if (val === 0) {
        break
      }
      txt += String.fromCharCode(val)
    }
    pos -= 4
    const R = view.getInt32((pos += 4), false)
    const G = view.getInt32((pos += 4), false)
    const B = view.getInt32((pos += 4), false)
    const A = view.getInt32((pos += 4), false)
    if (struc < 0 || struc >= maxstruc) {
      console.log('annot entry out of range')
      continue
    }
    LUT.R[struc] = R
    LUT.G[struc] = G
    LUT.B[struc] = B
    LUT.A[struc] = A
    LUT.I[struc] = (A << 24) + (B << 16) + (G << 8) + R
    LUT.labels[struc] = txt
  }
  const scalars = new Float32Array(n_vertex)
  scalars.fill(-1)
  let nError = 0
  for (let i = 0; i < n_vert; i++) {
    const RGB = rgba32[i]
    for (let c = 0; c < maxstruc; c++) {
      if (LUT.I[c] === RGB) {
        scalars[i] = c
        break
      }
    } // for c
    if (scalars[i] < 0) {
      nError++
      scalars[i] = 0
    }
  }
  if (nError > 0) {
    console.log(`annot vertex colors do not match ${nError} of ${n_vertex} vertices.`)
  }
  for (let i = 0; i < maxstruc; i++) {
    LUT.I[i] = i
  }
  const colormapLabel = cmapper.makeLabelLut(LUT)
  return {
    scalars,
    colormapLabel
  }
}
