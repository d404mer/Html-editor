/** Нормализует путь из Excel относительно корня проекта. */
export function normalizeBindingPath(rawPath: string | undefined | null): string {
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  let path = trimmed.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path.includes('/')) {
    path = `assets/images/${path}`
  }
  return path
}

export function getProjectFileUrl(
  projectId: string,
  relPath: string,
  cacheBust?: number,
): string {
  const rel = normalizeBindingPath(relPath)
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return cacheBust != null ? `${rel}?t=${cacheBust}` : rel
  const base = `/preview/${projectId}/${rel}`
  return cacheBust != null ? `${base}?t=${cacheBust}` : base
}

export function resolveImageDisplayPath(
  resolvedValue: string | undefined,
  binding: { fallback?: string } | undefined,
  assetPath?: string,
): string {
  const fromExcel = normalizeBindingPath(resolvedValue)
  if (fromExcel) return fromExcel
  const fromFallback = normalizeBindingPath(binding?.fallback)
  if (fromFallback) return fromFallback
  if (assetPath) return assetPath.replace(/\\/g, '/')
  return ''
}
