export const readSTC = (buffer: ArrayBuffer, n_vert: number): Float32Array => {
  // https://github.com/fahsuanlin/fhlin_toolbox/blob/400cb73cda4880d9ad7841d9dd68e4e9762976bf/codes/inverse_read_stc.m
  // let len = buffer.byteLength;
  const reader = new DataView(buffer)
  // first 12 bytes are header
  // let epoch_begin_latency = reader.getFloat32(0, false);
  // let sample_period = reader.getFloat32(4, false);
  const n_vertex = reader.getInt32(8, false)
  if (n_vertex !== n_vert) {
    throw new Error('Overlay has ' + n_vertex + ' vertices, expected ' + n_vert)
  }
  // next 4*n_vertex bytes are vertex IDS
  let pos = 12 + n_vertex * 4
  // next 4 bytes reports number of volumes/time points
  const n_time = reader.getUint32(pos, false)
  pos += 4
  const f32 = new Float32Array(n_time * n_vertex)
  // reading all floats with .slice() would be faster, but lets handle endian-ness
  for (let i = 0; i < n_time * n_vertex; i++) {
    f32[i] = reader.getFloat32(pos, false)
    pos += 4
  }
  return f32
} // readSTC()
