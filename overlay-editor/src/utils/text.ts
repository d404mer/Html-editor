import type { CanvasObject } from '../types/project'

/** Текст, который редактируется вручную (без Excel или fallback) */
export function getEditableText(object: CanvasObject): string {
  if (object.type !== 'text') return ''
  if (object.textBinding) return object.textBinding.fallback ?? ''
  return object.text ?? ''
}

export function canEditTextInline(object: CanvasObject): boolean {
  return object.type === 'text' && !object.locked
}
