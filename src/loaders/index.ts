import { decompressSync } from 'fflate/browser'
import { NVMesh } from '../nvmesh.js'
import { ReadResult } from '../types.js'
import { readNII2 } from '../nii2.js'
import { TRACT } from './tract.js'
import { TRX, readTRX } from './trx.js'
import { TCK, readTCK } from './tck.js'
import { TRK, readTRK } from './trk.js'
import { TxtVtk, readTxtVTK } from './txt-vtk.js'
import { readLayer } from './layer.js'
import { readSMP } from './smp.js'
import { readSTC } from './stc.js'
import { readCURV } from './curv.js'
import { ANNOT, readANNOT } from './annot.js'
import { readNV } from './nv.js'
import { readASC } from './asc.js'
import { VTK, readVTK } from './vtk.js'
import { readDFS } from './dfs.js'
import { readPLY } from './ply.js'
import { readICO } from './ico.js'
import { readGEO } from './geo.js'
import { readOFF } from './off.js'
import { readOBJ } from './obj.js'
import { readFreeSurfer } from './freesurfer.js'
import { readSRF } from './srf.js'
import { readTxtSTL } from './txt-stl.js'
import { readSTL } from './stl.js'
import { readNII } from './nii.js'
import { MGH, readMGH } from './mgh.js'
import { X3D, readX3D } from './x3d.js'
import { GII, readGII } from './gii.js'

/**
 * Class to load different mesh formats
 */
export class NVMeshLoaders {
  // read undocumented AFNI tract.niml format streamlines
  static readTRACT(buffer: ArrayBuffer): TRACT {
    return this.readTRACT(buffer)
  }

  // read TRX format tractogram
  // https://github.com/tee-ar-ex/trx-spec/blob/master/specifications.md
  static readTRX(buffer: ArrayBuffer): TRX {
    return readTRX(buffer)
  }

  // read mrtrix tck format streamlines
  // https://mrtrix.readthedocs.io/en/latest/getting_started/image_data.html#tracks-file-format-tck
  static readTCK(buffer: ArrayBuffer): TCK {
    return readTCK(buffer)
  }

  // not included in public docs
  // read trackvis trk format streamlines
  // http://trackvis.org/docs/?subsect=fileformat
  static readTRK(buffer: ArrayBuffer): TRK {
    return readTRK(buffer)
  }

  // read legacy VTK text format file
  static readTxtVTK(buffer: ArrayBuffer): TxtVtk {
    return readTxtVTK(buffer)
  }

  // read mesh overlay to influence vertex colors
  static readLayer(
    name: string,
    buffer: ArrayBuffer,
    nvmesh: NVMesh,
    opacity = 0.5,
    colormap = 'warm',
    colormapNegative = 'winter',
    useNegativeCmap = false,
    cal_min = null,
    cal_max = null,
    isOutlineBorder = false
  ): void {
    readLayer(
      name,
      buffer,
      nvmesh,
      opacity,
      colormap,
      colormapNegative,
      useNegativeCmap,
      cal_min,
      cal_max,
      isOutlineBorder
    )
  }

  // read brainvoyager smp format file
  // https://support.brainvoyager.com/brainvoyager/automation-development/84-file-formats/40-the-format-of-smp-files
  static readSMP(buffer: ArrayBuffer, n_vert: number): Float32Array {
    return readSMP(buffer, n_vert)
  }

  // read mne stc format file, not to be confused with brainvoyager stc format
  // https://github.com/mne-tools/mne-python/blob/main/mne/source_estimate.py#L211-L365
  static readSTC(buffer: ArrayBuffer, n_vert: number): Float32Array {
    return readSTC(buffer, n_vert)
  }

  // read freesurfer curv big-endian format
  // https://github.com/bonilhamusclab/MRIcroS/blob/master/%2BfileUtils/%2Bpial/readPial.m
  // http://www.grahamwideman.com/gw/brain/fs/surfacefileformats.htm
  static readCURV(buffer: ArrayBuffer, n_vert: number): Float32Array {
    return readCURV(buffer, n_vert)
  }

  // read freesurfer Annotation file provides vertex colors
  // https://surfer.nmr.mgh.harvard.edu/fswiki/LabelsClutsAnnotationFiles
  static readANNOT(buffer: ArrayBuffer, n_vert: number, isReadColortables = false): ANNOT {
    return readANNOT(buffer, n_vert, isReadColortables)
  }

  // read BrainNet viewer format
  // https://www.nitrc.org/projects/bnv/
  static readNV(buffer: ArrayBuffer): ReadResult {
    return readNV(buffer)
  }

  // read ASCII Patch File format
  // https://afni.nimh.nih.gov/pub/dist/doc/htmldoc/demos/Bootcamp/CD.html#cd
  // http://www.grahamwideman.com/gw/brain/fs/surfacefileformats.htm
  static readASC(buffer: ArrayBuffer): ReadResult {
    return readASC(buffer)
  }

  // read legacy VTK format
  static readVTK(buffer: ArrayBuffer): VTK {
    return readVTK(buffer)
  }

  // read brainsuite DFS format
  // http://brainsuite.org/formats/dfs/
  static readDFS(buffer: ArrayBuffer): ReadResult {
    return readDFS(buffer)
  }

  // read surfice MZ3 format
  // https://github.com/neurolabusc/surf-ice/tree/master/mz3
  static readMZ3(buffer: ArrayBuffer, n_vert = 0) {
    // ToDo: mz3 always little endian: support big endian? endian https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array
    if (buffer.byteLength < 20) {
      // 76 for raw, not sure of gzip
      throw new Error('File too small to be mz3: bytes = ' + buffer.byteLength)
    }
    let reader = new DataView(buffer)
    // get number of vertices and faces
    let magic = reader.getUint16(0, true)
    let _buffer = buffer
    if (magic === 35615 || magic === 8075) {
      // gzip signature 0x1F8B in little and big endian
      const raw = decompressSync(new Uint8Array(buffer))
      reader = new DataView(raw.buffer)
      magic = reader.getUint16(0, true)
      _buffer = raw.buffer
      // throw new Error( 'Gzip MZ3 file' );
    }
    const attr = reader.getUint16(2, true)
    const nface = reader.getUint32(4, true)
    let nvert = reader.getUint32(8, true)
    const nskip = reader.getUint32(12, true)
    console.log('MZ3 magic %d attr %d face %d vert %d skip %d', magic, attr, nface, nvert, nskip)
    if (magic !== 23117) {
      throw new Error('Invalid MZ3 file')
    }
    const isFace = (attr & 1) !== 0
    const isVert = (attr & 2) !== 0
    const isRGBA = (attr & 4) !== 0
    let isSCALAR = (attr & 8) !== 0
    const isDOUBLE = (attr & 16) !== 0
    // var isAOMap = attr & 32;
    if (attr > 63) {
      throw new Error('Unsupported future version of MZ3 file')
    }
    let bytesPerScalar = 4
    if (isDOUBLE) {
      bytesPerScalar = 8
    }
    let NSCALAR = 0
    if (n_vert > 0 && !isFace && nface < 1 && !isRGBA) {
      isSCALAR = true
    }
    if (isSCALAR) {
      const FSizeWoScalars = 16 + nskip + isFace * nface * 12 + isVert * n_vert * 12 + isRGBA * n_vert * 4
      const scalarFloats = Math.floor((_buffer.byteLength - FSizeWoScalars) / bytesPerScalar)
      if (nvert !== n_vert && scalarFloats % n_vert === 0) {
        console.log('Issue 729: mz3 mismatch scalar NVERT does not match mesh NVERT')
        nvert = n_vert
      }
      NSCALAR = Math.floor(scalarFloats / nvert)
      if (NSCALAR < 1) {
        console.log('Corrupt MZ3: file reports NSCALAR but not enough bytes')
        isSCALAR = false
      }
    }
    if (nvert < 3 && n_vert < 3) {
      throw new Error('Not a mesh MZ3 file (maybe scalar)')
    }
    if (n_vert > 0 && n_vert !== nvert) {
      console.log('Layer has ' + nvert + 'vertices, but background mesh has ' + n_vert)
    }
    let filepos = 16 + nskip
    let indices = null
    if (isFace) {
      indices = new Int32Array(_buffer, filepos, nface * 3, true)
      filepos += nface * 3 * 4
    }
    let positions = null
    if (isVert) {
      positions = new Float32Array(_buffer, filepos, nvert * 3, true)
      filepos += nvert * 3 * 4
    }
    let colors = null
    if (isRGBA) {
      colors = new Float32Array(nvert * 3)
      const rgba8 = new Uint8Array(_buffer, filepos, nvert * 4, true)
      filepos += nvert * 4
      let k3 = 0
      let k4 = 0
      for (let i = 0; i < nvert; i++) {
        for (let j = 0; j < 3; j++) {
          // for RGBA
          colors[k3] = rgba8[k4] / 255
          k3++
          k4++
        }
        k4++ // skip Alpha
      } // for i
    } // if isRGBA
    let scalars = []
    if (!isRGBA && isSCALAR && NSCALAR > 0) {
      if (isDOUBLE) {
        const flt64 = new Float64Array(_buffer, filepos, NSCALAR * nvert)
        scalars = Float32Array.from(flt64)
      } else {
        scalars = new Float32Array(_buffer, filepos, NSCALAR * nvert)
      }
      filepos += bytesPerScalar * NSCALAR * nvert
    }
    if (n_vert > 0) {
      return scalars
    }
    return {
      positions,
      indices,
      scalars,
      colors
    }
  } // readMZ3()

  // read PLY format
  // https://en.wikipedia.org/wiki/PLY_(file_format)
  static readPLY(buffer: ArrayBuffer): ReadResult {
    return readPLY(buffer)
  } // readPLY()

  // FreeSurfer can convert meshes to ICO/TRI format text files
  // https://github.com/dfsp-spirit/freesurferformats/blob/434962608108c75d4337d5e7a5096e3bd4ee6ee6/R/read_fs_surface.R#L1090
  // detect TRI format that uses same extension
  // http://paulbourke.net/dataformats/tri/
  static readICO(buffer: ArrayBuffer): ReadResult {
    return readICO(buffer)
  }

  // While BYU and FreeSurfer GEO are related
  // - BYU can have multiple parts
  // - BYU faces not always triangular
  // http://www.grahamwideman.com/gw/brain/fs/surfacefileformats.htm#GeoFile
  // http://www.eg-models.de/formats/Format_Byu.html
  // https://github.com/dfsp-spirit/freesurferformats/blob/dafaf88a601dac90fa3c9aae4432f003f5344546/R/read_fs_surface.R#L924
  // https://github.com/dfsp-spirit/freesurferformats/blob/434962608108c75d4337d5e7a5096e3bd4ee6ee6/R/read_fs_surface.R#L1144
  // n.b. AFNI uses the '.g' extension for this format 'ConvertSurface  -i_gii L.surf.gii -o_byu L'
  static readGEO(buffer: ArrayBuffer, isFlipWinding = false): ReadResult {
    return readGEO(buffer, isFlipWinding)
  }

  // read OFF format
  // https://en.wikipedia.org/wiki/OFF_(file_format)
  static readOFF(buffer: ArrayBuffer): ReadResult {
    return readOFF(buffer)
  }

  static readOBJ(buffer: ArrayBuffer): ReadResult {
    return readOBJ(buffer)
  }

  // read FreeSurfer big endian format
  static readFreeSurfer(buffer: ArrayBuffer): ReadResult {
    return readFreeSurfer(buffer)
  }

  // read brainvoyager SRF format
  // https://support.brainvoyager.com/brainvoyager/automation-development/84-file-formats/344-users-guide-2-3-the-format-of-srf-files
  static readSRF(buffer: ArrayBuffer): ReadResult {
    return readSRF(buffer)
  }

  // read STL ASCII format file
  // http://paulbourke.net/dataformats/stl/
  static readTxtSTL(buffer: ArrayBuffer): ReadResult {
    return readTxtSTL(buffer)
  }

  // read STL format, nb this format does not reuse vertices
  // https://en.wikipedia.org/wiki/STL_(file_format)
  static readSTL(buffer: ArrayBuffer): ReadResult {
    return readSTL(buffer)
  }

  // read NIfTI2 format with embedded CIfTI
  // this variation very specific to connectome workbench
  // https://brainder.org/2015/04/03/the-nifti-2-file-format/
  static readNII2(buffer: ArrayBuffer, n_vert = 0): number[] {
    return readNII2(buffer, n_vert)
  }

  // read NIfTI1/2 as vertex colors
  // https://brainder.org/2012/09/23/the-nifti-file-format/#:~:text=In%20the%20nifti%20format%2C%20the,seventh%2C%20are%20for%20other%20uses.
  static readNII(buffer: ArrayBuffer, n_vert = 0): number[] {
    return readNII(buffer, n_vert)
  }

  // read MGH format as vertex colors (not voxel-based image)
  // https://surfer.nmr.mgh.harvard.edu/fswiki/FsTutorial/MghFormat
  static readMGH(buffer: ArrayBuffer, n_vert = 0, isReadColortables = false): MGH {
    return readMGH(buffer, n_vert, isReadColortables)
  }

  // read X3D format mesh
  // https://en.wikipedia.org/wiki/X3D
  static readX3D(buffer: ArrayBuffer): X3D {
    return readX3D(buffer)
  }

  // read GIfTI format mesh
  // https://www.nitrc.org/projects/gifti/
  static readGII(buffer: ArrayBuffer, n_vert = 0): GII {
    return readGII(buffer, n_vert)
  }
}
