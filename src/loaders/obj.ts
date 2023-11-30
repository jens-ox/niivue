import { ReadResult } from '../types.js'

export const readOBJ = (buffer: ArrayBuffer): ReadResult => {
  // WaveFront OBJ format
  const enc = new TextDecoder('utf-8')
  const txt = enc.decode(buffer)
  // let txt = await response.text();
  const lines = txt.split('\n')
  const n = lines.length
  const pts = []
  const t = []
  for (let i = 0; i < n; i++) {
    const str = lines[i]
    if (str[0] === 'v' && str[1] === ' ') {
      // 'v ' but not 'vt' or 'vn'
      const items = str.trim().split(/\s+/)
      pts.push(parseFloat(items[1]))
      pts.push(parseFloat(items[2]))
      pts.push(parseFloat(items[3]))
      // v 0 -0.5 -0
    }
    if (str[0] === 'f') {
      const items = str.trim().split(/\s+/)
      const new_t = items.length - 3 // number of new triangles created
      if (new_t < 1) {
        break
      } // error
      let tn = items[1].split('/')
      const t0 = parseInt(tn[0]) - 1 // first vertex
      tn = items[2].split('/')
      let tprev = parseInt(tn[0]) - 1 // previous vertex
      for (let j = 0; j < new_t; j++) {
        tn = items[3 + j].split('/')
        const tcurr = parseInt(tn[0]) - 1 // current vertex
        t.push(t0)
        t.push(tprev)
        t.push(tcurr)
        tprev = tcurr
      }
    }
  } // for all lines
  const positions = new Float32Array(pts)
  const indices = new Int32Array(t)
  return {
    positions,
    indices
  }
}
