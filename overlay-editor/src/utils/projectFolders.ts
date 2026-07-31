import type { Project } from '../types/project'

export type RevealTarget = 'project' | 'assets' | 'assetsImages' | 'data'

export async function scanAssets(projectId: string): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}/assets/scan`, { method: 'POST' })
  if (!res.ok) throw new Error('Scan failed')
  return res.json()
}

export async function revealProjectFolder(
  projectId: string,
  options: { target?: RevealTarget; assetId?: string } = {},
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Не удалось открыть папку'
    try {
      const err = JSON.parse(text) as { error?: string }
      message = err.error ?? message
    } catch {
      if (res.status === 404 && text.includes('Cannot POST')) {
        message = 'Эндпоинт reveal недоступен — перезапустите сервер (npm run dev)'
      }
    }
    throw new Error(message)
  }
}
