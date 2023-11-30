import { ReadResult } from '../types.js'

export const readPLY = (buffer: ArrayBuffer): ReadResult => {
  const len = buffer.byteLength
  const bytes = new Uint8Array(buffer)
  let pos = 0
  function readStr(): string {
    while (pos < len && bytes[pos] === 10) {
      pos++
    } // skip blank lines
    const startPos = pos
    while (pos < len && bytes[pos] !== 10) {
      pos++
    }
    pos++ // skip EOLN
    if (pos - startPos < 1) {
      return ''
    }
    return new TextDecoder().decode(buffer.slice(startPos, pos - 1))
  }
  let line = readStr() // 1st line: magic 'ply'
  if (!line.startsWith('ply')) {
    throw new Error('Not a valid PLY file')
  }
  line = readStr() // 2nd line: format 'format binary_little_endian 1.0'
  const isAscii = line.includes('ascii')
  function dataTypeBytes(str: string): 1 | 2 | 4 | 8 {
    if (str === 'char' || str === 'uchar' || str === 'int8' || str === 'uint8') {
      return 1
    }
    if (str === 'short' || str === 'ushort' || str === 'int16' || str === 'uint16') {
      return 2
    }
    if (
      str === 'int' ||
      str === 'uint' ||
      str === 'int32' ||
      str === 'uint32' ||
      str === 'float' ||
      str === 'float32'
    ) {
      return 4
    }
    if (str === 'double') {
      return 8
    }
    throw new Error('Unknown data type: ' + str)
  }
  const isLittleEndian = line.includes('binary_little_endian')
  let nvert = 0
  let vertIsDouble = false
  let vertStride = 0 // e.g. if each vertex stores xyz as float32 and rgb as uint8, stride is 15
  let indexStrideBytes = 0 // "list uchar int vertex_indices" has stride 1 + 3 * 4
  let indexCountBytes = 0 // if "property list uchar int vertex_index" this is 1 (uchar)
  let indexBytes = 0 // if "property list uchar int vertex_index" this is 4 (int)
  let indexPaddingBytes = 0
  let nIndexPadding = 0
  let nface = 0
  while (pos < len && !line.startsWith('end_header')) {
    line = readStr()
    if (line.startsWith('comment')) {
      continue
    }
    // line = line.replaceAll('\t', ' '); // ?are tabs valid white space?
    let items = line.split(/\s/)
    if (line.startsWith('element vertex')) {
      nvert = parseInt(items[items.length - 1])
      // read vertex properties:
      line = readStr()
      items = line.split(/\s/)
      while (line.startsWith('property')) {
        const datatype = items[1]
        if (items[2] === 'x' && datatype.startsWith('double')) {
          vertIsDouble = true
        } else if (items[2] === 'x' && !datatype.startsWith('float')) {
          console.log('Error: expect ply xyz to be float or double: ' + line)
        }
        vertStride += dataTypeBytes(datatype)
        line = readStr()
        items = line.split(/\s/)
      }
    }
    if (line.startsWith('element face')) {
      nface = parseInt(items[items.length - 1])
      // read face properties:
      line = readStr()
      items = line.split(/\s/)
      while (line.startsWith('property')) {
        // console.log("property", line);
        if (items[1] === 'list') {
          indexCountBytes = dataTypeBytes(items[2])
          indexBytes = dataTypeBytes(items[3])
          indexStrideBytes += indexCountBytes + 3 * indexBytes // e.g. "uchar int" is 1 + 3 * 4 bytes
        } else {
          const bytes = dataTypeBytes(items[1])
          indexStrideBytes += bytes
          if (indexBytes === 0) {
            // this index property is BEFORE the list
            indexPaddingBytes += bytes
            nIndexPadding++
          }
        }
        line = readStr()
        items = line.split(/\s/)
      }
    }
  } // while reading all lines of header
  if (isAscii) {
    if (nface < 1) {
      console.log(`Malformed ply format: faces ${nface} `)
    }
    const positions = new Float32Array(nvert * 3)
    let v = 0
    for (let i = 0; i < nvert; i++) {
      line = readStr()
      const items = line.split(/\s/)
      positions[v] = parseFloat(items[0])
      positions[v + 1] = parseFloat(items[1])
      positions[v + 2] = parseFloat(items[2])
      v += 3
    }
    let indices = new Int32Array(nface * 3)
    let f = 0
    for (let i = 0; i < nface; i++) {
      line = readStr()
      const items = line.split(/\s/)
      const nTri = parseInt(items[nIndexPadding]) - 2
      if (nTri < 1) {
        break
      } // error
      if (f + nTri * 3 > indices.length) {
        const c = new Int32Array(indices.length + indices.length)
        c.set(indices)
        indices = c.slice()
      }
      const idx0 = parseInt(items[nIndexPadding + 1])
      let idx1 = parseInt(items[nIndexPadding + 2])
      for (let j = 0; j < nTri; j++) {
        const idx2 = parseInt(items[nIndexPadding + 3 + j])
        indices[f + 0] = idx0
        indices[f + 1] = idx1
        indices[f + 2] = idx2
        idx1 = idx2
        f += 3
      }
    }
    if (indices.length !== f) {
      indices = indices.slice(0, f)
    }
    return {
      positions,
      indices
    }
  } // if isAscii
  if (vertStride < 12 || indexCountBytes < 1 || indexBytes < 1 || nface < 1) {
    console.log(
      `Malformed ply format: stride ${vertStride} count ${indexCountBytes} iBytes ${indexBytes} iStrideBytes ${indexStrideBytes} iPadBytes ${indexPaddingBytes} faces ${nface}`
    )
  }
  const reader = new DataView(buffer)
  let positions: Float32Array
  if (pos % 4 === 0 && vertStride === 12 && isLittleEndian) {
    // optimization: vertices only store xyz position as float
    // n.b. start offset of Float32Array must be a multiple of 4
    positions = new Float32Array(buffer, pos, nvert * 3)
    pos += nvert * vertStride
  } else {
    positions = new Float32Array(nvert * 3)
    let v = 0
    for (let i = 0; i < nvert; i++) {
      if (vertIsDouble) {
        positions[v] = reader.getFloat64(pos, isLittleEndian)
        positions[v + 1] = reader.getFloat64(pos + 8, isLittleEndian)
        positions[v + 2] = reader.getFloat64(pos + 16, isLittleEndian)
      } else {
        positions[v] = reader.getFloat32(pos, isLittleEndian)
        positions[v + 1] = reader.getFloat32(pos + 4, isLittleEndian)
        positions[v + 2] = reader.getFloat32(pos + 8, isLittleEndian)
      }
      v += 3
      pos += vertStride
    }
  }
  const indices = new Int32Array(nface * 3) // assume triangular mesh: pre-allocation optimization
  let isTriangular = true
  let j = 0
  if (indexCountBytes === 1 && indexBytes === 4 && indexStrideBytes === 13) {
    // default mode: "list uchar int vertex_indices" without other properties
    for (let i = 0; i < nface; i++) {
      const nIdx = reader.getUint8(pos)
      pos += indexCountBytes
      if (nIdx !== 3) {
        isTriangular = false
      }
      indices[j] = reader.getUint32(pos, isLittleEndian)
      pos += 4
      indices[j + 1] = reader.getUint32(pos, isLittleEndian)
      pos += 4
      indices[j + 2] = reader.getUint32(pos, isLittleEndian)
      pos += 4
      j += 3
    }
  } else {
    // not 1:4 index data
    let startPos = pos
    for (let i = 0; i < nface; i++) {
      pos = startPos + indexPaddingBytes
      let nIdx = 0
      if (indexCountBytes === 1) {
        nIdx = reader.getUint8(pos)
      } else if (indexCountBytes === 2) {
        nIdx = reader.getUint16(pos, isLittleEndian)
      } else if (indexCountBytes === 4) {
        nIdx = reader.getUint32(pos, isLittleEndian)
      }
      pos += indexCountBytes
      if (nIdx !== 3) {
        isTriangular = false
      }
      for (let k = 0; k < 3; k++) {
        if (indexBytes === 1) {
          indices[j] = reader.getUint8(pos)
        } else if (indexBytes === 2) {
          indices[j] = reader.getUint16(pos, isLittleEndian)
        } else if (indexBytes === 4) {
          indices[j] = reader.getUint32(pos, isLittleEndian)
        }
        j++
        pos += indexBytes
      }
      startPos += indexStrideBytes
    } // for each face
  } // if not 1:4 datatype
  if (!isTriangular) {
    console.log('Only able to read PLY meshes limited to triangles.')
  }
  return {
    positions,
    indices
  }
}
