import { ReadResult } from '../types.js'

export const readOFF = (buffer: ArrayBuffer): ReadResult => {
  const enc = new TextDecoder('utf-8')
  const txt = enc.decode(buffer)
  // let txt = await response.text();
  const lines = txt.split('\n')
  // var n = lines.length;
  const pts = []
  const t = []
  let i = 0
  // first line signature "OFF", but R freesurfer package uses "# OFF"
  if (!lines[i].includes('OFF')) {
    console.log('File does not start with OFF')
  } else {
    i++
  }
  let items = lines[i].trim().split(/\s+/)
  const num_v = parseInt(items[0])
  const num_f = parseInt(items[1])
  i++
  for (let j = 0; j < num_v; j++) {
    const str = lines[i]
    items = str.trim().split(/\s+/)
    pts.push(parseFloat(items[0]))
    pts.push(parseFloat(items[1]))
    pts.push(parseFloat(items[2]))
    i++
  }
  for (let j = 0; j < num_f; j++) {
    const str = lines[i]
    items = str.trim().split(/\s+/)
    const n = parseInt(items[0])
    if (n !== 3) {
      console.log('Only able to read OFF files with triangular meshes')
    }
    t.push(parseInt(items[1]))
    t.push(parseInt(items[2]))
    t.push(parseInt(items[3]))
    i++
  }
  const positions = new Float32Array(pts)
  const indices = new Int32Array(t)
  return {
    positions,
    indices
  }
}
