import { create } from 'zustand'
import type { CanvasObject, EditorState, Project } from '../types/project'

const DEMO_PROJECT: Project = {
  id: 'demo',
  name: 'Untitled Project',
  width: 1920,
  height: 1080,
  assets: [],
  objects: [
    {
      id: 'title',
      type: 'text',
      name: 'Main Title',
      x: 200,
      y: 100,
      width: 500,
      height: 80,
      rotation: 0,
      zIndex: 1,
      visible: true,
      locked: false,
      text: 'Hello Overlay',
      style: {
        fontSize: 64,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'left',
      },
    },
    {
      id: 'subtitle',
      type: 'text',
      name: 'Subtitle',
      x: 200,
      y: 200,
      width: 400,
      height: 40,
      rotation: 0,
      zIndex: 2,
      visible: true,
      locked: false,
      text: 'Broadcast graphics overlay',
      style: {
        fontSize: 24,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        color: '#a0aec0',
        textAlign: 'left',
      },
    },
    {
      id: 'panel',
      type: 'text',
      name: 'Info Panel',
      x: 1400,
      y: 800,
      width: 420,
      height: 200,
      rotation: 0,
      zIndex: 0,
      visible: true,
      locked: false,
      text: '',
      style: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        opacity: 1,
      },
    },
  ],
}

interface ProjectStore extends EditorState {
  project: Project
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  toggleGrid: () => void
  setLeftPanelTab: (tab: EditorState['leftPanelTab']) => void
  selectObject: (id: string, additive?: boolean) => void
  clearSelection: () => void
  updateObject: (id: string, patch: Partial<CanvasObject>) => void
  toggleObjectVisibility: (id: string) => void
  toggleObjectLock: (id: string) => void
  reorderObject: (id: string, direction: 'up' | 'down') => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: DEMO_PROJECT,
  selectedObjectIds: [],
  zoom: 0.5,
  panX: 0,
  panY: 0,
  showGrid: true,
  leftPanelTab: 'layers',

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

  clearSelection: () => set({ selectedObjectIds: [] }),

  updateObject: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        objects: s.project.objects.map((obj) =>
          obj.id === id ? { ...obj, ...patch } : obj,
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
}))
