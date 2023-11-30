import { decompressSync } from 'fflate/browser'

type SMPMap = {
  mapType: number
  nLags: number
  mnLag: number
  mxLag: number
  ccOverlay: number
  clusterSize: number
  clusterCheck: number
  critThresh: number
  maxThresh: number
  includeValuesGreaterThreshMax: number
  df1: number
  df2: number
  posNegFlag: number
  cortexBonferroni: number
  posMinRGB: [number, number, number]
  posMaxRGB: [number, number, number]
  negMinRGB: [number, number, number]
  negMaxRGB: [number, number, number]
  enableSMPColor: number
  colorAlpha: number
  lut: string
  name: string
}

export const readSMP = (buffer: ArrayBuffer, n_vert: number): Float32Array => {
  const len = buffer.byteLength
  let reader = new DataView(buffer)
  let vers = reader.getUint16(0, true)
  if (vers > 5) {
    // assume gzip
    const raw = decompressSync(new Uint8Array(buffer))
    reader = new DataView(raw.buffer)
    vers = reader.getUint16(0, true)
    buffer = raw.buffer
  }
  if (vers > 5) {
    console.log('Unsupported or invalid BrainVoyager SMP version ' + vers)
  }
  const nvert = reader.getUint32(2, true)
  if (nvert !== n_vert) {
    console.log('SMP file has ' + nvert + ' vertices, background mesh has ' + n_vert)
  }
  const nMaps = reader.getUint16(6, true)

  const scalars = new Float32Array(nvert * nMaps)
  const maps = []
  // read Name of SRF
  let pos = 9

  function readStr(): string {
    const startPos = pos
    while (pos < len && reader.getUint8(pos) !== 0) {
      pos++
    }
    pos++ // skip null termination
    return new TextDecoder().decode(buffer.slice(startPos, pos - 1))
  } // readStr: read variable length string

  const _filenameSRF = readStr()

  for (let i = 0; i < nMaps; i++) {
    const m: Partial<SMPMap> = {}

    m.mapType = reader.getUint32(pos, true)
    pos += 4
    // Read additional values only if a lag map
    if (vers >= 3 && m.mapType === 3) {
      m.nLags = reader.getUint32(pos, true)
      pos += 4
      m.mnLag = reader.getUint32(pos, true)
      pos += 4
      m.mxLag = reader.getUint32(pos, true)
      pos += 4
      m.ccOverlay = reader.getUint32(pos, true)
      pos += 4
    }
    m.clusterSize = reader.getUint32(pos, true)
    pos += 4
    m.clusterCheck = reader.getUint8(pos)
    pos += 1
    m.critThresh = reader.getFloat32(pos, true)
    pos += 4
    m.maxThresh = reader.getFloat32(pos, true)
    pos += 4
    if (vers >= 4) {
      m.includeValuesGreaterThreshMax = reader.getUint32(pos, true)
      pos += 4
    }
    m.df1 = reader.getUint32(pos, true)
    pos += 4
    m.df2 = reader.getUint32(pos, true)
    pos += 4
    if (vers >= 5) {
      m.posNegFlag = reader.getUint32(pos, true)
      pos += 4
    } else {
      m.posNegFlag = 3
    }
    m.cortexBonferroni = reader.getUint32(pos, true)
    pos += 4
    m.posMinRGB = [0, 0, 0]
    m.posMaxRGB = [0, 0, 0]
    m.negMinRGB = [0, 0, 0]
    m.negMaxRGB = [0, 0, 0]
    if (vers >= 2) {
      m.posMinRGB[0] = reader.getUint8(pos)
      pos++
      m.posMinRGB[1] = reader.getUint8(pos)
      pos++
      m.posMinRGB[2] = reader.getUint8(pos)
      pos++
      m.posMaxRGB[0] = reader.getUint8(pos)
      pos++
      m.posMaxRGB[1] = reader.getUint8(pos)
      pos++
      m.posMaxRGB[2] = reader.getUint8(pos)
      pos++
      if (vers >= 4) {
        m.negMinRGB[0] = reader.getUint8(pos)
        pos++
        m.negMinRGB[1] = reader.getUint8(pos)
        pos++
        m.negMinRGB[2] = reader.getUint8(pos)
        pos++
        m.negMaxRGB[0] = reader.getUint8(pos)
        pos++
        m.negMaxRGB[1] = reader.getUint8(pos)
        pos++
        m.negMaxRGB[2] = reader.getUint8(pos)
        pos++
      } // vers >= 4
      m.enableSMPColor = reader.getUint8(pos)
      pos++
      if (vers >= 4) {
        m.lut = readStr()
      }
      m.colorAlpha = reader.getFloat32(pos, true)
      pos += 4
    } // vers >= 2
    m.name = readStr()
    const scalarsNew = new Float32Array(buffer, pos, nvert)
    scalars.set(scalarsNew, i * nvert)
    pos += nvert * 4
    maps.push(m)
  } // for i to nMaps
  return scalars
}
