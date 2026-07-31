import fs from 'node:fs'
import path from 'node:path'

export const LOCAL_MEDIA_PREFIX = 'local-media:'

const MEDIA_PREFIXES = ['assets/images/', 'assets/videos/', 'assets/svg/', 'data/']

function basenameOf(p) {
  return p.replace(/\\/g, '/').split('/').pop() ?? ''
}

export function formatLocalMediaRef(absPath) {
  const normalized = path.resolve(String(absPath).trim())
  return `${LOCAL_MEDIA_PREFIX}${normalized.replace(/\\/g, '/')}`
}

export function parseLocalMediaRef(ref) {
  if (!ref?.startsWith(LOCAL_MEDIA_PREFIX)) return null
  return ref.slice(LOCAL_MEDIA_PREFIX.length)
}

export function isAbsoluteLocalPath(rawPath) {
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return false
  return path.isAbsolute(path.normalize(trimmed))
}

function stripToRelative(raw, projectId) {
  let p = String(raw ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  if (!p) return ''

  if (/^https?:\/\//i.test(p)) return p

  const projectMarker = `projects/${projectId}/`
  const idx = p.toLowerCase().indexOf(projectMarker.toLowerCase())
  if (idx >= 0) {
    p = p.slice(idx + projectMarker.length)
  } else if (/^[a-zA-Z]:\//.test(p) || (p.startsWith('/') && !p.startsWith('//'))) {
    for (const prefix of MEDIA_PREFIXES) {
      const pos = p.toLowerCase().indexOf(prefix)
      if (pos >= 0) {
        p = p.slice(pos)
        break
      }
    }
  }

  return p.replace(/^\/+/, '')
}

function fileExistsAt(fullPath) {
  try {
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()
  } catch {
    return false
  }
}

function fileExists(projectDir, relPath) {
  if (!relPath || /^https?:\/\//i.test(relPath)) return false

  const localAbs = parseLocalMediaRef(relPath)
  if (localAbs) return fileExistsAt(path.resolve(localAbs))
  if (isAbsoluteLocalPath(relPath)) return fileExistsAt(path.resolve(relPath))
  if (!projectDir) return false

  try {
    const full = path.join(projectDir, relPath.replace(/\//g, path.sep))
    return fileExistsAt(full)
  } catch {
    return false
  }
}

function findAssetRelPath(assets, filename) {
  if (!filename || !assets?.length) return ''
  const lower = filename.toLowerCase()
  for (const asset of assets) {
    const rel = (asset.path ?? '').replace(/\\/g, '/')
    const name = asset.name ?? basenameOf(rel)
    if (name.toLowerCase() === lower || basenameOf(rel).toLowerCase() === lower) {
      return rel
    }
  }
  return ''
}

function resolveExistingRelPath(relPath, projectDir, assets) {
  if (!relPath) return ''
  if (/^https?:\/\//i.test(relPath)) return relPath
  if (isAbsoluteLocalPath(relPath)) return ''

  if (fileExists(projectDir, relPath)) return relPath.replace(/\\/g, '/')

  const filename = basenameOf(relPath)
  if (!relPath.includes('/')) {
    const candidates = [
      `assets/images/${filename}`,
      `assets/videos/${filename}`,
      `assets/svg/${filename}`,
      `data/${filename}`,
    ]
    for (const candidate of candidates) {
      if (fileExists(projectDir, candidate)) return candidate
    }
  }

  const fromAsset = findAssetRelPath(assets, filename)
  if (fromAsset && fileExists(projectDir, fromAsset)) return fromAsset.replace(/\\/g, '/')

  return ''
}

function resolveAbsoluteLocalFile(rawPath) {
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return ''

  const normalized = path.normalize(trimmed)
  if (!path.isAbsolute(normalized)) return ''

  const resolved = path.resolve(normalized)
  if (!fileExistsAt(resolved)) return ''

  return formatLocalMediaRef(resolved)
}

/**
 * @param {string | undefined | null} rawPath
 * @param {{ projectId: string, projectDir?: string, assets?: Array<{ name?: string, path?: string }> }} ctx
 */
export function resolveProjectMediaPath(rawPath, ctx) {
  const { projectId, projectDir = '', assets = [] } = ctx
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith(LOCAL_MEDIA_PREFIX)) {
    const abs = parseLocalMediaRef(trimmed)
    if (abs && fileExistsAt(path.resolve(abs))) return trimmed
  }

  const rel = stripToRelative(trimmed, projectId)
  if (rel && !isAbsoluteLocalPath(rel)) {
    const resolved = resolveExistingRelPath(rel, projectDir, assets)
    if (resolved) return resolved
  }

  return resolveAbsoluteLocalFile(trimmed)
}

export function encodeFilePath(relPath) {
  return relPath
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

/**
 * @param {string} projectId
 * @param {string} ref
 * @param {{ cacheBust?: number, forPreviewHtml?: boolean }} [options]
 */
export function mediaRefToDisplaySrc(projectId, ref, options = {}) {
  if (!ref) return ''
  if (/^https?:\/\//i.test(ref)) {
    return options.cacheBust != null ? `${ref}?t=${options.cacheBust}` : ref
  }

  const local = parseLocalMediaRef(ref)
  if (local) {
    let url = `/api/projects/${projectId}/local-file?path=${encodeURIComponent(local)}`
    if (options.cacheBust != null) url += `&t=${options.cacheBust}`
    return url
  }

  const rel = ref.replace(/\\/g, '/')
  if (options.forPreviewHtml) {
    return options.cacheBust != null ? `${rel}?t=${options.cacheBust}` : rel
  }

  let url = `/api/projects/${projectId}/files/${encodeFilePath(rel)}`
  if (options.cacheBust != null) url += `?t=${options.cacheBust}`
  return url
}

/** @deprecated use resolveProjectMediaPath */
export function normalizeBindingPath(rawPath, projectId) {
  if (!projectId) {
    const trimmed = String(rawPath ?? '').trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    let p = trimmed.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
    if (!p.includes('/')) p = `assets/images/${p}`
    return p
  }
  return resolveProjectMediaPath(rawPath, { projectId, projectDir: '', assets: [] })
}

export function resolveImageDisplayPath(resolvedValue, binding, assetPath, ctx) {
  const fromExcel = resolveProjectMediaPath(resolvedValue, ctx)
  if (fromExcel) return fromExcel

  const fromFallback = resolveProjectMediaPath(binding?.fallback, ctx)
  if (fromFallback) return fromFallback

  if (assetPath) {
    const rel = assetPath.replace(/\\/g, '/')
    const resolved = resolveExistingRelPath(rel, ctx.projectDir ?? '', ctx.assets ?? [])
    if (resolved) return resolved
    return resolveProjectMediaPath(assetPath, ctx) || rel
  }

  return ''
}

export { fileExists, fileExistsAt, stripToRelative }
