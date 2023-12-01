export type TxtVtk =
  | {
      pts: number[]
      offsetPt0: number[]
    }
  | {
      positions: number[]
      indices: Int32Array
    }

export const readTxtVTK = (buffer: ArrayBuffer): TxtVtk => {
  const enc = new TextDecoder('utf-8')
  const txt = enc.decode(buffer)
  const lines = txt.split('\n')
  const n = lines.length
  if (n < 7 || !lines[0].startsWith('# vtk DataFile')) {
    alert('Invalid VTK image')
  }
  if (!lines[2].startsWith('ASCII')) {
    alert('Not ASCII VTK mesh')
  }
  let pos = 3
  while (lines[pos].length < 1) {
    pos++
  } // skip blank lines
  if (!lines[pos].includes('POLYDATA')) {
    alert('Not ASCII VTK polydata')
  }
  pos++
  while (lines[pos].length < 1) {
    pos++
  } // skip blank lines
  if (!lines[pos].startsWith('POINTS')) {
    alert('Not VTK POINTS')
  }
  let items = lines[pos].trim().split(/\s+/)
  const nvert = parseInt(items[1]) // POINTS 10261 float
  const nvert3 = nvert * 3
  const positions: number[] = []
  let v = 0
  while (v < nvert * 3) {
    pos++
    const str = lines[pos].trim()
    const pts = str.trim().split(/\s+/)
    for (let i = 0; i < pts.length; i++) {
      if (v >= nvert3) {
        break
      }
      positions[v] = parseFloat(pts[i])
      v++
    }
  }
  const tris = []
  pos++
  while (lines[pos].length < 1) {
    pos++
  } // skip blank lines
  items = lines[pos].trim().split(/\s+/)
  pos++
  if (items[0].includes('LINES')) {
    const n_count = parseInt(items[1])
    if (n_count < 1) {
      alert('Corrupted VTK ASCII')
    }
    let str = lines[pos].trim()
    const offsetPt0: number[] = []
    let pts: number[] = []
    if (str.startsWith('OFFSETS')) {
      // 'new' line style https://discourse.vtk.org/t/upcoming-changes-to-vtkcellarray/2066
      pos++
      let c = 0
      while (c < n_count) {
        str = lines[pos].trim()
        pos++
        const items = str.trim().split(/\s+/)
        for (let i = 0; i < items.length; i++) {
          offsetPt0[c] = parseInt(items[i])
          c++
          if (c >= n_count) {
            break
          }
        } // for each line
      } // while offset array not filled
      pts = positions
    } else {
      // classic line style https://www.visitusers.org/index.php?title=ASCII_VTK_Files
      let npt = 0
      pts = []
      offsetPt0[0] = 0 // 1st streamline starts at 0
      let asciiInts: number[] = []
      let asciiIntsPos = 0

      function lineToInts(): void {
        // VTK can save one array across multiple ASCII lines
        str = lines[pos].trim()
        const items = str.trim().split(/\s+/)
        asciiInts = []
        for (let i = 0; i < items.length; i++) {
          asciiInts.push(parseInt(items[i]))
        }
        asciiIntsPos = 0
        pos++
      }

      lineToInts()
      for (let c = 0; c < n_count; c++) {
        if (asciiIntsPos >= asciiInts.length) {
          lineToInts()
        }
        const numPoints = asciiInts[asciiIntsPos++]
        npt += numPoints
        offsetPt0[c + 1] = npt
        for (let i = 0; i < numPoints; i++) {
          if (asciiIntsPos >= asciiInts.length) {
            lineToInts()
          }
          const idx = asciiInts[asciiIntsPos++] * 3
          pts.push(positions[idx + 0]) // X
          pts.push(positions[idx + 1]) // Y
          pts.push(positions[idx + 2]) // Z
        } // for numPoints: number of segments in streamline
      } // for n_count: number of streamlines
    }
    return {
      pts,
      offsetPt0
    }
  } else if (items[0].includes('TRIANGLE_STRIPS')) {
    const nstrip = parseInt(items[1])
    for (let i = 0; i < nstrip; i++) {
      const str = lines[pos].trim()
      pos++
      const vs = str.trim().split(/\s+/)
      const ntri = parseInt(vs[0]) - 2 // -2 as triangle strip is creates pts - 2 faces
      let k = 1
      for (let t = 0; t < ntri; t++) {
        if (t % 2) {
          // preserve winding order
          tris.push(parseInt(vs[k + 2]))
          tris.push(parseInt(vs[k + 1]))
          tris.push(parseInt(vs[k]))
        } else {
          tris.push(parseInt(vs[k]))
          tris.push(parseInt(vs[k + 1]))
          tris.push(parseInt(vs[k + 2]))
        }
        k += 1
      } // for each triangle
    } // for each strip
  } else if (items[0].includes('POLYGONS')) {
    const npoly = parseInt(items[1])
    for (let i = 0; i < npoly; i++) {
      const str = lines[pos].trim()
      pos++
      const vs = str.trim().split(/\s+/)
      const ntri = parseInt(vs[0]) - 2 // e.g. 3 for triangle
      const fx = parseInt(vs[1])
      let fy = parseInt(vs[2])
      for (let t = 0; t < ntri; t++) {
        const fz = parseInt(vs[3 + t])
        tris.push(fx)
        tris.push(fy)
        tris.push(fz)
        fy = fz
      }
    }
  } else {
    alert('Unsupported ASCII VTK datatype ' + items[0])
  }
  const indices = new Int32Array(tris)
  return {
    positions,
    indices
  }
}
