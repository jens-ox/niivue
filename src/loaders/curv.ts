export const readCURV = (buffer: ArrayBuffer, n_vert: number): Float32Array => {
  const view = new DataView(buffer) // ArrayBuffer to dataview
  // ALWAYS big endian
  const sig0 = view.getUint8(0)
  const sig1 = view.getUint8(1)
  const sig2 = view.getUint8(2)
  const n_vertex = view.getUint32(3, false)
  // let num_f = view.getUint32(7, false);
  const n_time = view.getUint32(11, false)
  if (sig0 !== 255 || sig1 !== 255 || sig2 !== 255) {
    throw new Error('Unable to recognize file type: does not appear to be FreeSurfer format.')
  }
  if (n_vert !== n_vertex) {
    throw new Error('CURV file has different number of vertices ( ' + n_vertex + ')than mesh (' + n_vert + ')')
  }
  if (buffer.byteLength < 15 + 4 * n_vertex * n_time) {
    throw new Error('CURV file smaller than specified')
  }
  const f32 = new Float32Array(n_time * n_vertex)
  let pos = 15
  // reading all floats with .slice() would be faster, but lets handle endian-ness
  for (let i = 0; i < n_time * n_vertex; i++) {
    f32[i] = view.getFloat32(pos, false)
    pos += 4
  }
  let mn = f32[0]
  let mx = f32[0]
  for (let i = 0; i < f32.length; i++) {
    mn = Math.min(mn, f32[i])
    mx = Math.max(mx, f32[i])
  }
  // normalize
  const scale = 1.0 / (mx - mn)
  for (let i = 0; i < f32.length; i++) {
    f32[i] = 1.0 - (f32[i] - mn) * scale
  }
  return f32
}
