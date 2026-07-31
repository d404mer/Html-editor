import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { excelDebug } from '../utils/excelDebug'

type DataEventListener = (projectId: string) => void

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let closedByApp = false
const listeners = new Set<DataEventListener>()

function notifyListeners(projectId: string) {
  excelDebug('ws notifyListeners', { projectId, listenerCount: listeners.size })
  for (const listener of listeners) {
    listener(projectId)
  }
}

function connectLiveReload() {
  if (closedByApp || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${location.host}/live`
  excelDebug('ws connecting', { url })
  ws = new WebSocket(url)

  ws.onopen = () => {
    excelDebug('ws open', { url, readyState: ws?.readyState })
  }

  ws.onerror = (event) => {
    excelDebug('ws error', event)
  }

  ws.onmessage = (event) => {
    excelDebug('ws message raw', event.data)
    try {
      const msg = JSON.parse(event.data as string) as {
        type?: string
        projectId?: string
      }
      if (msg.type === 'data' && msg.projectId) {
        excelDebug('ws data event', msg)
        notifyListeners(msg.projectId)
      } else {
        excelDebug('ws message ignored', msg)
      }
    } catch (err) {
      excelDebug('ws message parse error', err)
    }
  }

  ws.onclose = (event) => {
    excelDebug('ws close', { code: event.code, reason: event.reason })
    ws = null
    if (!closedByApp) {
      reconnectTimer = setTimeout(connectLiveReload, 1000)
    }
  }
}

function subscribe(listener: DataEventListener) {
  listeners.add(listener)
  closedByApp = false
  excelDebug('ws subscribe', { listenerCount: listeners.size })
  connectLiveReload()

  return () => {
    listeners.delete(listener)
    excelDebug('ws unsubscribe', { listenerCount: listeners.size })
    if (listeners.size === 0) {
      closedByApp = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      ws?.close()
      ws = null
    }
  }
}

/** Per-project version bump when backend detects Excel/data changes. */
export function useDataLiveUpdates(projectId?: string | null): number {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const tabOrderKey = useProjectStore((s) => s.tabOrder.join(','))
  const targetId = projectId ?? activeProjectId
  const [versions, setVersions] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!tabOrderKey) return

    const openIds = tabOrderKey.split(',').filter(Boolean)

    return subscribe((changedProjectId) => {
      if (!openIds.includes(changedProjectId)) return
      excelDebug('dataLiveUpdate', { changedProjectId })
      setVersions((v) => ({
        ...v,
        [changedProjectId]: (v[changedProjectId] ?? 0) + 1,
      }))
    })
  }, [tabOrderKey])

  return targetId ? (versions[targetId] ?? 0) : 0
}
