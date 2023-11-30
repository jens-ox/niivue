import { NVMeshLayer, ReadResult } from '../types.js'
import { readNII2 } from '../nii2.js'
import { NVMesh } from '../nvmesh.js'
import { TRACT } from './tract.js'
import { TRX, readTRX } from './trx.js'
import { TCK, readTCK } from './tck.js'
import { TRK, readTRK } from './trk.js'
import { TxtVtk, readTxtVTK } from './txt-vtk.js'
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
import { MZ3, readMZ3 } from './mz3.js'

/**
 * Class to load different mesh formats
 */
export class NVMeshLoaders {
  // read mesh overlay to influence vertex colors
  static readLayer(
    name: string,
    buffer: Buffer,
    nvmesh: NVMesh,
    opacity = 0.5,
    colormap = 'warm',
    colormapNegative = 'winter',
    useNegativeCmap = false,
    cal_min = null,
    cal_max = null,
    isOutlineBorder = false
  ): void {
    const layer: Partial<NVMeshLayer> = {
      colormapInvert: false,
      alphaThreshold: false,
      isTransparentBelowCalMin: true,
      isAdditiveBlend: false,
      colorbarVisible: true
    }

    const isReadColortables = true
    // TODO can we guarantee this?
    const n_vert = nvmesh.vertexCount! / 3 // each vertex has XYZ component
    if (n_vert < 3) {
      return
    }
    const re = /(?:\.([^.]+))?$/
    let ext = re.exec(name)![1]
    ext = ext.toUpperCase()
    if (ext === 'GZ') {
      ext = re.exec(name.slice(0, -3))![1] // img.trk.gz -> img.trk
      ext = ext.toUpperCase()
    }
    if (ext === 'MZ3') {
      layer.values = readMZ3(buffer, n_vert) as Float32Array
    } else if (ext === 'ANNOT') {
      if (!isReadColortables) {
        layer.values = NVMeshLoaders.readANNOT(buffer, n_vert) as Uint32Array
      } else {
        const obj = NVMeshLoaders.readANNOT(buffer, n_vert, true)
        if ('scalars' in obj) {
          layer.values = obj.scalars
          layer.colormapLabel = obj.colormapLabel
        } // unable to decode colormapLabel
        else {
          layer.values = obj
        }
      }
    } else if (ext === 'CRV' || ext === 'CURV') {
      layer.values = NVMeshLoaders.readCURV(buffer, n_vert)
      layer.isTransparentBelowCalMin = false
    } else if (ext === 'GII') {
      const obj = NVMeshLoaders.readGII(buffer, n_vert)
      layer.values = obj.scalars // colormapLabel
      layer.colormapLabel = obj.colormapLabel
    } else if (ext === 'MGH' || ext === 'MGZ') {
      if (!isReadColortables) {
        layer.values = NVMeshLoaders.readMGH(buffer, n_vert) as number[]
      } else {
        const obj = NVMeshLoaders.readMGH(buffer, n_vert, true)
        if ('scalars' in obj) {
          layer.values = obj.scalars
          layer.colormapLabel = obj.colormapLabel
        } // unable to decode colormapLabel
        else {
          layer.values = obj
        }
      }
    } else if (ext === 'NII') {
      layer.values = NVMeshLoaders.readNII(buffer, n_vert)
    } else if (ext === 'SMP') {
      layer.values = NVMeshLoaders.readSMP(buffer, n_vert)
    } else if (ext === 'STC') {
      layer.values = NVMeshLoaders.readSTC(buffer, n_vert)
    } else {
      console.log('Unknown layer overlay format ' + name)
      return
    }
    if (!layer.values) {
      return
    }
    layer.nFrame4D = layer.values.length / n_vert
    layer.frame4D = 0
    layer.isOutlineBorder = isOutlineBorder
    // determine global min..max
    let mn = layer.values[0]
    let mx = layer.values[0]
    for (let i = 0; i < layer.values.length; i++) {
      mn = Math.min(mn, layer.values[i])
      mx = Math.max(mx, layer.values[i])
    }
    // console.log('layer range: ', mn, mx);
    layer.global_min = mn
    layer.global_max = mx
    layer.cal_min = cal_min
    if (!cal_min) {
      layer.cal_min = mn
    }
    layer.cal_max = cal_max
    if (!cal_max) {
      layer.cal_max = mx
    }
    layer.cal_minNeg = NaN
    layer.cal_maxNeg = NaN
    layer.opacity = opacity
    layer.colormap = colormap
    layer.colormapNegative = colormapNegative
    layer.useNegativeCmap = useNegativeCmap
    nvmesh.layers.push(layer as NVMeshLayer)
  }

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
  static readMZ3(buffer: ArrayBuffer, n_vert = 0): MZ3 {
    return readMZ3(buffer, n_vert)
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
