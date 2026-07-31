import type { Asset } from '../types/project'

export const LOCAL_MEDIA_PREFIX = 'local-media:'

const MEDIA_PREFIXES = ['assets/images/', 'assets/videos/', 'assets/svg/', 'data/']

function basenameOf(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? ''
}

export function formatLocalMediaRef(absPath: string): string {
  const normalized = absPath.trim().replace(/\\/g, '/')
  return `${LOCAL_MEDIA_PREFIX}${normalized}`
}

export function parseLocalMediaRef(ref: string): string | null {
  if (!ref.startsWith(LOCAL_MEDIA_PREFIX)) return null
  return ref.slice(LOCAL_MEDIA_PREFIX.length)
}

export function isAbsoluteLocalPath(rawPath: string): boolean {
  const trimmed = rawPath.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return false
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return true
  if (trimmed.startsWith('\\\\')) return true
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true
  return false
}

function stripToRelative(raw: string, projectId: string): string {
  let p = raw.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
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

function findAssetRelPath(assets: Asset[] | undefined, filename: string): string {
  if (!filename || !assets?.length) return ''
  const lower = filename.toLowerCase()
  for (const asset of assets) {
    const rel = asset.path.replace(/\\/g, '/')
    const name = asset.name ?? basenameOf(rel)
    if (name.toLowerCase() === lower || basenameOf(rel).toLowerCase() === lower) {
      return rel
    }
  }
  return ''
}

function resolveExistingRelPathClient(
  relPath: string,
  assets: Asset[] | undefined,
): string {
  if (!relPath) return ''
  if (/^https?:\/\//i.test(relPath)) return relPath
  if (isAbsoluteLocalPath(relPath)) return ''

  const normalized = relPath.replace(/\\/g, '/')

  if (!normalized.includes('/')) {
    return `assets/images/${normalized}`
  }

  const fromAsset = findAssetRelPath(assets, basenameOf(normalized))
  if (fromAsset) return fromAsset

  return normalized
}

export interface MediaPathContext {
  projectId: string
  assets?: Asset[]
}

export function resolveProjectMediaPath(
  rawPath: string | undefined | null,
  ctx: MediaPathContext,
): string {
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith(LOCAL_MEDIA_PREFIX)) return trimmed

  const rel = stripToRelative(trimmed, ctx.projectId)
  if (rel && !isAbsoluteLocalPath(rel)) {
    const resolved = resolveExistingRelPathClient(rel, ctx.assets)
    if (resolved) return resolved
  }

  if (isAbsoluteLocalPath(trimmed)) {
    return formatLocalMediaRef(trimmed)
  }

  return ''
}

/** @deprecated */
export function normalizeBindingPath(
  rawPath: string | undefined | null,
  projectId?: string,
): string {
  if (projectId) {
    return (
      resolveProjectMediaPath(rawPath, { projectId }) ||
      stripToRelative(String(rawPath ?? ''), projectId)
    )
  }
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  let p = trimmed.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  if (!p.includes('/')) p = `assets/images/${p}`
  return p
}

export function encodeFilePath(relPath: string): string {
  return relPath
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

export function mediaRefToDisplaySrc(
  projectId: string,
  ref: string,
  options?: { cacheBust?: number; forPreviewHtml?: boolean },
): string {
  if (!ref) return ''
  if (/^https?:\/\//i.test(ref)) {
    return options?.cacheBust != null ? `${ref}?t=${options.cacheBust}` : ref
  }

  const local = parseLocalMediaRef(ref)
  if (local) {
    let url = `/api/projects/${projectId}/local-file?path=${encodeURIComponent(local)}`
    if (options?.cacheBust != null) url += `&t=${options.cacheBust}`
    return url
  }

  const rel = ref.replace(/\\/g, '/')
  if (options?.forPreviewHtml) {
    return options.cacheBust != null ? `${rel}?t=${options.cacheBust}` : rel
  }

  let url = `/api/projects/${projectId}/files/${encodeFilePath(rel)}`
  if (options?.cacheBust != null) url += `?t=${options.cacheBust}`
  return url
}

export function getProjectFileUrl(
  projectId: string,
  ref: string,
  cacheBust?: number,
): string {
  return mediaRefToDisplaySrc(projectId, ref, { cacheBust })
}

export function resolveImageDisplayPath(
  resolvedValue: string | undefined,
  binding: { fallback?: string } | undefined,
  assetPath: string | undefined,
  ctx: MediaPathContext,
): string {
  const fromExcel = resolveProjectMediaPath(resolvedValue, ctx)
  if (fromExcel) return fromExcel

  const fromFallback = resolveProjectMediaPath(binding?.fallback, ctx)
  if (fromFallback) return fromFallback

  if (assetPath) {
    const rel = assetPath.replace(/\\/g, '/')
    const resolved = resolveExistingRelPathClient(rel, ctx.assets)
    if (resolved) return resolved
    return resolveProjectMediaPath(assetPath, ctx) || rel
  }

  return ''
}
