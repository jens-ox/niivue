import { decompressSync } from 'fflate/browser'
import { ColorMap, LUT, cmapper } from '../colortables.js'

export type MGH =
  | number[]
  | {
      scalars: number[]
      colormapLabel: LUT
    }

export const readMGH = (buffer: ArrayBuffer, n_vert = 0, isReadColortables = false): MGH => {
  let reader = new DataView(buffer)
  const raw = buffer
  if (reader.getUint8(0) === 31 && reader.getUint8(1) === 139) {
    const decompressed = decompressSync(new Uint8Array(buffer))
    reader = new DataView(decompressed.buffer)
  }
  const version = reader.getInt32(0, false)
  const width = Math.max(1, reader.getInt32(4, false))
  const height = Math.max(1, reader.getInt32(8, false))
  const depth = Math.max(1, reader.getInt32(12, false))
  const nframes = Math.max(1, reader.getInt32(16, false))
  const mtype = reader.getInt32(20, false)
  let voxoffset = 284 // ALWAYS fixed header size
  const isLittleEndian = false // ALWAYS byte order is BIG ENDIAN
  if (version !== 1 || mtype < 0 || mtype > 4) {
    console.log('Not a valid MGH file')
  }
  const nvert = width * height * depth * nframes
  let scalars: number[] | Float32Array | Int32Array | Int16Array | Uint8Array = []
  if (nvert % n_vert !== 0) {
    throw new Error('Vertices in NIfTI (' + nvert + ') is not a multiple of number of vertices (' + n_vert + ')')
  }
  if (mtype === 3) {
    scalars = new Float32Array(nvert)
    for (let i = 0; i < nvert; i++) {
      scalars[i] = reader.getFloat32(voxoffset + i * 4, isLittleEndian)
    }
  } else if (mtype === 1) {
    scalars = new Int32Array(nvert)
    for (let i = 0; i < nvert; i++) {
      scalars[i] = reader.getInt32(voxoffset + i * 4, isLittleEndian)
    }
  } else if (mtype === 4) {
    scalars = new Int16Array(nvert)
    for (let i = 0; i < nvert; i++) {
      scalars[i] = reader.getInt16(voxoffset + i * 2, isLittleEndian)
    }
  } else if (mtype === 0) {
    scalars = new Uint8Array(buffer, voxoffset, nvert)
  }
  if (!isReadColortables) {
    return Array.from(scalars)
  }
  // next: read footer
  let bytesPerVertex = 4
  if (mtype === 4) {
    bytesPerVertex = 2
  }
  if (mtype === 0) {
    bytesPerVertex = 1
  }
  voxoffset += bytesPerVertex * nvert
  voxoffset += 4 * 4 // skip TR, FlipAngle, TE, TI, FOV
  const TAG_OLD_COLORTABLE = 1
  const TAG_OLD_USEREALRAS = 2
  // const TAG_CMDLINE = 3;
  // const TAG_USEREALRAS = 4;
  // const TAG_COLORTABLE = 5;
  // const TAG_GCAMORPH_GEOM = 10;
  // const TAG_GCAMORPH_TYPE = 11;
  // const TAG_GCAMORPH_LABELS = 12;
  const TAG_OLD_SURF_GEOM = 20
  // const TAG_SURF_GEOM = 21;
  const TAG_OLD_MGH_XFORM = 30
  // const TAG_MGH_XFORM = 31;
  // const TAG_GROUP_AVG_SURFACE_AREA = 32;
  // const TAG_AUTO_ALIGN = 33;
  // const TAG_SCALAR_DOUBLE = 40;
  // const TAG_PEDIR = 41;
  // const TAG_MRI_FRAME = 42;
  // const TAG_FIELDSTRENGTH = 43;
  // const TAG_ORIG_RAS2VOX = 44;
  const nBytes = raw.byteLength
  let colormapLabel: LUT
  while (voxoffset < nBytes - 8) {
    // let vx = voxoffset;
    const tagType = reader.getInt32((voxoffset += 4), isLittleEndian)
    let plen = 0
    switch (tagType) {
      case TAG_OLD_MGH_XFORM:
        // doesn't include null
        plen = reader.getInt32((voxoffset += 4), isLittleEndian) - 1
        break
      case TAG_OLD_SURF_GEOM: // these don't take lengths at all
      case TAG_OLD_USEREALRAS:
        plen = 0
        break
      case TAG_OLD_COLORTABLE:
        plen = 0
        // CTABreadFromBinary()
        {
          let version = reader.getInt32((voxoffset += 4), isLittleEndian)
          if (version > 0) {
            throw new Error('unsupported CTABreadFromBinaryV1')
          }
          version = -version
          if (version !== 2) {
            throw new Error('CTABreadFromBinary: unknown version')
          }
          // CTABreadFromBinaryV2() follows
          const nentries = reader.getInt32((voxoffset += 4), isLittleEndian)
          if (nentries < 0) {
            throw new Error(`CTABreadFromBinaryV2: nentries was ${nentries}`)
          }
          // skip the file name
          const len = reader.getInt32((voxoffset += 4), isLittleEndian)
          voxoffset += len
          const num_entries_to_read = reader.getInt32((voxoffset += 4), isLittleEndian)
          if (num_entries_to_read < 0) {
            return Array.from(scalars)
          }
          // Allocate our table.
          const Labels: ColorMap = { R: [], G: [], B: [], A: [], I: [], labels: [] }
          for (let i = 0; i < num_entries_to_read; i++) {
            const structure = reader.getInt32((voxoffset += 4), isLittleEndian)
            const labelLen = reader.getInt32((voxoffset += 4), isLittleEndian)
            let pos = voxoffset + 4
            let txt = ''
            for (let c = 0; c < labelLen; c++) {
              const val = reader.getUint8(pos++)
              if (val === 0) {
                break
              }
              txt += String.fromCharCode(val)
            } // for labelLen
            voxoffset += labelLen
            const R = reader.getInt32((voxoffset += 4), isLittleEndian)
            const G = reader.getInt32((voxoffset += 4), isLittleEndian)
            const B = reader.getInt32((voxoffset += 4), isLittleEndian)
            const A = 255 - reader.getInt32((voxoffset += 4), isLittleEndian)
            Labels.I.push(structure)
            Labels.R.push(R)
            Labels.G.push(G)
            Labels.B.push(B)
            Labels.A.push(A)
            Labels.labels!.push(txt)
            // break
          } // for num_entries_to_read
          colormapLabel = cmapper.makeLabelLut(Labels)
        }
        break
      default:
        plen = reader.getInt32((voxoffset += 8), isLittleEndian)
    }
    voxoffset += plen
  }
  return {
    scalars: Array.from(scalars),
    colormapLabel: colormapLabel!
  }
}
