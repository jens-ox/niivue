import { ReadResult } from '../types.js'

export const readTxtSTL = (buffer: ArrayBuffer): ReadResult => {
  const enc = new TextDecoder('utf-8')
  const txt = enc.decode(buffer)
  const lines = txt.split('\n')
  if (!lines[0].startsWith('solid')) {
    throw new Error('Not a valid STL file')
  }
  const pts = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].includes('vertex')) {
      continue
    }
    const items = lines[i].trim().split(/\s+/)
    for (let j = 1; j < items.length; j++) {
      pts.push(parseFloat(items[j]))
    }
  }
  const npts = Math.floor(pts.length / 3) // each vertex has x,y,z
  if (npts * 3 !== pts.length) {
    throw new Error('Unable to parse ASCII STL file.')
  }
  const positions = new Float32Array(pts)
  const indices = new Int32Array(npts)
  for (let i = 0; i < npts; i++) {
    indices[i] = i
  }
  return {
    positions,
    indices
  }
}
