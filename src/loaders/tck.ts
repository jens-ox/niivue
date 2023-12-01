export type TCK = {
  pts: number[]
  offsetPt0: number[]
}

export const readTCK = (buffer: ArrayBuffer): TCK => {
  const len = buffer.byteLength
  if (len < 20) {
    throw new Error('File too small to be TCK: bytes = ' + len)
  }
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
  let line = readStr() // 1st line: signature 'mrtrix tracks'
  if (!line.includes('mrtrix tracks')) {
    throw new Error('Not a valid TCK file')
  }
  let offset = -1 // "file: offset" is REQUIRED
  while (pos < len && !line.includes('END')) {
    line = readStr()
    if (line.toLowerCase().startsWith('file:')) {
      offset = parseInt(line.split(' ').pop()!)
    }
  }
  if (offset < 20) {
    throw new Error('Not a valid TCK file (missing file offset)')
  }
  pos = offset
  const reader = new DataView(buffer)
  // read and transform vertex positions
  let npt = 0
  const offsetPt0 = []
  offsetPt0.push(npt) // 1st streamline starts at 0
  const pts = []
  while (pos + 12 < len) {
    const ptx = reader.getFloat32(pos, true)
    pos += 4
    const pty = reader.getFloat32(pos, true)
    pos += 4
    const ptz = reader.getFloat32(pos, true)
    pos += 4
    if (!isFinite(ptx)) {
      // both NaN and Infinity are not finite
      offsetPt0.push(npt)
      if (!isNaN(ptx)) {
        // terminate if infinity
        break
      }
    } else {
      pts.push(ptx)
      pts.push(pty)
      pts.push(ptz)
      npt++
    }
  }
  return {
    pts,
    offsetPt0
  }
}
