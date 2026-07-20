import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useDataLiveUpdates } from './useDataLiveUpdates'
import type { TextBinding } from '../types/project'

export interface SheetSchema {
  name: string
  headers: string[]
  rowCount: number
  sampleRows: string[][]
}

export function useExcelSchema(fileId: string | undefined) {
  const projectId = useProjectStore((s) => s.project.id)
  const dataLiveVersion = useDataLiveUpdates()
  const [schema, setSchema] = useState<{ sheets: SheetSchema[] } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId || !fileId) {
      setSchema(null)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/projects/${projectId}/data/${fileId}/schema`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSchema(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, fileId, dataLiveVersion])

  return { schema, loading }
}

export async function scanDataFiles(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}/data/scan`, { method: 'POST' })
  if (!res.ok) throw new Error('Scan failed')
  return res.json()
}

export async function uploadDataFile(projectId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/projects/${projectId}/data`, { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

export function defaultBinding(fileId: string, sheet: string): TextBinding {
  return {
    fileId,
    sheet,
    mode: 'column',
    column: '',
    row: 2,
    fallback: '—',
  }
}
