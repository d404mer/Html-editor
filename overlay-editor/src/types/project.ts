export type ObjectType = 'text' | 'image' | 'video' | 'svg' | 'gif'

export type AssetType = 'image' | 'video' | 'svg' | 'gif'

export type ObjectFit = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down'

export interface CropRect {
  /** Normalized 0–1 region of source image */
  x: number
  y: number
  width: number
  height: number
}

export interface ImageFilters {
  brightness: number
  contrast: number
  blur: number
}

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
  objectFit?: ObjectFit | string
  objectPosition?: string
  flipX?: boolean
  flipY?: boolean
  crop?: CropRect
  filters?: ImageFilters
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
  lockAspectRatio?: boolean
  style: ObjectStyle
  text?: string
  assetId?: string
  customCss?: string
}

export interface Asset {
  id: string
  type: AssetType
  name: string
  path: string
  mimeType?: string
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

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface EditorState {
  selectedObjectIds: string[]
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  leftPanelTab: LeftPanelTab
  syncStatus: SyncStatus
}

export const DEFAULT_IMAGE_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  blur: 0,
}

export const DEFAULT_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}
