import { ReadResult } from '../types.js'
import { readASC } from './asc.js'

export const readFreeSurfer = (buffer: ArrayBuffer): ReadResult => {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 35 && bytes[1] === 33 && bytes[2] === 97) {
    return readASC(buffer) // "#!ascii version"
  }
  const view = new DataView(buffer) // ArrayBuffer to dataview
  const sig0 = view.getUint32(0, false)
  const sig1 = view.getUint32(4, false)
  if (sig0 !== 4294966883 || sig1 !== 1919246708) {
    throw new Error('Unable to recognize file type: does not appear to be FreeSurfer format.')
  }
  let offset = 0
  while (view.getUint8(offset) !== 10) {
    offset++
  }
  offset += 2
  let nv = view.getUint32(offset, false) // number of vertices
  offset += 4
  let nf = view.getUint32(offset, false) // number of faces
  offset += 4
  nv *= 3 // each vertex has 3 positions: XYZ
  const positions = new Float32Array(nv)
  for (let i = 0; i < nv; i++) {
    positions[i] = view.getFloat32(offset, false)
    offset += 4
  }
  nf *= 3 // each triangle face indexes 3 triangles
  const indices = new Int32Array(nf)
  for (let i = 0; i < nf; i++) {
    indices[i] = view.getUint32(offset, false)
    offset += 4
  }
  // read undocumented footer
  // https://github.com/nipy/nibabel/blob/8fea2a8e50aaf4d8b0d4bfff7a21b132914120ee/nibabel/freesurfer/io.py#L58C5-L58C9
  const head0 = view.getUint32(offset, false)
  offset += 4
  let headOK = head0 === 20

  if (!headOK) {
    throw new Error('Unknown FreeSurfer Mesh extension code.')
  }

  // read two more int32s
  const head1 = view.getUint32(offset, false)
  offset += 4
  const head2 = view.getUint32(offset, false)
  offset += 4
  headOK = head0 === 2 && head1 === 0 && head2 === 20

  const footer = new TextDecoder().decode(buffer.slice(offset)).trim()
  const strings = footer.split('\n')
  for (let s = 0; s < strings.length; s++) {
    if (!strings[s].startsWith('cras')) {
      continue
    }
    const cras = strings[s].split('=')[1].trim()
    const FreeSurferTranlate = cras.split(' ').map(Number)
    const nvert = Math.floor(positions.length / 3)
    let i = 0
    for (let v = 0; v < nvert; v++) {
      positions[i] += FreeSurferTranlate[0]
      i++
      positions[i] += FreeSurferTranlate[1]
      i++
      positions[i] += FreeSurferTranlate[2]
      i++
    }
  }

  return {
    positions,
    indices
  }
}
