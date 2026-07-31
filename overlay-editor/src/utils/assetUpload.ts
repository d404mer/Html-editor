import type { Asset } from '../types/project'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
])

export async function uploadAsset(projectId: string, file: File): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/projects/${projectId}/assets`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.asset
}

export function isImageDropFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(name.slice(dot))
}

export function isMediaDropFile(file: File): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true
  return isImageDropFile(file)
}

export function filterImageDropFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter(isImageDropFile)
}
