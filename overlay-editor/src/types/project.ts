export type ObjectType = 'text' | 'image' | 'video' | 'svg' | 'gif'

export type AssetType = 'image' | 'video' | 'svg' | 'gif'

export interface ObjectStyle {
  backgroundColor?: string
  color?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number | string
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right'
  opacity?: number
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  boxShadow?: string
  filter?: string
  objectFit?: string
  objectPosition?: string
}

export interface CanvasObject {
  id: string
  type: ObjectType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  visible: boolean
  locked: boolean
  style: ObjectStyle
  text?: string
  assetId?: string
}

export interface Asset {
  id: string
  type: AssetType
  name: string
  path: string
}

export interface Project {
  id: string
  name: string
  width: number
  height: number
  objects: CanvasObject[]
  assets: Asset[]
}

export type LeftPanelTab = 'layers' | 'assets'

export interface EditorState {
  selectedObjectIds: string[]
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  leftPanelTab: LeftPanelTab
}
