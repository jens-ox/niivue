import { decompressSync } from 'fflate/browser'

export const readMZ3 = (buffer: ArrayBuffer, n_vert = 0) => {
  // ToDo: mz3 always little endian: support big endian? endian https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array
  if (buffer.byteLength < 20) {
    // 76 for raw, not sure of gzip
    throw new Error('File too small to be mz3: bytes = ' + buffer.byteLength)
  }
  let reader = new DataView(buffer)
  // get number of vertices and faces
  let magic = reader.getUint16(0, true)
  let _buffer = buffer
  if (magic === 35615 || magic === 8075) {
    // gzip signature 0x1F8B in little and big endian
    const raw = decompressSync(new Uint8Array(buffer))
    reader = new DataView(raw.buffer)
    magic = reader.getUint16(0, true)
    _buffer = raw.buffer
    // throw new Error( 'Gzip MZ3 file' );
  }
  const attr = reader.getUint16(2, true)
  const nface = reader.getUint32(4, true)
  let nvert = reader.getUint32(8, true)
  const nskip = reader.getUint32(12, true)
  console.log('MZ3 magic %d attr %d face %d vert %d skip %d', magic, attr, nface, nvert, nskip)
  if (magic !== 23117) {
    throw new Error('Invalid MZ3 file')
  }
  const isFace = (attr & 1) !== 0
  const isVert = (attr & 2) !== 0
  const isRGBA = (attr & 4) !== 0
  let isSCALAR = (attr & 8) !== 0
  const isDOUBLE = (attr & 16) !== 0
  // var isAOMap = attr & 32;
  if (attr > 63) {
    throw new Error('Unsupported future version of MZ3 file')
  }
  let bytesPerScalar = 4
  if (isDOUBLE) {
    bytesPerScalar = 8
  }
  let NSCALAR = 0
  if (n_vert > 0 && !isFace && nface < 1 && !isRGBA) {
    isSCALAR = true
  }
  if (isSCALAR) {
    const FSizeWoScalars = 16 + nskip + isFace * nface * 12 + isVert * n_vert * 12 + isRGBA * n_vert * 4
    const scalarFloats = Math.floor((_buffer.byteLength - FSizeWoScalars) / bytesPerScalar)
    if (nvert !== n_vert && scalarFloats % n_vert === 0) {
      console.log('Issue 729: mz3 mismatch scalar NVERT does not match mesh NVERT')
      nvert = n_vert
    }
    NSCALAR = Math.floor(scalarFloats / nvert)
    if (NSCALAR < 1) {
      console.log('Corrupt MZ3: file reports NSCALAR but not enough bytes')
      isSCALAR = false
    }
  }
  if (nvert < 3 && n_vert < 3) {
    throw new Error('Not a mesh MZ3 file (maybe scalar)')
  }
  if (n_vert > 0 && n_vert !== nvert) {
    console.log('Layer has ' + nvert + 'vertices, but background mesh has ' + n_vert)
  }
  let filepos = 16 + nskip
  let indices = null
  if (isFace) {
    indices = new Int32Array(_buffer, filepos, nface * 3)
    filepos += nface * 3 * 4
  }
  let positions = null
  if (isVert) {
    positions = new Float32Array(_buffer, filepos, nvert * 3)
    filepos += nvert * 3 * 4
  }
  let colors = null
  if (isRGBA) {
    colors = new Float32Array(nvert * 3)
    const rgba8 = new Uint8Array(_buffer, filepos, nvert * 4)
    filepos += nvert * 4
    let k3 = 0
    let k4 = 0
    for (let i = 0; i < nvert; i++) {
      for (let j = 0; j < 3; j++) {
        // for RGBA
        colors[k3] = rgba8[k4] / 255
        k3++
        k4++
      }
      k4++ // skip Alpha
    } // for i
  } // if isRGBA
  let scalars = []
  if (!isRGBA && isSCALAR && NSCALAR > 0) {
    if (isDOUBLE) {
      const flt64 = new Float64Array(_buffer, filepos, NSCALAR * nvert)
      scalars = Float32Array.from(flt64)
    } else {
      scalars = new Float32Array(_buffer, filepos, NSCALAR * nvert)
    }
    filepos += bytesPerScalar * NSCALAR * nvert
  }
  if (n_vert > 0) {
    return scalars
  }
  return {
    positions,
    indices,
    scalars,
    colors
  }
} // readMZ3()
