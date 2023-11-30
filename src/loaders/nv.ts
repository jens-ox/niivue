import { ReadResult } from '../types.js'

export const readNV = (buffer: ArrayBuffer): ReadResult => {
  // n.b. clockwise triangle winding, indexed from 1
  const len = buffer.byteLength
  const bytes = new Uint8Array(buffer)
  let pos = 0
  function readStr(): string {
    while (pos < len && bytes[pos] === 10) {
      pos++
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
  let nvert = 0 // 173404 346804
  let ntri = 0
  let v = 0
  let t = 0
  let positions: Float32Array
  let indices: Int32Array
  while (pos < len) {
    const line = readStr()
    if (line.startsWith('#')) {
      continue
    }
    const items = line.trim().split(/\s+/)
    if (nvert < 1) {
      nvert = parseInt(items[0])
      positions = new Float32Array(nvert * 3)
      continue
    }
    if (v < nvert * 3) {
      positions![v] = parseFloat(items[0])
      positions![v + 1] = parseFloat(items[1])
      positions![v + 2] = parseFloat(items[2])
      v += 3
      continue
    }
    if (ntri < 1) {
      ntri = parseInt(items[0])
      indices = new Int32Array(ntri * 3)
      continue
    }
    if (t >= ntri * 3) {
      break
    }
    indices![t + 2] = parseInt(items[0]) - 1
    indices![t + 1] = parseInt(items[1]) - 1
    indices![t + 0] = parseInt(items[2]) - 1
    t += 3
  }
  return {
    positions: positions!,
    indices: indices!
  }
}
