import { decompressSync } from 'fflate/browser'
import { readNII2 } from '../nii2.js'

export const readNII = (buffer: ArrayBuffer, n_vert = 0): number[] => {
  let scalars: number[] | Float32Array | Int32Array | Int16Array | Uint8Array = []
  let isLittleEndian = true
  let reader = new DataView(buffer)
  let magic = reader.getUint16(0, isLittleEndian)
  if (magic === 540 || magic === 469893120) {
    return readNII2(buffer, n_vert)
  }
  if (magic === 23553) {
    isLittleEndian = false
    magic = reader.getUint16(0, isLittleEndian)
  }
  if (magic !== 348) {
    // gzip signature 0x1F8B in little and big endian
    const raw = decompressSync(new Uint8Array(buffer))
    reader = new DataView(raw.buffer)
    buffer = raw.buffer
    magic = reader.getUint16(0, isLittleEndian)
    if (magic === 540 || magic === 469893120) {
      return readNII2(buffer)
    }
    if (magic === 23553) {
      isLittleEndian = false
      magic = reader.getUint16(0, isLittleEndian)
    }
  }
  if (magic !== 348) {
    console.log('Not a valid NIfTI image.')
  }
  const voxoffset = reader.getFloat32(108, isLittleEndian)
  const scl_slope = reader.getFloat32(112, isLittleEndian)
  const scl_inter = reader.getFloat32(116, isLittleEndian)
  if (scl_slope !== 1 || scl_inter !== 0) {
    console.log('ignoring scale slope and intercept')
  }
  const datatype = reader.getUint16(70, isLittleEndian)
  if (datatype !== 2 && datatype !== 4 && datatype !== 8 && datatype !== 16) {
    console.log('Unsupported NIfTI datatype ' + datatype)
    return scalars
  }
  let nvert = 1
  for (let i = 1; i < 8; i++) {
    const dim = reader.getUint16(40 + i * 2, isLittleEndian)
    nvert *= Math.max(dim, 1)
  }
  if (nvert % n_vert !== 0) {
    console.log('Vertices in NIfTI (' + nvert + ') is not a multiple of number of vertices (' + n_vert + ')')
    return scalars
  }
  if (isLittleEndian) {
    // block read native endian
    if (datatype === 16) {
      scalars = new Float32Array(buffer, voxoffset, nvert)
    } else if (datatype === 8) {
      scalars = new Int32Array(buffer, voxoffset, nvert)
    } else if (datatype === 4) {
      scalars = new Int16Array(buffer, voxoffset, nvert)
    }
  } else {
    // if isLittleEndian
    if (datatype === 16) {
      scalars = new Float32Array(nvert)
      for (let i = 0; i < nvert; i++) {
        scalars[i] = reader.getFloat32(voxoffset + i * 4, isLittleEndian)
      }
    } else if (datatype === 8) {
      scalars = new Int32Array(nvert)
      for (let i = 0; i < nvert; i++) {
        scalars[i] = reader.getInt32(voxoffset + i * 4, isLittleEndian)
      }
    } else if (datatype === 4) {
      scalars = new Int16Array(nvert)
      for (let i = 0; i < nvert; i++) {
        scalars[i] = reader.getInt16(voxoffset + i * 2, isLittleEndian)
      }
    }
  } // if isLittleEndian else big end
  if (datatype === 2) {
    scalars = new Uint8Array(buffer, voxoffset, nvert)
  }
  return Array.from(scalars)
}
