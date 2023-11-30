import { ReadResult } from '../types.js'

export const readICO = (buffer: ArrayBuffer): ReadResult => {
  const enc = new TextDecoder('utf-8')
  const txt = enc.decode(buffer)
  const lines = txt.split('\n')
  let header = lines[0].trim().split(/\s+/)
  // read line 0: header
  // FreeSurfer header has one item: [0]'num_verts'
  // Bourke header has 2 items: [0]'num_verts', [1]'num_faces'
  if (header.length > 1) {
    console.log('This is not a valid FreeSurfer ICO/TRI mesh.')
  }
  const num_v = parseInt(header[0])
  // read vertices: each line has 4 values: index, x, y, z
  const positions = new Float32Array(num_v * 3)
  // let v = 0;
  let line = 1 // line 0 is header
  for (let i = 0; i < num_v; i++) {
    const items = lines[line].trim().split(/\s+/)
    line++
    // idx is indexed from 1, not 0
    let idx = parseInt(items[0]) - 1
    const x = parseFloat(items[1])
    const y = parseFloat(items[2])
    const z = parseFloat(items[3])
    if (idx < 0 || idx >= num_v) {
      console.log('ICO vertices corrupted')
      break
    }
    idx *= 3
    positions[idx] = x
    positions[idx + 1] = y
    positions[idx + 2] = z
  } // read all vertices
  // read faces
  header = lines[line].trim().split(/\s+/)
  line++
  const num_f = parseInt(header[0])
  const indices = new Int32Array(num_f * 3)
  for (let i = 0; i < num_f; i++) {
    const items = lines[line].trim().split(/\s+/)
    line++
    // all values indexed from 1, not 0
    let idx = parseInt(items[0]) - 1
    const x = parseInt(items[1]) - 1
    const y = parseInt(items[2]) - 1
    const z = parseInt(items[3]) - 1
    if (idx < 0 || idx >= num_f) {
      console.log('ICO indices corrupted')
      break
    }
    idx *= 3
    indices[idx] = x
    indices[idx + 1] = y
    indices[idx + 2] = z
  } // read all faces
  // FreeSurfer seems to enforce clockwise winding: reverse to CCW
  for (let j = 0; j < indices.length; j += 3) {
    const tri = indices[j]
    indices[j] = indices[j + 1]
    indices[j + 1] = tri
  }
  return {
    positions,
    indices
  }
}
