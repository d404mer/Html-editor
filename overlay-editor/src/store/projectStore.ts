import { create } from 'zustand'
import type {
  Asset,
  CanvasObject,
  LeftPanelTab,
  ObjectStyle,
  OpenProjectState,
  Project,
  SyncStatus,
  ExcelBinding,
} from '../types/project'
import { DEFAULT_CROP, DEFAULT_IMAGE_FILTERS } from '../types/project'
import { fetchWithRetry } from '../utils/apiFetch'

export const OPEN_TABS_STORAGE_KEY = 'overlay-editor.openTabs'

const HISTORY_LIMIT = 50

function cloneObjects(objects: CanvasObject[]): CanvasObject[] {
  return structuredClone(objects)
}

function createInitialHistory(objects: CanvasObject[]) {
  return {
    history: [cloneObjects(objects)],
    historyIndex: 0,
  }
}

function idPrefixForType(type: CanvasObject['type']): string {
  return type === 'text' ? 'txt' : 'img'
}

function nextZIndex(objects: CanvasObject[]): number {
  if (objects.length === 0) return 1
  return Math.max(...objects.map((o) => o.zIndex)) + 1
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function createOpenProjectState(project: Project): OpenProjectState {
  return {
    project,
    loaded: true,
    syncStatus: 'synced',
    selectedObjectIds: [],
    zoom: 0.5,
    panX: 0,
    panY: 0,
    showGrid: true,
    leftPanelTab: 'layers',
    editingTextId: null,
    ...createInitialHistory(project.objects),
    userHasPanned: false,
    fitViewNonce: 0,
  }
}

function ensureHistoryFields(state: OpenProjectState): OpenProjectState {
  if (state.history?.length && state.historyIndex !== undefined) {
    return {
      ...state,
      userHasPanned: state.userHasPanned ?? false,
      fitViewNonce: state.fitViewNonce ?? 0,
    }
  }
  return {
    ...state,
    ...createInitialHistory(state.project.objects),
    userHasPanned: state.userHasPanned ?? false,
    fitViewNonce: state.fitViewNonce ?? 0,
  }
}

function persistOpenTabs(tabOrder: string[], activeProjectId: string | null) {
  try {
    localStorage.setItem(
      OPEN_TABS_STORAGE_KEY,
      JSON.stringify({ tabOrder, activeProjectId }),
    )
  } catch {
    // ignore quota errors
  }
}

interface ProjectStore {
  openProjects: Record<string, OpenProjectState>
  activeProjectId: string | null
  tabOrder: string[]
  appInitialized: boolean

  /** @deprecated use active project via useActiveProject */
  project: Project
  /** @deprecated use appInitialized */
  projectLoaded: boolean
  selectedObjectIds: string[]
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  leftPanelTab: LeftPanelTab
  syncStatus: SyncStatus
  editingTextId: string | null
  clipboard: CanvasObject[] | null

  setAppInitialized: (initialized: boolean) => void
  openProject: (project: Project, options?: { activate?: boolean }) => void
  closeProject: (projectId: string) => void
  setActiveProject: (projectId: string) => void
  replaceOpenProject: (project: Project) => void
  /** @deprecated use replaceOpenProject */
  setProject: (project: Project) => void
  setProjectSyncStatus: (projectId: string, status: SyncStatus) => void
  createProject: (name?: string) => Promise<Project>
  importProject: (file: File) => Promise<Project>
  renameActiveProject: (name: string) => Promise<void>
  deleteProjectFromDisk: (projectId: string) => Promise<void>

  setZoom: (zoom: number) => void
  setPan: (x: number, y: number, options?: { userInitiated?: boolean }) => void
  applyFitToView: (containerW: number, containerH: number) => void
  requestFitToView: () => void
  toggleGrid: () => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  copySelectedObjects: () => void
  pasteObjects: (offset?: { x: number; y: number }) => void
  setLeftPanelTab: (tab: LeftPanelTab) => void
  selectObject: (id: string, additive?: boolean) => void
  clearSelection: () => void
  updateObject: (
    id: string,
    patch: Partial<CanvasObject>,
    options?: { skipHistory?: boolean },
  ) => void
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
  setTextBinding: (objectId: string, binding: ExcelBinding | undefined) => void
  setImageBinding: (objectId: string, binding: ExcelBinding | undefined) => void
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

function getActiveState(store: ProjectStore): OpenProjectState | null {
  const id = store.activeProjectId
  if (!id) return null
  return store.openProjects[id] ?? null
}

function patchActive(
  set: (
    partial:
      | Partial<ProjectStore>
      | ((state: ProjectStore) => Partial<ProjectStore>),
  ) => void,
  get: () => ProjectStore,
  patch: (state: OpenProjectState) => OpenProjectState,
) {
  const activeId = get().activeProjectId
  if (!activeId) return
  const current = get().openProjects[activeId]
  if (!current) return
  const next = patch(current)
  set({
    openProjects: { ...get().openProjects, [activeId]: next },
  })
}

function patchProjectById(
  set: (
    partial:
      | Partial<ProjectStore>
      | ((state: ProjectStore) => Partial<ProjectStore>),
  ) => void,
  get: () => ProjectStore,
  projectId: string,
  patch: (state: OpenProjectState) => OpenProjectState,
) {
  const current = get().openProjects[projectId]
  if (!current) return
  set({
    openProjects: { ...get().openProjects, [projectId]: patch(current) },
  })
}

function appendHistory(
  state: OpenProjectState,
  newObjects: CanvasObject[],
): OpenProjectState {
  let history = state.history.slice(0, state.historyIndex + 1)
  history.push(cloneObjects(newObjects))
  if (history.length > HISTORY_LIMIT) {
    history = history.slice(history.length - HISTORY_LIMIT)
  }
  return {
    ...state,
    project: { ...state.project, objects: newObjects },
    history,
    historyIndex: history.length - 1,
  }
}

function mutateObjects(
  set: (
    partial:
      | Partial<ProjectStore>
      | ((state: ProjectStore) => Partial<ProjectStore>),
  ) => void,
  get: () => ProjectStore,
  mutator: (objects: CanvasObject[]) => CanvasObject[],
  extra?: (state: OpenProjectState) => Partial<OpenProjectState>,
) {
  patchActive(set, get, (s) => {
    const newObjects = mutator(s.project.objects)
    const next = appendHistory(s, newObjects)
    return { ...next, ...extra?.(s) }
  })
  const active = getActiveState(get())
  if (active) set({ project: active.project })
}

function syncActiveProjectView(set: (p: Partial<ProjectStore>) => void, get: () => ProjectStore) {
  const active = getActiveState(get())
  if (active) {
    set({
      project: active.project,
      selectedObjectIds: active.selectedObjectIds,
      zoom: active.zoom,
      panX: active.panX,
      panY: active.panY,
    })
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  openProjects: {},
  activeProjectId: null,
  tabOrder: [],
  appInitialized: false,

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
  clipboard: null,

  setAppInitialized: (appInitialized) => set({ appInitialized, projectLoaded: appInitialized }),

  openProject: (project, options) => {
    const activate = options?.activate !== false
    const state = get()
    const exists = state.openProjects[project.id]
    const openProjects = {
      ...state.openProjects,
      [project.id]: exists
        ? ensureHistoryFields({ ...exists, project, loaded: true })
        : createOpenProjectState(project),
    }
    const tabOrder = state.tabOrder.includes(project.id)
      ? state.tabOrder
      : [...state.tabOrder, project.id]
    const nextActiveId = activate ? project.id : state.activeProjectId ?? project.id
    persistOpenTabs(tabOrder, nextActiveId)
    const active = openProjects[nextActiveId]
    set({
      openProjects,
      tabOrder,
      activeProjectId: nextActiveId,
      ...(active
        ? {
            project: active.project,
            projectLoaded: true,
            selectedObjectIds: active.selectedObjectIds,
            zoom: active.zoom,
            panX: active.panX,
            panY: active.panY,
            showGrid: active.showGrid,
            leftPanelTab: active.leftPanelTab,
            syncStatus: active.syncStatus,
            editingTextId: active.editingTextId,
          }
        : {}),
    })
  },

  closeProject: (projectId) => {
    const state = get()
    const { [projectId]: _removed, ...rest } = state.openProjects
    const tabOrder = state.tabOrder.filter((id) => id !== projectId)
    let activeProjectId = state.activeProjectId
    if (activeProjectId === projectId) {
      activeProjectId = tabOrder[tabOrder.length - 1] ?? null
    }
    persistOpenTabs(tabOrder, activeProjectId)
    const active = activeProjectId ? rest[activeProjectId] : null
    set({
      openProjects: rest,
      tabOrder,
      activeProjectId,
      project: active?.project ?? EMPTY_PROJECT,
      projectLoaded: !!active,
      selectedObjectIds: active?.selectedObjectIds ?? [],
      zoom: active?.zoom ?? 0.5,
      panX: active?.panX ?? 0,
      panY: active?.panY ?? 0,
      showGrid: active?.showGrid ?? true,
      leftPanelTab: active?.leftPanelTab ?? 'layers',
      syncStatus: active?.syncStatus ?? 'idle',
      editingTextId: active?.editingTextId ?? null,
    })
  },

  setActiveProject: (projectId) => {
    const state = get()
    const active = state.openProjects[projectId]
    if (!active) return
    persistOpenTabs(state.tabOrder, projectId)
    set({
      activeProjectId: projectId,
      project: active.project,
      projectLoaded: active.loaded,
      selectedObjectIds: active.selectedObjectIds,
      zoom: active.zoom,
      panX: active.panX,
      panY: active.panY,
      showGrid: active.showGrid,
      leftPanelTab: active.leftPanelTab,
      syncStatus: active.syncStatus,
      editingTextId: active.editingTextId,
    })
  },

  replaceOpenProject: (project) => {
    patchProjectById(set, get, project.id, (s) => ({
      ...s,
      project,
      syncStatus: 'synced',
      ...createInitialHistory(project.objects),
    }))
    const active = getActiveState(get())
    if (active && get().activeProjectId === project.id) {
      set({ project, syncStatus: 'synced' })
    }
  },

  setProject: (project) => {
    get().replaceOpenProject(project)
  },

  setProjectSyncStatus: (projectId, syncStatus) => {
    patchProjectById(set, get, projectId, (s) => ({ ...s, syncStatus }))
    if (get().activeProjectId === projectId) {
      set({ syncStatus })
    }
  },

  createProject: async (name = 'Untitled Project') => {
    const res = await fetchWithRetry('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Failed to create project')
    const project: Project = await res.json()
    get().openProject(project)
    return project
  },

  importProject: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/projects/import', { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Import failed')
    }
    const project: Project = await res.json()
    get().openProject(project)
    return project
  },

  renameActiveProject: async (name) => {
    const activeId = get().activeProjectId
    if (!activeId) return
    const res = await fetch(`/api/projects/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Rename failed')
    const project: Project = await res.json()
    patchProjectById(set, get, activeId, (s) => ({ ...s, project }))
    if (get().activeProjectId === activeId) {
      set({ project })
    }
  },

  deleteProjectFromDisk: async (projectId) => {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    get().closeProject(projectId)
  },

  setZoom: (zoom) => {
    const value = Math.min(4, Math.max(0.1, zoom))
    patchActive(set, get, (s) => ({ ...s, zoom: value }))
    set({ zoom: value })
  },

  setPan: (panX, panY, options) => {
    patchActive(set, get, (s) => ({
      ...s,
      panX,
      panY,
      userHasPanned: options?.userInitiated ? true : s.userHasPanned,
    }))
    set({ panX, panY })
  },

  applyFitToView: (containerW, containerH) => {
    const active = getActiveState(get())
    if (!active) return
    const padding = 40
    const scaleX = (containerW - padding * 2) / active.project.width
    const scaleY = (containerH - padding * 2) / active.project.height
    const zoom = Math.min(4, Math.max(0.1, Math.min(scaleX, scaleY)))
    const panX = (containerW - active.project.width * zoom) / 2
    const panY = (containerH - active.project.height * zoom) / 2
    patchActive(set, get, (s) => ({
      ...s,
      zoom,
      panX,
      panY,
      userHasPanned: false,
    }))
    set({ zoom, panX, panY })
  },

  requestFitToView: () => {
    patchActive(set, get, (s) => ({
      ...s,
      fitViewNonce: s.fitViewNonce + 1,
      userHasPanned: false,
    }))
  },

  pushHistory: () => {
    patchActive(set, get, (s) => {
      let history = s.history.slice(0, s.historyIndex + 1)
      history.push(cloneObjects(s.project.objects))
      if (history.length > HISTORY_LIMIT) {
        history = history.slice(history.length - HISTORY_LIMIT)
      }
      return { ...s, history, historyIndex: history.length - 1 }
    })
  },

  undo: () => {
    patchActive(set, get, (s) => {
      if (s.historyIndex <= 0) return s
      const newIndex = s.historyIndex - 1
      return {
        ...s,
        historyIndex: newIndex,
        project: {
          ...s.project,
          objects: cloneObjects(s.history[newIndex]),
        },
        selectedObjectIds: [],
      }
    })
    syncActiveProjectView(set, get)
    const active = getActiveState(get())
    if (active) set({ selectedObjectIds: active.selectedObjectIds })
  },

  redo: () => {
    patchActive(set, get, (s) => {
      if (s.historyIndex >= s.history.length - 1) return s
      const newIndex = s.historyIndex + 1
      return {
        ...s,
        historyIndex: newIndex,
        project: {
          ...s.project,
          objects: cloneObjects(s.history[newIndex]),
        },
        selectedObjectIds: [],
      }
    })
    syncActiveProjectView(set, get)
    const active = getActiveState(get())
    if (active) set({ selectedObjectIds: active.selectedObjectIds })
  },

  canUndo: () => {
    const active = getActiveState(get())
    return (active?.historyIndex ?? 0) > 0
  },

  canRedo: () => {
    const active = getActiveState(get())
    if (!active) return false
    return active.historyIndex < active.history.length - 1
  },

  copySelectedObjects: () => {
    const active = getActiveState(get())
    if (!active?.selectedObjectIds.length) return
    const copied = active.project.objects
      .filter((o) => active.selectedObjectIds.includes(o.id))
      .map((o) => structuredClone(o))
    set({ clipboard: copied })
  },

  pasteObjects: (offset = { x: 20, y: 20 }) => {
    const active = getActiveState(get())
    const items = get().clipboard
    if (!active || !items?.length) return

    const newIds: string[] = []
    let z = nextZIndex(active.project.objects)
    const pasted = items.map((obj) => {
      const id = createId(idPrefixForType(obj.type))
      newIds.push(id)
      z += 1
      return {
        ...structuredClone(obj),
        id,
        x: obj.x + offset.x,
        y: obj.y + offset.y,
        zIndex: z,
      }
    })

    mutateObjects(set, get, (objects) => [...objects, ...pasted], () => ({
      selectedObjectIds: newIds,
    }))
    const next = getActiveState(get())
    if (next) set({ selectedObjectIds: newIds })
  },

  toggleGrid: () => {
    patchActive(set, get, (s) => ({ ...s, showGrid: !s.showGrid }))
    set((s) => ({ showGrid: !s.showGrid }))
  },

  setLeftPanelTab: (leftPanelTab) => {
    patchActive(set, get, (s) => ({ ...s, leftPanelTab }))
    set({ leftPanelTab })
  },

  selectObject: (id, additive = false) => {
    patchActive(set, get, (s) => {
      if (additive) {
        const exists = s.selectedObjectIds.includes(id)
        return {
          ...s,
          selectedObjectIds: exists
            ? s.selectedObjectIds.filter((oid) => oid !== id)
            : [...s.selectedObjectIds, id],
        }
      }
      return { ...s, selectedObjectIds: [id] }
    })
    const active = getActiveState(get())
    if (active) set({ selectedObjectIds: active.selectedObjectIds })
  },

  clearSelection: () => {
    patchActive(set, get, (s) => ({
      ...s,
      selectedObjectIds: [],
      editingTextId: null,
    }))
    set({ selectedObjectIds: [], editingTextId: null })
  },

  updateObject: (id, patch, options) => {
    if (options?.skipHistory) {
      patchActive(set, get, (s) => ({
        ...s,
        project: {
          ...s.project,
          objects: s.project.objects.map((obj) =>
            obj.id === id ? { ...obj, ...patch } : obj,
          ),
        },
      }))
    } else {
      mutateObjects(set, get, (objects) =>
        objects.map((obj) => (obj.id === id ? { ...obj, ...patch } : obj)),
      )
    }
    const active = getActiveState(get())
    if (active) set({ project: active.project })
  },

  updateObjectStyle: (id, patch) => {
    mutateObjects(set, get, (objects) =>
      objects.map((obj) =>
        obj.id === id ? { ...obj, style: { ...obj.style, ...patch } } : obj,
      ),
    )
  },

  toggleObjectVisibility: (id) => {
    mutateObjects(set, get, (objects) =>
      objects.map((obj) =>
        obj.id === id ? { ...obj, visible: !obj.visible } : obj,
      ),
    )
  },

  toggleObjectLock: (id) => {
    mutateObjects(set, get, (objects) =>
      objects.map((obj) =>
        obj.id === id ? { ...obj, locked: !obj.locked } : obj,
      ),
    )
  },

  reorderObject: (id, direction) => {
    const active = getActiveState(get())
    if (!active) return
    const sorted = [...active.project.objects].sort((a, b) => a.zIndex - b.zIndex)
    const index = sorted.findIndex((o) => o.id === id)
    if (index === -1) return
    const swapIndex = direction === 'up' ? index + 1 : index - 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return
    const current = sorted[index]
    const target = sorted[swapIndex]
    mutateObjects(set, get, (objects) =>
      objects.map((obj) => {
        if (obj.id === current.id) return { ...obj, zIndex: target.zIndex }
        if (obj.id === target.id) return { ...obj, zIndex: current.zIndex }
        return obj
      }),
    )
  },

  addAsset: (asset) => {
    patchActive(set, get, (s) => ({
      ...s,
      project: { ...s.project, assets: [...s.project.assets, asset] },
    }))
    const active = getActiveState(get())
    if (active) set({ project: active.project })
  },

  removeAsset: (assetId) => {
    patchActive(set, get, (s) => ({
      ...s,
      project: {
        ...s.project,
        assets: s.project.assets.filter((a) => a.id !== assetId),
        objects: s.project.objects.map((obj) =>
          obj.assetId === assetId ? { ...obj, assetId: undefined } : obj,
        ),
      },
    }))
    const active = getActiveState(get())
    if (active) set({ project: active.project })
  },

  renameAsset: (assetId, name) => {
    patchActive(set, get, (s) => ({
      ...s,
      project: {
        ...s.project,
        assets: s.project.assets.map((a) =>
          a.id === assetId ? { ...a, name } : a,
        ),
      },
    }))
    const active = getActiveState(get())
    if (active) set({ project: active.project })
  },

  replaceAsset: (assetId, asset) => {
    patchActive(set, get, (s) => ({
      ...s,
      project: {
        ...s.project,
        assets: s.project.assets.map((a) => (a.id === assetId ? asset : a)),
      },
    }))
    const active = getActiveState(get())
    if (active) set({ project: active.project })
  },

  addImageObject: (asset, position) => {
    const active = getActiveState(get())
    if (!active) return ''
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
      zIndex: nextZIndex(active.project.objects),
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
    mutateObjects(set, get, (objects) => [...objects, obj], () => ({
      selectedObjectIds: [id],
    }))
    const next = getActiveState(get())
    if (next) set({ project: next.project, selectedObjectIds: [id] })
    return id
  },

  addTextObject: (position) => {
    const active = getActiveState(get())
    if (!active) return ''
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
      zIndex: nextZIndex(active.project.objects),
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
    mutateObjects(set, get, (objects) => [...objects, obj], () => ({
      selectedObjectIds: [id],
    }))
    const next = getActiveState(get())
    if (next) set({ project: next.project, selectedObjectIds: [id] })
    return id
  },

  setTextBinding: (objectId, textBinding) => {
    get().updateObject(objectId, { textBinding })
  },

  setImageBinding: (objectId, imageBinding) => {
    get().updateObject(objectId, { imageBinding })
  },

  updateTextContent: (objectId, content) => {
    const active = getActiveState(get())
    if (!active) return
    const obj = active.project.objects.find((o) => o.id === objectId)
    if (!obj || obj.type !== 'text') return
    if (obj.textBinding) {
      get().updateObject(objectId, {
        textBinding: { ...obj.textBinding, fallback: content },
      })
    } else {
      get().updateObject(objectId, { text: content })
    }
  },

  setEditingTextId: (editingTextId) => {
    patchActive(set, get, (s) => ({ ...s, editingTextId }))
    set({ editingTextId })
  },

  replaceObjectAsset: (objectId, asset) => {
    const isGif = asset.type === 'gif'
    get().updateObject(objectId, {
      assetId: asset.id,
      type: isGif ? 'gif' : 'image',
      name: asset.name.replace(/\.[^.]+$/, ''),
    })
  },

  deleteSelectedObjects: () => {
    const active = getActiveState(get())
    if (!active?.selectedObjectIds.length) return
    const ids = new Set(active.selectedObjectIds)
    mutateObjects(
      set,
      get,
      (objects) => objects.filter((obj) => !ids.has(obj.id)),
      () => ({ selectedObjectIds: [] }),
    )
    const next = getActiveState(get())
    if (next) set({ project: next.project, selectedObjectIds: [] })
  },

  getAssetUrl: (asset) => {
    const activeId = get().activeProjectId
    if (!activeId) return ''
    const rel = asset.path.replace(/\\/g, '/')
    return `/preview/${activeId}/${rel}`
  },
}))
