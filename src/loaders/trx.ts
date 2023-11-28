import { unzipSync } from 'fflate/browser'

// TODO is this really needed? Or is number[] enough?
type AnyNumberArray =
  | number[]
  | Uint32Array
  | Uint16Array
  | Uint8Array
  | Int32Array
  | Int16Array
  | Int8Array
  | Float64Array
  | Float32Array

export type TRX = {
  pts: AnyNumberArray
  offsetPt0: number[] | Uint32Array
  dpg: Array<{
    id: string
    vals: AnyNumberArray
  }>
  dps: Array<{
    id: string
    vals: AnyNumberArray
  }>
  dpv: Array<{
    id: string
    vals: AnyNumberArray
  }>
  header: unknown
}

// Javascript does not support float16, so we convert to float32
// https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
function decodeFloat16(binary: number): number {
  const exponent = (binary & 0x7c00) >> 10
  const fraction = binary & 0x03ff
  return (
    (binary >> 15 ? -1 : 1) *
    (exponent
      ? exponent === 0x1f
        ? fraction
          ? NaN
          : Infinity
        : Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
      : 6.103515625e-5 * (fraction / 0x400))
  )
} // decodeFloat16()

export const readTRX = (buffer: ArrayBuffer): TRX => {
  let noff = 0
  let npt = 0
  let pts: AnyNumberArray = []
  let offsetPt0: number[] | Uint32Array = []
  const dpg = []
  const dps = []
  const dpv = []
  let header = []
  let isOverflowUint64 = false
  const decompressed = unzipSync(new Uint8Array(buffer), {
    filter(file) {
      return file.originalSize > 0
    }
  })
  const keys = Object.keys(decompressed)
  for (let i = 0, len = keys.length; i < len; i++) {
    const parts = keys[i].split('/')
    const fname = parts.slice(-1)[0] // my.trx/dpv/fx.float32 -> fx.float32
    if (fname.startsWith('.')) {
      continue
    }
    const pname = parts.slice(-2)[0] // my.trx/dpv/fx.float32 -> dpv
    const tag = fname.split('.')[0] // "positions.3.float16 -> "positions"
    // todo: should tags be censored for invalid characters: https://stackoverflow.com/questions/8676011/which-characters-are-valid-invalid-in-a-json-key-name
    const data = decompressed[keys[i]]
    if (fname.includes('header.json')) {
      const jsonString = new TextDecoder().decode(data)
      header = JSON.parse(jsonString)
      continue
    }
    // next read arrays for all possible datatypes: int8/16/32/64 uint8/16/32/64 float16/32/64
    let nval = 0
    let vals: AnyNumberArray
    if (fname.endsWith('.uint64') || fname.endsWith('.int64')) {
      // javascript does not have 64-bit integers! read lower 32-bits
      // note for signed int64 we only read unsigned bytes
      // for both signed and unsigned, generate an error if any value is out of bounds
      // one alternative might be to convert to 64-bit double that has a flintmax of 2^53.
      nval = data.length / 8 // 8 bytes per 64bit input
      vals = new Uint32Array(nval)
      const u32 = new Uint32Array(data.buffer)
      let j = 0
      for (let i = 0; i < nval; i++) {
        vals[i] = u32[j]
        if (u32[j + 1] !== 0) {
          isOverflowUint64 = true
        }
        j += 2
      }
    } else if (fname.endsWith('.uint32')) {
      vals = new Uint32Array(data.buffer)
    } else if (fname.endsWith('.uint16')) {
      vals = new Uint16Array(data.buffer)
    } else if (fname.endsWith('.uint8')) {
      vals = new Uint8Array(data.buffer)
    } else if (fname.endsWith('.int32')) {
      vals = new Int32Array(data.buffer)
    } else if (fname.endsWith('.int16')) {
      vals = new Int16Array(data.buffer)
    } else if (fname.endsWith('.int8')) {
      vals = new Int8Array(data.buffer)
    } else if (fname.endsWith('.float64')) {
      vals = new Float64Array(data.buffer)
    } else if (fname.endsWith('.float32')) {
      vals = new Float32Array(data.buffer)
    } else if (fname.endsWith('.float16')) {
      // javascript does not have 16-bit floats! Convert to 32-bits
      nval = data.length / 2 // 2 bytes per 16bit input
      vals = new Float32Array(nval)
      const u16 = new Uint16Array(data.buffer)
      for (let i = 0; i < nval; i++) {
        vals[i] = decodeFloat16(u16[i])
      }
    } else {
      continue
    } // not a data array
    nval = vals.length

    // next: read data_per_group
    if (pname.includes('groups')) {
      dpg.push({
        id: tag,
        vals: vals.slice()
      })
      continue
    }
    /* if (pname.includes("dpg")) {
      dpg.push({
        id: tag,
        vals: vals.slice(),
      });
      continue;
    } */
    // next: read data_per_vertex
    if (pname.includes('dpv')) {
      dpv.push({
        id: tag,
        vals: vals.slice()
      })
      continue
    }
    // next: read data_per_streamline
    if (pname.includes('dps')) {
      dps.push({
        id: tag,
        vals: vals.slice()
      })
      continue
    }
    // Next: read offsets: Always uint64
    if (fname.startsWith('offsets.')) {
      // javascript does not have 64-bit integers! read lower 32-bits
      noff = nval // 8 bytes per 64bit input
      // we need to solve the fence post problem, so we can not use slice
      offsetPt0 = new Uint32Array(nval + 1)
      for (let i = 0; i < nval; i++) {
        offsetPt0[i] = vals[i]
      }
    }
    if (fname.startsWith('positions.3.')) {
      npt = nval // 4 bytes per 32bit input
      pts = vals.slice()
    }
  }
  if (noff === 0 || npt === 0) {
    throw new Error('Failure reading TRX format (no offsets or points).')
  }
  if (isOverflowUint64) {
    throw new Error('Too many vertices: JavaScript does not support 64 bit integers')
  }
  offsetPt0[noff] = npt / 3 // solve fence post problem, offset for final streamline
  return {
    pts,
    offsetPt0,
    dpg,
    dps,
    dpv,
    header
  }
}
