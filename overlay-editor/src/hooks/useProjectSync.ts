import { useEffect, useRef } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { Project } from '../types/project'

const SYNC_DEBOUNCE_MS = 300

export async function fetchOrCreateProject(): Promise<Project> {
  const listRes = await fetch('/api/projects')
  if (!listRes.ok) throw new Error('Failed to list projects')

  const projects: { id: string; name: string }[] = await listRes.json()

  if (projects.length > 0) {
    const res = await fetch(`/api/projects/${projects[0].id}`)
    if (!res.ok) throw new Error('Failed to load project')
    return res.json()
  }

  const createRes = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Untitled Project' }),
  })
  if (!createRes.ok) throw new Error('Failed to create project')
  return createRes.json()
}

export function useProjectSync() {
  const project = useProjectStore((s) => s.project)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const setSyncStatus = useProjectStore((s) => s.setSyncStatus)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedRef = useRef<string>('')

  useEffect(() => {
    if (!projectLoaded || !project.id) return

    const serialized = JSON.stringify(project)
    if (serialized === lastSyncedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const res = await fetch(`/api/projects/${project.id}/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        })
        if (!res.ok) throw new Error('Sync failed')
        lastSyncedRef.current = serialized
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }, SYNC_DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [project, projectLoaded, setSyncStatus])
}

export function useProjectInit() {
  const setProject = useProjectStore((s) => s.setProject)
  const setProjectLoaded = useProjectStore((s) => s.setProjectLoaded)
  const setSyncStatus = useProjectStore((s) => s.setSyncStatus)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const project = await fetchOrCreateProject()
        if (!cancelled) {
          setProject(project)
          setProjectLoaded(true)
          setSyncStatus('synced')
        }
      } catch {
        if (!cancelled) setSyncStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [setProject, setProjectLoaded, setSyncStatus])
}
