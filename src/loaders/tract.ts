export type TRACT = {
  pts: number[]
  offsetPt0: number[]
  dps: Array<{
    id: string
    vals: number[]
  }>
}

export const readTRACT = (buffer: ArrayBuffer): TRACT => {
  const len = buffer.byteLength
  if (len < 20) {
    throw new Error('File too small to be niml.tract: bytes = ' + len)
  }
  const reader = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let pos = 0

  function readStr(): string {
    // read until right angle bracket ">"
    while (pos < len && bytes[pos] !== 60) {
      pos++
    } // start with "<"
    const startPos = pos
    while (pos < len && bytes[pos] !== 62) {
      pos++
    }
    pos++ // skip EOLN
    if (pos - startPos < 1) {
      return ''
    }
    return new TextDecoder().decode(buffer.slice(startPos, pos - 1)).trim()
  }

  let line = readStr() // 1st line: signature '<network'
  function readNumericTag(TagName: string): number {
    // Tag 'Dim1' will return 3 for Dim1="3"
    const pos = line.indexOf(TagName)
    if (pos < 0) {
      return 0
    }
    const spos = line.indexOf('"', pos) + 1
    const epos = line.indexOf('"', spos)
    const str = line.slice(spos, epos)
    return parseInt(str)
  }
  const n_tracts = readNumericTag('N_tracts=')
  if (!line.startsWith('<network') || n_tracts < 1) {
    console.log('This is not a valid niml.tract file ' + line)
  }
  let npt = 0
  const offsetPt0 = []
  offsetPt0.push(npt) // 1st streamline starts at 0
  const pts = []
  const dps = []
  dps.push({
    id: 'tract',
    vals: [] as number[]
  })
  for (let t = 0; t < n_tracts; t++) {
    line = readStr() // <tracts ...
    const new_tracts = readNumericTag('ni_dimen=')
    const bundleTag = readNumericTag('Bundle_Tag=')
    const isLittleEndian = line.includes('binary.lsbfirst')
    for (let i = 0; i < new_tracts; i++) {
      pos += 4
      const new_pts = reader.getUint32(pos, isLittleEndian) / 3
      pos += 4
      for (let j = 0; j < new_pts; j++) {
        pts.push(reader.getFloat32(pos, isLittleEndian))
        pos += 4
        pts.push(-reader.getFloat32(pos, isLittleEndian))
        pos += 4
        pts.push(reader.getFloat32(pos, isLittleEndian))
        pos += 4
      }
      npt += new_pts
      offsetPt0.push(npt)
      dps[0].vals.push(bundleTag) // each streamline associated with tract
    }
    line = readStr() // </tracts>
  }
  return {
    pts,
    offsetPt0,
    dps
  }
}
