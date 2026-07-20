/** Нормализует путь из Excel относительно корня проекта. */
export function normalizeBindingPath(rawPath) {
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  let path = trimmed.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path.includes('/')) {
    path = `assets/images/${path}`
  }
  return path
}

/**
 * @param {string | undefined} resolvedValue
 * @param {{ fallback?: string } | undefined} binding
 * @param {string | undefined} assetPath
 */
export function resolveImageDisplayPath(resolvedValue, binding, assetPath) {
  const fromExcel = normalizeBindingPath(resolvedValue)
  if (fromExcel) return fromExcel
  const fromFallback = normalizeBindingPath(binding?.fallback)
  if (fromFallback) return fromFallback
  if (assetPath) return assetPath.replace(/\\/g, '/')
  return ''
}
