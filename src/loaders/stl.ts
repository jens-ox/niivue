import { ReadResult } from '../types.js'
import { readTxtSTL } from './txt-stl.js'

export const readSTL = (buffer: ArrayBuffer): ReadResult => {
  if (buffer.byteLength < 80 + 4 + 50) {
    throw new Error('File too small to be STL: bytes = ' + buffer.byteLength)
  }
  const reader = new DataView(buffer)
  const sig = reader.getUint32(0, true)
  if (sig === 1768714099) {
    return readTxtSTL(buffer)
  }
  const ntri = reader.getUint32(80, true)
  const ntri3 = 3 * ntri
  if (buffer.byteLength < 80 + 4 + ntri * 50) {
    throw new Error(`STL file too small to store triangles = ${ntri}`)
  }
  const indices = new Int32Array(ntri3)
  const positions = new Float32Array(ntri3 * 3)
  let pos = 80 + 4 + 12
  let v = 0 // vertex
  for (let i = 0; i < ntri; i++) {
    for (let j = 0; j < 9; j++) {
      positions[v] = reader.getFloat32(pos, true)
      v += 1
      pos += 4
    }
    pos += 14 // 50 bytes for triangle, only 36 used for position
  }
  for (let i = 0; i < ntri3; i++) {
    indices[i] = i
  }
  return {
    positions,
    indices
  }
}
