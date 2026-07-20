import type { ImageFilters, ObjectStyle } from '../types/project'
import { DEFAULT_IMAGE_FILTERS } from '../types/project'

export function buildFilterCss(filters?: ImageFilters): string | undefined {
  const f = { ...DEFAULT_IMAGE_FILTERS, ...filters }
  const parts: string[] = []

  if (f.brightness !== 100) {
    parts.push(`brightness(${f.brightness / 100})`)
  }
  if (f.contrast !== 100) {
    parts.push(`contrast(${f.contrast / 100})`)
  }
  if (f.blur > 0) {
    parts.push(`blur(${f.blur}px)`)
  }

  return parts.length > 0 ? parts.join(' ') : undefined
}

export function getEffectiveFilter(style: ObjectStyle): string | undefined {
  const generated = buildFilterCss(style.filters)
  if (style.filter && generated) {
    return `${generated} ${style.filter}`.trim()
  }
  return style.filter ?? generated
}
