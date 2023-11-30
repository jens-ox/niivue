import { ReadResult } from '../types.js'

export const readGEO = (buffer: ArrayBuffer, isFlipWinding = false): ReadResult => {
  const enc = new TextDecoder('utf-8')
  const txt = enc.decode(buffer)
  const lines = txt.split('\n')
  const header = lines[0].trim().split(/\s+/)
  // read line 0: header
  // header[0]='nparts', [1]'npoints/vertices', [2]'npolys/faces', [3]'nconnects'
  const num_p = parseInt(header[0])
  let num_v = parseInt(header[1])
  let num_f = parseInt(header[2])
  const num_c = parseInt(header[3])
  if (num_p > 1 || num_c !== num_f * 3) {
    console.log('Multi-part BYU/GEO header or not a triangular mesh.')
  }
  // skip line 1: it is redundant (contains number of faces once more)
  // next read the vertices (points)
  const pts = []
  num_v *= 3 // each vertex has three components (x,y,z)
  let v = 0
  let line = 2 // line 0 and 1 are header
  while (v < num_v) {
    const items = lines[line].trim().split(/\s+/)
    line++
    for (let i = 0; i < items.length; i++) {
      pts.push(parseFloat(items[i]))
      v++
      if (v >= num_v) {
        break
      }
    } // for each item
  } // read all vertices
  // next read faces (triangles)
  const t: number[] = []
  num_f *= 3 // each triangle has three vertices (i,j,k)
  let f = 0
  while (f < num_f) {
    const items = lines[line].trim().split(/\s+/)
    line++
    for (let i = 0; i < items.length; i++) {
      t.push(Math.abs(parseInt(items[i])) - 1)
      f++
      if (f >= num_f) {
        break
      }
    } // for each item
  } // read all faces
  // FreeSurfer seems to enforce clockwise winding: reverse to CCW
  if (isFlipWinding) {
    for (let j = 0; j < t.length; j += 3) {
      const tri = t[j]
      t[j] = t[j + 1]
      t[j + 1] = tri
    }
  }
  // return results
  const positions = new Float32Array(pts)
  const indices = new Int32Array(t)
  return {
    positions,
    indices
  }
}
