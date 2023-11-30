export type DFS = {
  positions: Float32Array
  indices: Int32Array
  colors: Float32Array | null
}

export const readDFS = (buffer: ArrayBuffer): DFS => {
  // Does not play with other formats: vertex positions do not use Aneterior Commissure as origin
  const reader = new DataView(buffer)
  const magic = reader.getUint32(0, true) // "DFS_"
  const LE = reader.getUint16(4, true) // "LE"
  if (magic !== 1599292996 || LE !== 17740) {
    console.log('Not a little-endian brainsuite DFS mesh')
  }
  const hdrBytes = reader.getUint32(12, true)
  // var mdoffset = reader.getUint32(16, true);
  // var pdoffset = reader.getUint32(20, true);
  const nface = reader.getUint32(24, true) // number of triangles
  const nvert = reader.getUint32(28, true)
  // var nStrips = reader.getUint32(32, true); //deprecated
  // var stripSize = reader.getUint32(36, true); //deprecated
  // var normals = reader.getUint32(40, true);
  // var uvStart = reader.getUint32(44, true);
  const vcoffset = reader.getUint32(48, true) // vertexColor offset
  // var precision = reader.getUint32(52, true);
  // float64 orientation[4][4]; //4x4 matrix, affine transformation to world coordinates*)
  let pos = hdrBytes
  const indices = new Int32Array(buffer, pos, nface * 3)
  pos += nface * 3 * 4
  const positions = new Float32Array(buffer, pos, nvert * 3)
  // oops, triangle winding opposite of CCW convention
  for (let i = 0; i < nvert * 3; i += 3) {
    const tmp = positions[i]
    positions[i] = positions[i + 1]
    positions[i + 1] = tmp
  }
  let colors = null
  if (vcoffset >= 0) {
    colors = new Float32Array(buffer, vcoffset, nvert * 3)
  }
  return {
    positions,
    indices,
    colors
  }
}
