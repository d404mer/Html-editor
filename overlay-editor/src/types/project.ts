export type ObjectType = 'text' | 'image' | 'video' | 'svg' | 'gif'

export type AssetType = 'image' | 'video' | 'svg' | 'gif'

export type TextBindingMode = 'cell' | 'column'

/** Привязка объекта к полю Excel (текст или путь к файлу) */
export interface ExcelBinding {
  fileId: string
  sheet: string
  mode: TextBindingMode
  /** Ячейка, например B2 (mode: cell) */
  cell?: string
  /** Заголовок столбца (mode: column) */
  column?: string
  /** Номер строки в листе, 1-based (строка 1 — заголовки) */
  row?: number
  /** Значение по умолчанию: текст или путь к файлу в проекте */
  fallback?: string
}

/** @deprecated alias — используйте ExcelBinding */
export type TextBinding = ExcelBinding

export interface DataFile {
  id: string
  name: string
  path: string
}

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
  /** Привязка к Excel — текст берётся из файла data/ */
  textBinding?: ExcelBinding
  /** Привязка к Excel — путь к изображению берётся из файла data/ */
  imageBinding?: ExcelBinding
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
  dataFiles?: DataFile[]
}

export type LeftPanelTab = 'layers' | 'assets' | 'data'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface ProjectSummary {
  id: string
  name: string
  updatedAt?: string
}

export interface OpenProjectState {
  project: Project
  loaded: boolean
  syncStatus: SyncStatus
  selectedObjectIds: string[]
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  leftPanelTab: LeftPanelTab
  editingTextId: string | null
  /** Snapshots of project.objects for undo/redo */
  history: CanvasObject[][]
  historyIndex: number
  userHasPanned: boolean
  /** Incremented to trigger fit-to-view in Canvas */
  fitViewNonce: number
}

export interface EditorState {
  selectedObjectIds: string[]
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  leftPanelTab: LeftPanelTab
  syncStatus: SyncStatus
  /** ID текстового объекта в режиме inline-редактирования */
  editingTextId: string | null
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
