import { ColorArray } from './types.js'

/** enum for text alignment */
export enum LabelTextAlignment {
  LEFT = 'left',
  RIGHT = 'right',
  CENTER = 'center'
}

/** enum for line terminators */
export enum LabelLineTerminator {
  NONE = 'none',
  CIRCLE = 'circle',
  RING = 'ring'
}

/**
 * Class representing label style
 * @param textColor Color of text
 * @param textScale Text Size (0.0..1.0)
 * @param lineWidth Line width
 * @param lineColor Line color
 * @param bulletScale Bullet size respective of text
 * @param bulletColor Bullet color
 * @param backgroundColor Background color of label
 */
export class NVLabel3DStyle {
  textColor: ColorArray
  textScale: number
  textAlignment: LabelTextAlignment
  lineWidth: number
  lineColor: ColorArray
  lineTerminator: LabelLineTerminator
  bulletScale?: number
  bulletColor?: ColorArray
  backgroundColor?: ColorArray

  constructor(
    textColor: ColorArray = [1.0, 1.0, 1.0, 1.0],
    textScale = 1.0,
    textAlignment = LabelTextAlignment.LEFT,
    lineWidth = 0.0,
    lineColor: ColorArray = [0.0, 0.0, 0.0],
    lineTerminator = LabelLineTerminator.NONE,
    bulletScale?: number,
    bulletColor?: ColorArray,
    backgroundColor?: ColorArray
  ) {
    this.textColor = textColor
    this.textScale = textScale
    this.textAlignment = textAlignment
    this.lineWidth = lineWidth
    this.lineColor = lineColor
    this.lineTerminator = lineTerminator
    this.bulletScale = bulletScale
    this.bulletColor = bulletColor
    this.backgroundColor = backgroundColor
  }
}

/**
 * Label class
 * @constructor
 * @param text The text of the label
 * @param style The style of the label
 * @param points An array of points label for label lines
 */
export class NVLabel3D {
  text: string
  style: NVLabel3DStyle
  points: number[][]

  constructor(text: string, style: NVLabel3DStyle, points: number[][]) {
    this.text = text
    this.style = style
    this.points = points
  }
}
