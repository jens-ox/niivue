import { decompressSync } from 'fflate/browser'
import { mat4 } from 'gl-matrix'

export type TRK = {
  pts: number[]
  offsetPt0: number[]
  dps: Array<{
    id: string
    vals: number[]
  }>
  dpv: Array<{
    id: string
    vals: number[]
  }>
}

export const readTRK = (buffer: ArrayBuffer): TRK => {
  // http://www.tractometer.org/fiberweb/
  // https://github.com/xtk/X/tree/master/io
  // in practice, always little endian
  let reader = new DataView(buffer)
  let magic = reader.getUint32(0, true) // 'TRAC'
  if (magic !== 1128354388) {
    // e.g. TRK.gz
    let raw
    if (magic === 4247762216) {
      // e.g. TRK.zstd
      // raw = fzstd.decompress(new Uint8Array(buffer));
      // raw = new Uint8Array(raw);
      throw new Error('zstd TRK decompression is not supported')
    } else {
      raw = decompressSync(new Uint8Array(buffer))
    }
    buffer = raw.buffer
    reader = new DataView(buffer)
    magic = reader.getUint32(0, true) // 'TRAC'
  }
  const vers = reader.getUint32(992, true) // 2
  const hdr_sz = reader.getUint32(996, true) // 1000
  if (vers > 2 || hdr_sz !== 1000 || magic !== 1128354388) {
    throw new Error('Not a valid TRK file')
  }
  const dps = []
  const dpv = []
  const n_scalars = reader.getInt16(36, true)
  if (n_scalars > 0) {
    // data_per_vertex
    for (let i = 0; i < n_scalars; i++) {
      const arr = new Uint8Array(buffer.slice(38 + i * 20, 58 + i * 20))
      const str = new TextDecoder().decode(arr).split('\0').shift()! // TODO can we guarantee this?
      dpv.push({
        id: str.trim(),
        vals: [] as number[]
      })
    }
  }
  const voxel_sizeX = reader.getFloat32(12, true)
  const voxel_sizeY = reader.getFloat32(16, true)
  const voxel_sizeZ = reader.getFloat32(20, true)
  const zoomMat = mat4.fromValues(
    1 / voxel_sizeX,
    0,
    0,
    -0.5,
    0,
    1 / voxel_sizeY,
    0,
    -0.5,
    0,
    0,
    1 / voxel_sizeZ,
    -0.5,
    0,
    0,
    0,
    1
  )
  const n_properties = reader.getInt16(238, true)
  if (n_properties > 0) {
    for (let i = 0; i < n_properties; i++) {
      const arr = new Uint8Array(buffer.slice(240 + i * 20, 260 + i * 20))
      const str = new TextDecoder().decode(arr).split('\0').shift()! // TODO can we guarantee this?
      dps.push({
        id: str.trim(),
        vals: [] as number[]
      })
    }
  }
  const mat = mat4.create()
  for (let i = 0; i < 16; i++) {
    mat[i] = reader.getFloat32(440 + i * 4, true)
  }
  if (mat[15] === 0.0) {
    // vox_to_ras[3][3] is 0, it means the matrix is not recorded
    console.log('TRK vox_to_ras not set')
    mat4.identity(mat)
  }
  const vox2mmMat = mat4.create()
  mat4.mul(vox2mmMat, mat, zoomMat)
  // translation is in mm and not influenced by resolution
  vox2mmMat[3] = mat[3]
  vox2mmMat[7] = mat[7]
  vox2mmMat[11] = mat[11]
  let i32 = null
  let f32 = null
  i32 = new Int32Array(buffer.slice(hdr_sz))
  f32 = new Float32Array(i32.buffer)
  const ntracks = i32.length
  if (ntracks < 1) {
    throw new Error('Empty TRK file.')
  }
  // read and transform vertex positions
  let i = 0
  let npt = 0
  const offsetPt0 = []
  const pts = []
  while (i < ntracks) {
    const n_pts = i32[i]
    i = i + 1 // read 1 32-bit integer for number of points in this streamline
    offsetPt0.push(npt) // index of first vertex in this streamline
    for (let j = 0; j < n_pts; j++) {
      const ptx = f32[i + 0]
      const pty = f32[i + 1]
      const ptz = f32[i + 2]
      i += 3 // read 3 32-bit floats for XYZ position
      pts.push(ptx * vox2mmMat[0] + pty * vox2mmMat[1] + ptz * vox2mmMat[2] + vox2mmMat[3])
      pts.push(ptx * vox2mmMat[4] + pty * vox2mmMat[5] + ptz * vox2mmMat[6] + vox2mmMat[7])
      pts.push(ptx * vox2mmMat[8] + pty * vox2mmMat[9] + ptz * vox2mmMat[10] + vox2mmMat[11])
      if (n_scalars > 0) {
        for (let s = 0; s < n_scalars; s++) {
          dpv[s].vals.push(f32[i])
          i++
        }
      }
      npt++
    } // for j: each point in streamline
    if (n_properties > 0) {
      for (let j = 0; j < n_properties; j++) {
        dps[j].vals.push(f32[i])
        i++
      }
    }
  } // for each streamline: while i < n_count
  offsetPt0.push(npt) // add 'first index' as if one more line was added (fence post problem)
  return {
    pts,
    offsetPt0,
    dps,
    dpv
  }
}
