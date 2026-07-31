import { useProjectStore } from '../store/projectStore'
import type { OpenProjectState, Project } from '../types/project'

export function useActiveProjectState(): OpenProjectState | null {
  return useProjectStore((s) =>
    s.activeProjectId ? (s.openProjects[s.activeProjectId] ?? null) : null,
  )
}

export function useActiveProject(): Project | null {
  return useProjectStore((s) =>
    s.activeProjectId ? (s.openProjects[s.activeProjectId]?.project ?? null) : null,
  )
}

export function useActiveProjectId(): string | null {
  return useProjectStore((s) => s.activeProjectId)
}

export function useOpenProjectIds(): string[] {
  return useProjectStore((s) => s.tabOrder)
}

export function useAppInitialized(): boolean {
  return useProjectStore((s) => s.appInitialized)
}
