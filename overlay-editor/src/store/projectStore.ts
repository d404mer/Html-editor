import { create } from 'zustand'
import type {
  Asset,
  CanvasObject,
  EditorState,
  ObjectStyle,
  Project,
  SyncStatus,
  TextBinding,
} from '../types/project'
import { DEFAULT_CROP, DEFAULT_IMAGE_FILTERS } from '../types/project'

function nextZIndex(objects: CanvasObject[]): number {
  if (objects.length === 0) return 1
  return Math.max(...objects.map((o) => o.zIndex)) + 1
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

interface ProjectStore extends EditorState {
  project: Project
  projectLoaded: boolean
  setProject: (project: Project) => void
  setProjectLoaded: (loaded: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  toggleGrid: () => void
  setLeftPanelTab: (tab: EditorState['leftPanelTab']) => void
  selectObject: (id: string, additive?: boolean) => void
  clearSelection: () => void
  updateObject: (id: string, patch: Partial<CanvasObject>) => void
  updateObjectStyle: (id: string, patch: Partial<ObjectStyle>) => void
  toggleObjectVisibility: (id: string) => void
  toggleObjectLock: (id: string) => void
  reorderObject: (id: string, direction: 'up' | 'down') => void
  addAsset: (asset: Asset) => void
  removeAsset: (assetId: string) => void
  renameAsset: (assetId: string, name: string) => void
  replaceAsset: (assetId: string, asset: Asset) => void
  addImageObject: (asset: Asset, position?: { x: number; y: number }) => string
  addTextObject: (position?: { x: number; y: number }) => string
  replaceObjectAsset: (objectId: string, asset: Asset) => void
  setTextBinding: (objectId: string, binding: TextBinding | undefined) => void
  updateTextContent: (objectId: string, content: string) => void
  setEditingTextId: (id: string | null) => void
  deleteSelectedObjects: () => void
  getAssetUrl: (asset: Asset) => string
}

const EMPTY_PROJECT: Project = {
  id: '',
  name: 'Loading…',
  width: 1920,
  height: 1080,
  assets: [],
  dataFiles: [],
  objects: [],
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: EMPTY_PROJECT,
  projectLoaded: false,
  selectedObjectIds: [],
  zoom: 0.5,
  panX: 0,
  panY: 0,
  showGrid: true,
  leftPanelTab: 'layers',
  syncStatus: 'idle',
  editingTextId: null,

  setProject: (project) => set({ project }),
  setProjectLoaded: (projectLoaded) => set({ projectLoaded }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),

  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.1, zoom)) }),

  setPan: (panX, panY) => set({ panX, panY }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  setLeftPanelTab: (leftPanelTab) => set({ leftPanelTab }),

  selectObject: (id, additive = false) =>
    set((s) => {
      if (additive) {
        const exists = s.selectedObjectIds.includes(id)
        return {
          selectedObjectIds: exists
            ? s.selectedObjectIds.filter((oid) => oid !== id)
            : [...s.selectedObjectIds, id],
        }
      }
      return { selectedObjectIds: [id] }
    }),

  clearSelection: () => set({ selectedObjectIds: [], editingTextId: null }),

  updateObject: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        objects: s.project.objects.map((obj) =>
          obj.id === id ? { ...obj, ...patch } : obj,
        ),
      },
    })),

  updateObjectStyle: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        objects: s.project.objects.map((obj) =>
          obj.id === id ? { ...obj, style: { ...obj.style, ...patch } } : obj,
        ),
      },
    })),

  toggleObjectVisibility: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        objects: s.project.objects.map((obj) =>
          obj.id === id ? { ...obj, visible: !obj.visible } : obj,
        ),
      },
    })),

  toggleObjectLock: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        objects: s.project.objects.map((obj) =>
          obj.id === id ? { ...obj, locked: !obj.locked } : obj,
        ),
      },
    })),

  reorderObject: (id, direction) => {
    const { project } = get()
    const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex)
    const index = sorted.findIndex((o) => o.id === id)
    if (index === -1) return

    const swapIndex = direction === 'up' ? index + 1 : index - 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return

    const current = sorted[index]
    const target = sorted[swapIndex]
    const objects = project.objects.map((obj) => {
      if (obj.id === current.id) return { ...obj, zIndex: target.zIndex }
      if (obj.id === target.id) return { ...obj, zIndex: current.zIndex }
      return obj
    })

    set({ project: { ...project, objects } })
  },

  addAsset: (asset) =>
    set((s) => ({
      project: { ...s.project, assets: [...s.project.assets, asset] },
    })),

  removeAsset: (assetId) =>
    set((s) => ({
      project: {
        ...s.project,
        assets: s.project.assets.filter((a) => a.id !== assetId),
        objects: s.project.objects.map((obj) =>
          obj.assetId === assetId ? { ...obj, assetId: undefined } : obj,
        ),
      },
    })),

  renameAsset: (assetId, name) =>
    set((s) => ({
      project: {
        ...s.project,
        assets: s.project.assets.map((a) =>
          a.id === assetId ? { ...a, name } : a,
        ),
      },
    })),

  replaceAsset: (assetId, asset) =>
    set((s) => ({
      project: {
        ...s.project,
        assets: s.project.assets.map((a) => (a.id === assetId ? asset : a)),
      },
    })),

  addImageObject: (asset, position) => {
    const { project } = get()
    const id = createId('img')
    const isGif = asset.type === 'gif'
    const obj: CanvasObject = {
      id,
      type: isGif ? 'gif' : 'image',
      name: asset.name.replace(/\.[^.]+$/, ''),
      x: position?.x ?? 100,
      y: position?.y ?? 100,
      width: 400,
      height: 300,
      rotation: 0,
      zIndex: nextZIndex(project.objects),
      visible: true,
      locked: false,
      lockAspectRatio: true,
      assetId: asset.id,
      style: {
        opacity: 1,
        objectFit: 'cover',
        objectPosition: 'center',
        filters: { ...DEFAULT_IMAGE_FILTERS },
        crop: { ...DEFAULT_CROP },
      },
    }

    set((s) => ({
      project: { ...s.project, objects: [...s.project.objects, obj] },
      selectedObjectIds: [id],
    }))

    return id
  },

  addTextObject: (position) => {
    const { project } = get()
    const id = createId('txt')
    const obj: CanvasObject = {
      id,
      type: 'text',
      name: 'Text',
      x: position?.x ?? 200,
      y: position?.y ?? 200,
      width: 400,
      height: 60,
      rotation: 0,
      zIndex: nextZIndex(project.objects),
      visible: true,
      locked: false,
      text: 'Текст',
      style: {
        fontSize: 32,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        color: '#ffffff',
        textAlign: 'left',
        opacity: 1,
      },
    }

    set((s) => ({
      project: { ...s.project, objects: [...s.project.objects, obj] },
      selectedObjectIds: [id],
    }))

    return id
  },

  setTextBinding: (objectId, textBinding) => {
    get().updateObject(objectId, { textBinding })
  },

  updateTextContent: (objectId, content) => {
    const obj = get().project.objects.find((o) => o.id === objectId)
    if (!obj || obj.type !== 'text') return
    if (obj.textBinding) {
      get().updateObject(objectId, {
        textBinding: { ...obj.textBinding, fallback: content },
      })
    } else {
      get().updateObject(objectId, { text: content })
    }
  },

  setEditingTextId: (editingTextId) => set({ editingTextId }),

  replaceObjectAsset: (objectId, asset) => {
    const isGif = asset.type === 'gif'
    get().updateObject(objectId, {
      assetId: asset.id,
      type: isGif ? 'gif' : 'image',
      name: asset.name.replace(/\.[^.]+$/, ''),
    })
  },

  deleteSelectedObjects: () =>
    set((s) => ({
      project: {
        ...s.project,
        objects: s.project.objects.filter(
          (obj) => !s.selectedObjectIds.includes(obj.id),
        ),
      },
      selectedObjectIds: [],
    })),

  getAssetUrl: (asset) => {
    const { project } = get()
    const rel = asset.path.replace(/\\/g, '/')
    return `/preview/${project.id}/${rel}`
  },
}))
