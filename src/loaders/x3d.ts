import { ReadonlyVec4, mat4, vec4 } from 'gl-matrix'
import { NiivueObject3D } from '../niivue-object3D.js'
import { ReadResult } from '../types.js'

export type X3D = ReadResult & {
  rgba255: number[]
}

export const readX3D = (buffer: ArrayBuffer): X3D => {
  // n.b. only plain text ".x3d", not binary ".x3db"
  // beware: The values of XML attributes are delimited by either single or double quotes
  const len = buffer.byteLength
  if (len < 20) {
    throw new Error('File too small to be GII: bytes = ' + len)
  }
  const bytes = new Uint8Array(buffer)
  let pos = 0
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
  let line = readStr() // 1st line: signature 'mrtrix tracks'
  function readStringTag(TagName: string): string {
    // Tag 'DEF' will return l3 for DEF='l3'
    const fpos = line.indexOf(TagName + '=')
    if (fpos < 0) {
      return ''
    }
    const delimiter = line[fpos + TagName.length + 1]
    const spos = line.indexOf(delimiter, fpos) + 1
    const epos = line.indexOf(delimiter, spos)
    return line.slice(spos, epos)
  }
  function readNumericTag(TagName: string): number | number[] {
    // Tag 'Dim1' will return 3 for Dim1="3"
    const fpos = line.indexOf(TagName + '=')
    if (fpos < 0) {
      return 1
    }
    const delimiter = line[fpos + TagName.length + 1]
    const spos = line.indexOf(delimiter, fpos) + 1
    const epos = line.indexOf(delimiter, spos)
    const str = line.slice(spos, epos).trim()
    const items = str.trim().split(/\s+/)
    if (items.length < 2) {
      return parseFloat(str)
    }
    const ret = []
    for (let i = 0; i < items.length; i++) {
      ret.push(parseFloat(items[i]))
    }
    return ret
  }
  if (!line.includes('xml version')) {
    console.log('Not a X3D image')
  }
  let positions: number[] = []
  const indices: number[] = []
  let rgba255: number[] = []
  let color: number[] = []
  let translation: ReadonlyVec4 = Float32Array.from([0, 0, 0])
  let rotation = [0, 0, 0, 0]
  let rgba = [255, 255, 255, 255]
  let rgbaGlobal = [255, 255, 255, 255]
  const appearanceStyles: Record<string, number[]> = {}
  function readAppearance(): void {
    if (!line.endsWith('/>')) {
      if (line.startsWith('<Appearance>')) {
        // eslint-disable-next-line no-unmodified-loop-condition -- modified within readStr
        while (pos < len && !line.endsWith('</Appearance>')) {
          line += readStr()
        }
      } else {
        // eslint-disable-next-line no-unmodified-loop-condition -- modified within readStr
        while (pos < len && !line.endsWith('/>')) {
          line += readStr()
        }
      }
    }
    const ref = readStringTag('USE')
    if (ref.length > 1) {
      if (ref in appearanceStyles) {
        rgba = appearanceStyles[ref]
      } else {
        console.log('Unable to find DEF for ' + ref)
      }
      return
    }
    const diffuseColor = readNumericTag('diffuseColor') as number[]
    if (diffuseColor.length < 3) {
      return
    }
    rgba[0] = Math.round(diffuseColor[0] * 255)
    rgba[1] = Math.round(diffuseColor[1] * 255)
    rgba[2] = Math.round(diffuseColor[2] * 255)
    const def = readStringTag('DEF')
    if (def.length < 1) {
      return
    }
    appearanceStyles[def] = rgba
  }
  // eslint-disable-next-line no-unmodified-loop-condition -- modified within readStr
  while (pos < len) {
    line = readStr()
    rgba = rgbaGlobal.slice()
    if (line.startsWith('<Transform')) {
      translation = Float32Array.from(readNumericTag('translation') as number[])
      rotation = readNumericTag('rotation') as number[]
    }
    if (line.startsWith('<Appearance')) {
      readAppearance()
      rgbaGlobal = rgba.slice()
    }
    if (line.startsWith('<Shape')) {
      let radius = 1.0
      let height = 1.0
      let coordIndex: number[] = []
      let point: number[] = []

      // eslint-disable-next-line no-unmodified-loop-condition -- modified within readAppearance
      while (pos < len) {
        line = readStr()
        if (line.startsWith('<Appearance')) {
          readAppearance()
        }
        if (line.startsWith('</Shape')) {
          break
        }
        if (line.startsWith('<Sphere')) {
          radius = readNumericTag('radius') as number
          height = -1.0
        }
        if (line.startsWith('<Cylinder')) {
          radius = readNumericTag('radius') as number
          height = readNumericTag('height') as number
        }
        if (line.startsWith('<IndexedFaceSet')) {
          height = -2
          // https://www.web3d.org/specifications/X3Dv4Draft/ISO-IEC19775-1v4-CD/Part01/components/geometry3D.html#IndexedFaceSet
          coordIndex = readNumericTag('coordIndex') as number[]
        }
        if (line.startsWith('<IndexedTriangleStripSet')) {
          height = -3
          // https://www.web3d.org/specifications/X3Dv4Draft/ISO-IEC19775-1v4-CD/Part01/components/geometry3D.html#IndexedFaceSet
          coordIndex = readNumericTag('index') as number[]
        }
        if (line.startsWith('<Coordinate')) {
          point = readNumericTag('point') as number[]
        } // Coordinate point
        if (line.startsWith('<Color')) {
          color = readNumericTag('color') as number[]
        } // Coordinate point
        if (line.startsWith('<Box')) {
          height = -4
          console.log('Unsupported x3d shape: Box')
        }
        if (line.startsWith('<Cone')) {
          height = -5
          console.log('Unsupported x3d shape: Cone')
        }
        if (line.startsWith('<ElevationGrid')) {
          height = -6
          console.log('Unsupported x3d shape: ElevationGrid')
        }
      } // while not </shape
      if (height < -3.0) {
        // cone, box, elevation grid
        // unsupported
      } else if (height < -1.0) {
        // indexed triangle mesh or strip
        if (coordIndex.length < 1 || point.length < 3 || point.length === undefined) {
          console.log('Indexed mesh must specify indices and points')
          break
        }
        const idx0 = Math.floor(positions.length / 3) // first new vertex will be AFTER previous vertices
        let j = 2
        if (height === -2) {
          // if triangles
          // see Castle engine should_be_manifold.x3d.stl test image
          let triStart = 0
          while (j < coordIndex.length) {
            if (coordIndex[j] >= 0) {
              // new triangle
              indices.push(coordIndex[triStart] + idx0)
              indices.push(coordIndex[j - 1] + idx0)
              indices.push(coordIndex[j - 0] + idx0)
              j += 1
            } else {
              // coordIndex[j] === -1, next polygon
              j += 3
              triStart = j - 2
            }
          }
        } else {
          // if triangles else triangle strips
          while (j < coordIndex.length) {
            if (coordIndex[j] >= 0) {
              // new triangle
              indices.push(coordIndex[j - 2] + idx0)
              indices.push(coordIndex[j - 1] + idx0)
              indices.push(coordIndex[j - 0] + idx0)
              j += 1
            } else {
              // coordIndex[j] === -1, next polygon
              j += 3
            }
          }
        }
        // n.b. positions.push(...point) can generate "Maximum call stack size exceeded"
        positions = [...positions, ...point]
        const npt = Math.floor(point.length / 3)
        const rgbas = Array(npt).fill(rgba).flat()
        if (color.length === npt * 3) {
          // colors are rgb 0..1, rgbas are RGBA 0..255
          let c3 = 0
          let c4 = 0
          for (let i = 0; i < npt; i++) {
            for (let j = 0; j < 3; j++) {
              rgbas[c4] = Math.round(color[c3] * 255.0)
              c3++
              c4++
            }
            c4++
          }
        }
        rgba255 = [...rgba255, ...rgbas]
      } else if (height < 0.0) {
        // sphere
        NiivueObject3D.makeColoredSphere(positions, indices, rgba255, radius, Array.from(translation), rgba)
      } else {
        // https://www.andre-gaschler.com/rotationconverter/
        const r = mat4.create() // rotation mat4x4
        mat4.fromRotation(r, rotation[3], [rotation[0], rotation[1], rotation[2]])
        const pti = vec4.fromValues(0, -height * 0.5, 0, 1)
        const ptj = vec4.fromValues(0, +height * 0.5, 0, 1)
        vec4.transformMat4(pti, pti, r)
        vec4.transformMat4(ptj, ptj, r)
        vec4.add(pti, pti, translation)
        vec4.add(ptj, ptj, translation)
        // https://www.web3d.org/specifications/X3Dv4Draft/ISO-IEC19775-1v4-CD/Part01/components/geometry3D.html#Cylinder
        // @ts-expect-error -- should pti and ptj should be vec3
        NiivueObject3D.makeColoredCylinder(positions, indices, rgba255, pti, ptj, radius, rgba)
      }
    } // while <shape
  }
  return {
    positions: Float32Array.from(positions),
    indices: Int32Array.from(indices),
    rgba255
  }
}
