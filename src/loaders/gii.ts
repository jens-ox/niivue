import { decompressSync } from 'fflate/browser'
import { ColorMap, LUT, cmapper } from '../colortables.js'

type XMLTag = {
  name: string
  startPos: number
  contentStartPos: number
  contentEndPos: number
  endPos: number
}

export type GII = {
  scalars: Float32Array
  colormapLabel: LUT | undefined
  positions?: Float32Array
  indices?: Int32Array
}

export const readGII = (buffer: ArrayBuffer, n_vert = 0): GII => {
  let len = buffer.byteLength
  if (len < 20) {
    throw new Error('File too small to be GII: bytes = ' + len)
  }
  let chars = new TextDecoder('ascii').decode(buffer)
  if (chars[0].charCodeAt(0) === 31) {
    // raw GIFTI saved as .gii.gz is smaller than gz GIFTI due to base64 overhead
    const raw = decompressSync(new Uint8Array(buffer))
    buffer = raw.buffer
    chars = new TextDecoder('ascii').decode(raw.buffer)
  }
  let pos = 0
  function readXMLtag(): XMLTag {
    let isEmptyTag = true
    let startPos = pos
    while (isEmptyTag) {
      // while (pos < len && chars[pos] === 10) pos++; //skip blank lines
      while (pos < len && chars[pos] !== '<') {
        pos++
      } // find tag start symbol: '<' e.g. "<tag>"
      startPos = pos
      while (pos < len && chars[pos] !== '>') {
        pos++
      } // find tag end symbol: '>' e.g. "<tag>"
      isEmptyTag = chars[pos - 1] === '/' // empty tag ends "/>" e.g. "<br/>"
      if (startPos + 1 < len && chars[startPos + 1] === '/') {
        // skip end tag "</"
        pos += 1
        isEmptyTag = true
      }
      // let endTagPos = pos;
      if (pos >= len) {
        break
      }
    }
    const tagString = new TextDecoder().decode(buffer.slice(startPos + 1, pos)).trim()
    const startTag = tagString.split(' ')[0].trim()
    // ignore declarations https://stackoverflow.com/questions/60801060/what-does-mean-in-xml
    const contentStartPos = pos
    let contentEndPos = pos
    let endPos = pos
    if (chars[startPos + 1] !== '?' && chars[startPos + 1] !== '!') {
      // ignore declarations "<?" and "<!"
      const endTag = '</' + startTag + '>'
      contentEndPos = chars.indexOf(endTag, contentStartPos)
      endPos = contentEndPos + endTag.length - 1
    }
    // <name>content</name>
    // a    b      c      d
    // a: startPos
    // b: contentStartPos
    // c: contentEndPos
    // d: endPos
    return {
      name: tagString,
      startPos,
      contentStartPos,
      contentEndPos,
      endPos
    } //, 'startTagLastPos': startTagLastPos, 'endTagFirstPos': endTagFirstPos, 'endTagLastPos': endTagLastPos];
  }
  let tag = readXMLtag()
  if (!tag.name.startsWith('?xml')) {
    throw new Error('readGII: Invalid XML file')
  }
  while (!tag.name.startsWith('GIFTI') && tag.endPos < len) {
    tag = readXMLtag()
  }
  if (!tag.name.startsWith('GIFTI') || tag.contentStartPos === tag.contentEndPos) {
    throw new Error('readGII: XML file does not include GIFTI tag')
  }
  len = tag.contentEndPos // only read contents of GIfTI tag
  let positions = new Float32Array()
  let indices = new Int32Array()
  let scalars = new Float32Array()
  let isIdx = false
  let isPts = false
  let isVectors = false
  let isColMajor = false
  let Dims = [1, 1, 1]
  const FreeSurferTranlate = [0, 0, 0] // https://gist.github.com/alexisthual/f0b2f9eb2a67b8f61798f2c138dda981
  let dataType = 0
  // let isLittleEndian = true;
  let isGzip = false
  let isASCII = false
  let nvert = 0
  // FreeSurfer versions after 20221225 disambiguate if transform has been applied
  // "./mris_convert --to-scanner" store raw vertex positions in scanner space, so transforms should be ignored.
  //  FreeSurfer versions after 20221225 report that the transform is applied by reporting:
  //   <DataSpace><![CDATA[NIFTI_XFORM_SCANNER_ANAT
  let isDataSpaceScanner = false
  tag.endPos = tag.contentStartPos // read the children of the 'GIFTI' tag
  let line = ''
  function readNumericTag(TagName: string, isFloat = false): number {
    // Tag 'Dim1' will return 3 for Dim1="3"
    const pos = line.indexOf(TagName)
    if (pos < 0) {
      return 1
    }
    const spos = line.indexOf('"', pos) + 1
    const epos = line.indexOf('"', spos)
    const str = line.slice(spos, epos)
    if (isFloat) {
      return parseFloat(str)
    } else {
      return parseInt(str)
    }
  }
  function readBracketTag(TagName: string): string {
    const pos = line.indexOf(TagName)
    if (pos < 0) {
      return ''
    }
    const spos = pos + TagName.length
    const epos = line.indexOf(']', spos)
    return line.slice(spos, epos)
  }
  const Labels: ColorMap = { R: [], G: [], B: [], A: [], I: [], labels: [] }
  while (tag.endPos < len && tag.name.length > 1) {
    tag = readXMLtag()
    if (tag.name.startsWith('Label Key')) {
      line = tag.name
      Labels.I.push(readNumericTag('Key='))
      Labels.R.push(Math.round(255 * readNumericTag('Red=', true)))
      Labels.G.push(Math.round(255 * readNumericTag('Green=', true)))
      Labels.B.push(Math.round(255 * readNumericTag('Blue=', true)))
      Labels.A.push(Math.round(255 * readNumericTag('Alpha', true)))
      line = new TextDecoder().decode(buffer.slice(tag.contentStartPos + 1, tag.contentEndPos)).trim()
      Labels.labels!.push(readBracketTag('<![CDATA['))
    }
    if (tag.name.trim() === 'Data') {
      if (isVectors) {
        continue
      }
      line = new TextDecoder().decode(buffer.slice(tag.contentStartPos + 1, tag.contentEndPos)).trim()
      // Data can be on one to three lines...
      let datBin: Int32Array | Float32Array | Uint8Array = new Int32Array()
      if (isASCII) {
        const nvert = Dims[0] * Dims[1] * Dims[2]
        const lines = line.split(/\s+/) // .split(/[ ,]+/);
        if (nvert !== lines.length) {
          throw new Error('Unable to parse ASCII GIfTI')
        }
        if (dataType === 2) {
          dataType = 8
        } // UInt8 -> Int32
        if (dataType === 32) {
          dataType = 16
        } // float64 -> float32
        if (dataType === 8) {
          datBin = new Int32Array(nvert)
          for (let v = 0; v < nvert; v++) {
            datBin[v] = parseInt(lines[v])
          }
        }
        if (dataType === 16) {
          datBin = new Float32Array(nvert)
          for (let v = 0; v < nvert; v++) {
            datBin[v] = parseFloat(lines[v])
          }
        }
      } else if (typeof Buffer === 'undefined') {
        // raw.gii
        function base64ToUint8(base64: string): Uint8Array {
          const binary_string = atob(base64)
          const len = binary_string.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i)
          }
          return bytes
        }
        if (isGzip) {
          const datZ = base64ToUint8(line.slice())
          datBin = decompressSync(new Uint8Array(datZ))
        } else {
          datBin = base64ToUint8(line.slice())
        }
      } else {
        // if Buffer not defined
        if (isGzip) {
          const datZ = Buffer.from(line.slice(), 'base64')
          datBin = decompressSync(new Uint8Array(datZ))
        } else {
          datBin = Buffer.from(line.slice(), 'base64')
        }
      }
      if (isPts) {
        if (dataType !== 16) {
          console.log('expect positions as FLOAT32')
        }
        positions = new Float32Array(datBin.buffer)
        if (isColMajor) {
          const tmp = positions.slice()
          const np = tmp.length / 3
          let j = 0
          for (let p = 0; p < np; p++) {
            for (let i = 0; i < 3; i++) {
              positions[j] = tmp[i * np + p]
              j++
            }
          }
        } // isColMajor
      } else if (isIdx) {
        if (dataType !== 8) {
          console.log('expect indices as INT32')
        }
        indices = new Int32Array(datBin.buffer)
        if (isColMajor) {
          const tmp = indices.slice()
          const np = tmp.length / 3
          let j = 0
          for (let p = 0; p < np; p++) {
            for (let i = 0; i < 3; i++) {
              indices[j] = tmp[i * np + p]
              j++
            }
          }
        } // isColMajor
      } else {
        // not position or indices: assume scalars NIFTI_INTENT_NONE
        nvert = Dims[0] * Dims[1] * Dims[2]
        if (n_vert !== 0) {
          if (nvert % n_vert !== 0) {
            console.log('Number of vertices in scalar overlay (' + nvert + ') does not match mesh (' + n_vert + ')')
          }
        }
        function Float32Concat(first: Float32Array, second: Float32Array): Float32Array {
          const firstLength = first.length
          const result = new Float32Array(firstLength + second.length)
          result.set(first)
          result.set(second, firstLength)
          return result
        }
        let scalarsNew: Float32Array
        if (dataType === 2) {
          const scalarsInt = new Uint8Array(datBin.buffer)
          scalarsNew = Float32Array.from(scalarsInt)
        } else if (dataType === 8) {
          const scalarsInt = new Int32Array(datBin.buffer)
          scalarsNew = Float32Array.from(scalarsInt)
        } else if (dataType === 16) {
          scalarsNew = new Float32Array(datBin.buffer)
        } else if (dataType === 32) {
          const scalarFloat = new Float64Array(datBin.buffer)
          scalarsNew = Float32Array.from(scalarFloat)
        } else {
          throw new Error(`Invalid dataType: ${dataType}`)
        }
        scalars = Float32Concat(scalars, scalarsNew)
      }
      continue
    }
    if (tag.name.trim() === 'DataSpace') {
      line = new TextDecoder().decode(buffer.slice(tag.contentStartPos + 1, tag.contentEndPos)).trim()
      if (line.includes('NIFTI_XFORM_SCANNER_ANAT')) {
        isDataSpaceScanner = true
      }
    }
    if (tag.name.trim() === 'MD') {
      line = new TextDecoder().decode(buffer.slice(tag.contentStartPos + 1, tag.contentEndPos)).trim()
      if (line.includes('AnatomicalStructurePrimary') && line.includes('CDATA[')) {
        // this.AnatomicalStructurePrimary = readBracketTag('<Value><![CDATA[').toUpperCase()
      }
      if (line.includes('VolGeom') && line.includes('CDATA[')) {
        let e = -1
        if (line.includes('VolGeomC_R')) {
          e = 0
        }
        if (line.includes('VolGeomC_A')) {
          e = 1
        }
        if (line.includes('VolGeomC_S')) {
          e = 2
        }
        if (e < 0) {
          continue
        }
        FreeSurferTranlate[e] = parseFloat(readBracketTag('<Value><![CDATA['))
      }
    }
    // read DataArray properties
    if (!tag.name.startsWith('DataArray')) {
      continue
    }
    line = tag.name
    Dims = [1, 1, 1]
    isGzip = line.includes('Encoding="GZipBase64Binary"')
    isASCII = line.includes('Encoding="ASCII"')
    isIdx = line.includes('Intent="NIFTI_INTENT_TRIANGLE"')
    isPts = line.includes('Intent="NIFTI_INTENT_POINTSET"')
    isVectors = line.includes('Intent="NIFTI_INTENT_VECTOR"')
    isColMajor = line.includes('ArrayIndexingOrder="ColumnMajorOrder"')
    // isLittleEndian = line.includes('Endian="LittleEndian"');
    if (line.includes('DataType="NIFTI_TYPE_UINT8"')) {
      dataType = 2
    } // DT_UINT8
    if (line.includes('DataType="NIFTI_TYPE_INT32"')) {
      dataType = 8
    } // DT_INT32
    if (line.includes('DataType="NIFTI_TYPE_FLOAT32"')) {
      dataType = 16
    } // DT_FLOAT32
    if (line.includes('DataType="NIFTI_TYPE_FLOAT64"')) {
      dataType = 32
    } // DT_FLOAT64
    Dims[0] = readNumericTag('Dim0=')
    Dims[1] = readNumericTag('Dim1=')
    Dims[2] = readNumericTag('Dim2=')
  }
  // console.log(`p=${positions.length} i=${indices.length} s=${scalars.length}`);
  let colormapLabel: LUT | undefined
  if (Labels.I.length > 1) {
    colormapLabel = cmapper.makeLabelLut(Labels)
  }
  if (n_vert > 0) {
    return { scalars, colormapLabel }
  }
  if (
    positions.length > 2 &&
    !isDataSpaceScanner &&
    (FreeSurferTranlate[0] !== 0 || FreeSurferTranlate[1] !== 0 || FreeSurferTranlate[2] !== 0)
  ) {
    nvert = Math.floor(positions.length / 3)
    let i = 0
    for (let v = 0; v < nvert; v++) {
      positions[i] += FreeSurferTranlate[0]
      i++
      positions[i] += FreeSurferTranlate[1]
      i++
      positions[i] += FreeSurferTranlate[2]
      i++
    }
  } // issue416: apply FreeSurfer translation
  return {
    positions,
    indices,
    scalars,
    colormapLabel
  } // MatrixData
}
