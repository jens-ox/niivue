import { ReadResult } from '../types.js'

export const readASC = (buffer: ArrayBuffer): ReadResult => {
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
  let line = readStr() // 1st line: '#!ascii version of lh.pial'
  if (!line.startsWith('#!ascii')) {
    console.log('Invalid ASC mesh')
  }
  line = readStr() // 1st line: signature
  let items = line.trim().split(/\s+/)
  const nvert = parseInt(items[0]) // 173404 346804
  const ntri = parseInt(items[1])
  const positions = new Float32Array(nvert * 3)
  let j = 0
  for (let i = 0; i < nvert; i++) {
    line = readStr() // 1st line: signature
    items = line.trim().split(/\s+/)
    positions[j] = parseFloat(items[0])
    positions[j + 1] = parseFloat(items[1])
    positions[j + 2] = parseFloat(items[2])
    j += 3
  }
  const indices = new Int32Array(ntri * 3)
  j = 0
  for (let i = 0; i < ntri; i++) {
    line = readStr() // 1st line: signature
    items = line.trim().split(/\s+/)
    indices[j] = parseInt(items[0])
    indices[j + 1] = parseInt(items[1])
    indices[j + 2] = parseInt(items[2])
    j += 3
  }
  return {
    positions,
    indices
  }
}
