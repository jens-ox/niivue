import { ReadResult } from '../types.js'
import { TxtVtk, readTxtVTK } from './txt-vtk.js'

export type VTK =
  | TxtVtk
  | {
      pts: Float32Array
      offsetPt0: Uint32Array
    }
  | ReadResult

export const readVTK = (buffer: ArrayBuffer): VTK => {
  const len = buffer.byteLength
  if (len < 20) {
    throw new Error('File too small to be VTK: bytes = ' + buffer.byteLength)
  }
  const bytes = new Uint8Array(buffer)
  let pos = 0

  function readStr(isSkipBlank = true): string {
    if (isSkipBlank) {
      while (pos < len && bytes[pos] === 10) {
        pos++
      }
    } // skip blank lines
    const startPos = pos
    while (pos < len && bytes[pos] !== 10) {
      pos++
    }
    pos++ // skip EOLN
    if (pos - startPos < 1) {
      return ''
    }
    return new TextDecoder().decode(buffer.slice(startPos, pos - 1))
  }
  let line = readStr() // 1st line: signature
  if (!line.startsWith('# vtk DataFile')) {
    throw new Error('Invalid VTK mesh')
  }
  line = readStr(false) // 2nd line comment, n.b. MRtrix stores empty line
  line = readStr() // 3rd line ASCII/BINARY
  if (line.startsWith('ASCII')) {
    return readTxtVTK(buffer)
  } else if (!line.startsWith('BINARY')) {
    throw new Error(`Invalid VTK image, expected ASCII or BINARY: ${line}`)
  }
  line = readStr() // 5th line "DATASET POLYDATA"
  if (!line.includes('POLYDATA')) {
    throw new Error(`Only able to read VTK POLYDATA: ${line}`)
  }
  line = readStr() // 6th line "POINTS 10261 float"
  if (!line.includes('POINTS') || (!line.includes('double') && !line.includes('float'))) {
    throw new Error(`Only able to read VTK float or double POINTS: ${line}`)
  }
  const isFloat64 = line.includes('double')
  let items = line.trim().split(/\s+/)
  const nvert = parseInt(items[1]) // POINTS 10261 float
  const nvert3 = nvert * 3
  const positions = new Float32Array(nvert3)
  const reader = new DataView(buffer)
  if (isFloat64) {
    for (let i = 0; i < nvert3; i++) {
      positions[i] = reader.getFloat64(pos, false)
      pos += 8
    }
  } else {
    for (let i = 0; i < nvert3; i++) {
      positions[i] = reader.getFloat32(pos, false)
      pos += 4
    }
  }
  line = readStr() // Type, "LINES 11885 "
  items = line.trim().split(/\s+/)
  const tris = []
  if (items[0].includes('LINES')) {
    const n_count = parseInt(items[1])
    // tractogaphy data: detect if borked by DiPy
    const posOK = pos
    line = readStr() // borked files "OFFSETS vtktypeint64"
    if (line.startsWith('OFFSETS')) {
      // console.log("invalid VTK file created by DiPy");
      let isInt64 = false
      if (line.includes('int64')) {
        isInt64 = true
      }
      const offsetPt0 = new Uint32Array(n_count)
      if (isInt64) {
        let isOverflowInt32 = false
        for (let c = 0; c < n_count; c++) {
          let idx = reader.getInt32(pos, false)
          if (idx !== 0) {
            isOverflowInt32 = true
          }
          pos += 4
          idx = reader.getInt32(pos, false)
          pos += 4
          offsetPt0[c] = idx
        }
        if (isOverflowInt32) {
          console.log('int32 overflow: JavaScript does not support int64')
        }
      } else {
        for (let c = 0; c < n_count; c++) {
          const idx = reader.getInt32(pos, false)
          pos += 4
          offsetPt0[c] = idx
        }
      }
      const pts = positions
      return {
        pts,
        offsetPt0
      }
    }
    pos = posOK // valid VTK file
    let npt = 0
    const offsetPt0 = []
    const pts = []
    offsetPt0.push(npt) // 1st streamline starts at 0
    for (let c = 0; c < n_count; c++) {
      const numPoints = reader.getInt32(pos, false)
      pos += 4
      npt += numPoints
      offsetPt0.push(npt)
      for (let i = 0; i < numPoints; i++) {
        const idx = reader.getInt32(pos, false) * 3
        pos += 4
        pts.push(positions[idx + 0])
        pts.push(positions[idx + 1])
        pts.push(positions[idx + 2])
      } // for numPoints: number of segments in streamline
    } // for n_count: number of streamlines
    return {
      pts,
      offsetPt0
    }
  } else if (items[0].includes('TRIANGLE_STRIPS')) {
    const nstrip = parseInt(items[1])
    for (let i = 0; i < nstrip; i++) {
      const ntri = reader.getInt32(pos, false) - 2 // -2 as triangle strip is creates pts - 2 faces
      pos += 4
      for (let t = 0; t < ntri; t++) {
        if (t % 2) {
          // preserve winding order
          tris.push(reader.getInt32(pos + 8, false))
          tris.push(reader.getInt32(pos + 4, false))
          tris.push(reader.getInt32(pos, false))
        } else {
          tris.push(reader.getInt32(pos, false))
          tris.push(reader.getInt32(pos + 4, false))
          tris.push(reader.getInt32(pos + 8, false))
        }
        pos += 4
      } // for each triangle
      pos += 8
    } // for each strip
  } else if (items[0].includes('POLYGONS')) {
    const npoly = parseInt(items[1])
    for (let i = 0; i < npoly; i++) {
      const ntri = reader.getInt32(pos, false) - 2 // 3 for single triangle, 4 for 2 triangles
      if (i === 0 && ntri > 65535) {
        throw new Error('Invalid VTK binary polygons using little-endian data (MRtrix)')
      }
      pos += 4
      const fx = reader.getInt32(pos, false)
      pos += 4
      let fy = reader.getInt32(pos, false)
      pos += 4
      for (let t = 0; t < ntri; t++) {
        const fz = reader.getInt32(pos, false)
        pos += 4
        tris.push(fx)
        tris.push(fy)
        tris.push(fz)
        fy = fz
      } // for each triangle
    } // for each polygon
  } else {
    throw new Error(`Unsupported binary VTK datatype: ${items[0]}`)
  }
  const indices = new Int32Array(tris)
  return {
    positions,
    indices
  }
}
