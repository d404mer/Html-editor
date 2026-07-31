import { useEffect, useRef } from 'react'
import { fetchWithRetry } from '../utils/apiFetch'
import type { Project } from '../types/project'
import {
  OPEN_TABS_STORAGE_KEY,
  useProjectStore,
} from '../store/projectStore'

const SYNC_DEBOUNCE_MS = 300

interface StoredTabs {
  tabOrder?: string[]
  activeProjectId?: string | null
}

export async function fetchProject(projectId: string): Promise<Project> {
  const res = await fetchWithRetry(`/api/projects/${projectId}`)
  if (!res.ok) throw new Error('Failed to load project')
  return res.json()
}

export function useMultiProjectSync() {
  const openProjects = useProjectStore((s) => s.openProjects)
  const setProjectSyncStatus = useProjectStore((s) => s.setProjectSyncStatus)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastSyncedRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const timers = timersRef.current

    for (const [projectId, state] of Object.entries(openProjects)) {
      if (!state.loaded) continue

      const serialized = JSON.stringify(state.project)
      if (serialized === lastSyncedRef.current.get(projectId)) continue

      const existing = timers.get(projectId)
      if (existing) clearTimeout(existing)

      timers.set(
        projectId,
        setTimeout(async () => {
          setProjectSyncStatus(projectId, 'syncing')
          try {
            const res = await fetch(`/api/projects/${projectId}/sync`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: serialized,
            })
            if (!res.ok) throw new Error('Sync failed')
            lastSyncedRef.current.set(projectId, serialized)
            setProjectSyncStatus(projectId, 'synced')
          } catch {
            setProjectSyncStatus(projectId, 'error')
          }
        }, SYNC_DEBOUNCE_MS),
      )
    }

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
    }
  }, [openProjects, setProjectSyncStatus])
}

export function useProjectInit() {
  const openProject = useProjectStore((s) => s.openProject)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const createProject = useProjectStore((s) => s.createProject)
  const setAppInitialized = useProjectStore((s) => s.setAppInitialized)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const listRes = await fetchWithRetry('/api/projects')
        if (!listRes.ok) throw new Error('Failed to list projects')
        const list: { id: string; name: string }[] = await listRes.json()

        let stored: StoredTabs = {}
        try {
          stored = JSON.parse(
            localStorage.getItem(OPEN_TABS_STORAGE_KEY) ?? '{}',
          ) as StoredTabs
        } catch {
          stored = {}
        }

        const idsToOpen = (stored.tabOrder ?? []).filter((id) =>
          list.some((p) => p.id === id),
        )

        if (idsToOpen.length === 0 && list.length > 0) {
          idsToOpen.push(list[0].id)
        }

        let opened = 0
        let firstId: string | null = null
        for (const id of idsToOpen) {
          try {
            const project = await fetchProject(id)
            if (!cancelled) {
              if (!firstId) firstId = project.id
              openProject(project, { activate: false })
              opened++
            }
          } catch {
            // skip missing projects
          }
        }

        if (!cancelled && opened === 0) {
          await createProject('Untitled Project')
        } else if (!cancelled) {
          const target =
            stored.activeProjectId &&
            useProjectStore.getState().openProjects[stored.activeProjectId]
              ? stored.activeProjectId
              : firstId
          if (target) setActiveProject(target)
        }

        if (!cancelled) setAppInitialized(true)
      } catch {
        if (!cancelled) {
          try {
            await createProject('Untitled Project')
            setAppInitialized(true)
          } catch {
            setAppInitialized(false)
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [openProject, setActiveProject, createProject, setAppInitialized])
}

/** @deprecated */
export function useProjectSync() {
  useMultiProjectSync()
}
