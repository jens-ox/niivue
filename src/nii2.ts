export const readNII2 = (buffer: ArrayBuffer, n_vert = 0): number[] => {
  let scalars: number[] | Float32Array | Int32Array | Int16Array | Uint8Array = []

  const len = buffer.byteLength
  let isLittleEndian = true
  const reader = new DataView(buffer)
  let magic = reader.getUint16(0, isLittleEndian)
  if (magic === 469893120) {
    isLittleEndian = false
    magic = reader.getUint16(0, isLittleEndian)
  }
  if (magic !== 540) {
    throw new Error('Not a valid NIfTI-2 dataset')
  }
  const voxoffset = Number(reader.getBigInt64(168, isLittleEndian))
  const scl_slope = reader.getFloat64(176, isLittleEndian)
  const scl_inter = reader.getFloat64(184, isLittleEndian)
  if (scl_slope !== 1 || scl_inter !== 0) {
    console.log('ignoring scale slope and intercept')
  }
  const intent_code = reader.getUint32(504, isLittleEndian)
  const datatype = reader.getUint16(12, isLittleEndian)
  if (datatype !== 2 && datatype !== 4 && datatype !== 8 && datatype !== 16) {
    throw new Error(`Unsupported NIfTI datatype: ${datatype}`)
  }
  let nvert = 1
  const dim = [1, 1, 1, 1, 1, 1, 1, 1]
  for (let i = 1; i < 8; i++) {
    dim[i] = Math.max(Number(reader.getBigInt64(16 + i * 8, isLittleEndian)), 1)
    nvert *= dim[i]
  }
  if (intent_code >= 3000 && intent_code <= 3099 && voxoffset > 580) {
    // CIFTI ConnDenseScalar
    let indexOffset = 0
    let indexCount = 0
    let surfaceNumberOfVertices = 0
    let brainStructure = ''
    let vertexIndices = new Int32Array()
    const bytes = new Uint8Array(buffer)
    let pos = 552

    function readStrX(): string {
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
      return new TextDecoder().decode(buffer.slice(startPos, pos - 1)).trim()
    }

    function readStr(): string {
      // concatenate lines to return tag <...>
      let line = readStrX()
      if (!line.startsWith('<') || line.endsWith('>')) {
        return line
      }
      while (pos < len && !line.endsWith('>')) {
        line += readStrX()
      }
      return line
    }
    let line: string

    function readNumericTag(TagName: string, asString = false): number | string {
      // Tag 'Dim1' will return 3 for Dim1="3"
      const tpos = line.indexOf(TagName)
      if (tpos < 0) {
        return 1
      }
      const spos = line.indexOf('"', tpos) + 1
      const epos = line.indexOf('"', spos)
      const str = line.slice(spos, epos)
      if (asString) {
        return str
      }
      return parseInt(str)
    } // readNumericTag

    const nFrame4D = dim[5] // number of timepoints/frames per vertex
    const scalars = new Float32Array(n_vert * nFrame4D)

    // eslint-disable-next-line no-unmodified-loop-condition -- pos is modified within readStr
    while (pos < len) {
      line = readStr()
      if (line.includes('</CIFTI>')) {
        break
      }
      if (line.includes('<BrainModel')) {
        const nv = readNumericTag('SurfaceNumberOfVertices=') as number
        const bStruct = (readNumericTag('BrainStructure=', true) as string).toUpperCase()
        if (nv % n_vert !== 0) {
          continue
        }
        // a single CIfTI file can contain multiple structures, but only one structure per mesh
        // The big kludge: try to find CIfTI structure that matches GIfTI mesh
        let isMatch = false
        if (''.includes('CORTEX') && bStruct.includes('CORTEX')) {
          isMatch = true
        }
        // to do: other anatomy: cerebellum
        if (!isMatch) {
          continue
        }
        isMatch = false
        if (''.includes('LEFT') && bStruct.includes('LEFT')) {
          isMatch = true
        }
        if (''.includes('RIGHT') && bStruct.includes('RIGHT')) {
          isMatch = true
        }
        if (!isMatch) {
          continue
        }
        surfaceNumberOfVertices = nv
        indexOffset = readNumericTag('IndexOffset=') as number
        indexCount = readNumericTag('IndexCount=') as number
        brainStructure = bStruct
        if (!line.includes('<VertexIndices>')) {
          line = readStr()
        }
        if (!line.startsWith('<VertexIndices>') || !line.endsWith('</VertexIndices>')) {
          throw new Error('Unable to find CIfTI <VertexIndices>')
        }
        line = line.slice(15, -16)
        const items = line.trim().split(/\s+/)
        if (items.length < indexCount) {
          throw new Error('Error parsing VertexIndices')
        }
        vertexIndices = new Int32Array(indexCount)
        for (let i = 0; i < indexCount; i++) {
          vertexIndices[i] = parseInt(items[i])
        }
      } // read <BrainModel
    } // while (pos < len) or reached </CIFTI>

    if (surfaceNumberOfVertices === 0 || vertexIndices.length === 0) {
      throw new Error('Unable to find CIfTI structure that matches the mesh.')
    }
    if (datatype !== 16) {
      throw new Error('Only able to read float32 CIfTI (only known datatype).')
    }

    const vals = new Float32Array(indexCount * nFrame4D)
    const off = voxoffset + nFrame4D * indexOffset * 4
    for (let i = 0; i < indexCount * nFrame4D; i++) {
      vals[i] = reader.getFloat32(off + i * 4, isLittleEndian)
    }
    // }
    let j = 0

    for (let i = 0; i < indexCount; i++) {
      for (let f = 0; f < nFrame4D; f++) {
        scalars[vertexIndices[i] + f * n_vert] = vals[j]
        j++
      }
    }
    console.log('CIfTI diagnostics', surfaceNumberOfVertices, brainStructure, indexOffset, indexCount, indexOffset)
    //
    return Array.from(scalars)
  } // is CIfTI
  if (nvert % n_vert !== 0) {
    throw new Error('Vertices in NIfTI (' + nvert + ') is not a multiple of number of vertices (' + n_vert + ')')
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
