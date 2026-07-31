import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useDataLiveUpdates } from './useDataLiveUpdates'
import { excelDebug } from '../utils/excelDebug'
import { resolveImageDisplayPath } from '../utils/bindingPath'
import type { Asset, CanvasObject } from '../types/project'

const POLL_INTERVAL_MS = 10_000

export function useExcelValues(): Record<string, string> {
  const project = useProjectStore((s) => s.project)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const dataLiveVersion = useDataLiveUpdates()
  const bindingKey = useProjectStore((s) =>
    JSON.stringify(
      s.project.objects
        .filter(
          (o) =>
            (o.type === 'text' && o.textBinding) ||
            ((o.type === 'image' || o.type === 'gif') && o.imageBinding),
        )
        .map((o) => ({
          id: o.id,
          kind: o.textBinding ? 'text' : 'image',
          b: o.textBinding ?? o.imageBinding,
        })),
    ),
  )
  const dataFilesKey = useProjectStore((s) =>
    JSON.stringify(s.project.dataFiles ?? []),
  )

  const hasBindings = bindingKey !== '[]'
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    excelDebug('useExcelValues effect', {
      projectId: project.id,
      projectLoaded,
      hasBindings,
      bindingKey,
      dataFilesKey,
      dataLiveVersion,
    })

    if (!projectLoaded || !project.id || !hasBindings) {
      excelDebug('useExcelValues skip (no bindings or not loaded)')
      setValues({})
      return
    }

    let cancelled = false

    const run = async (reason: string) => {
      const { project: currentProject, projectLoaded: loaded } =
        useProjectStore.getState()
      if (!loaded || !currentProject.id) {
        excelDebug('fetch skip: project not loaded', { reason })
        return
      }

      excelDebug('fetch start', { reason, projectId: currentProject.id })

      try {
        const res = await fetch(`/api/projects/${currentProject.id}/data/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: currentProject }),
        })
        excelDebug('fetch response', { reason, status: res.status, ok: res.ok })
        if (!res.ok || cancelled) return
        const data = await res.json()
        excelDebug('fetch values', { reason, data })
        if (!cancelled) setValues(data)
      } catch (err) {
        excelDebug('fetch error', { reason, err })
      }
    }

    run('initial/live/poll')
    const interval = setInterval(() => run('poll'), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
      excelDebug('useExcelValues cleanup')
    }
  }, [
    project.id,
    projectLoaded,
    hasBindings,
    bindingKey,
    dataFilesKey,
    dataLiveVersion,
  ])

  return values
}

export function getObjectDisplayText(
  object: { id: string; type: string; text?: string; textBinding?: { fallback?: string } },
  excelValues: Record<string, string>,
): string {
  if (object.type !== 'text') return object.text ?? ''
  if (object.textBinding) {
    return excelValues[object.id] ?? object.textBinding.fallback ?? object.text ?? ''
  }
  return object.text ?? ''
}

export function getObjectDisplayImagePath(
  object: CanvasObject,
  excelValues: Record<string, string>,
  ctx: { projectId: string; assets?: Asset[]; assetPath?: string },
): string {
  if (object.type !== 'image' && object.type !== 'gif') return ctx.assetPath ?? ''
  if (!object.imageBinding) return ctx.assetPath ?? ''
  return resolveImageDisplayPath(
    excelValues[object.id],
    object.imageBinding,
    ctx.assetPath,
    { projectId: ctx.projectId, assets: ctx.assets },
  )
}
