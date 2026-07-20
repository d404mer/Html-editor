import { useEffect, useRef } from 'react'
import { useProjectStore } from '../store/projectStore'
import { getEditableText } from '../utils/text'

interface TextEditorOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export default function TextEditorOverlay({ containerRef }: TextEditorOverlayProps) {
  const editingTextId = useProjectStore((s) => s.editingTextId)
  const object = useProjectStore((s) =>
    s.project.objects.find((o) => o.id === editingTextId),
  )
  const zoom = useProjectStore((s) => s.zoom)
  const panX = useProjectStore((s) => s.panX)
  const panY = useProjectStore((s) => s.panY)
  const setEditingTextId = useProjectStore((s) => s.setEditingTextId)
  const updateTextContent = useProjectStore((s) => s.updateTextContent)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const valueRef = useRef('')

  useEffect(() => {
    if (!editingTextId || !object) return
    valueRef.current = getEditableText(object)
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editingTextId, object])

  if (!editingTextId || !object || object.type !== 'text') return null

  const container = containerRef.current
  if (!container) return null

  const rect = container.getBoundingClientRect()
  const left = rect.left + panX + object.x * zoom
  const top = rect.top + panY + object.y * zoom
  const width = object.width * zoom
  const height = object.height * zoom
  const fontSize = (object.style.fontSize ?? 16) * zoom
  const fontWeight = object.style.fontWeight ?? 400
  const textAlign = object.style.textAlign ?? 'left'
  const color = object.style.color ?? '#ffffff'
  const fontFamily = object.style.fontFamily ?? 'Inter, sans-serif'
  const lineHeight = object.style.lineHeight ?? 1.2

  const commit = () => {
    updateTextContent(object.id, valueRef.current)
    setEditingTextId(null)
  }

  const cancel = () => setEditingTextId(null)

  return (
    <textarea
      ref={textareaRef}
      className="canvas-text-editor"
      defaultValue={getEditableText(object)}
      style={{
        position: 'fixed',
        left,
        top,
        width,
        height,
        fontSize,
        fontWeight,
        fontFamily,
        color,
        textAlign,
        lineHeight,
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'top left',
      }}
      placeholder={object.textBinding ? 'Fallback-текст…' : 'Введите текст…'}
      onChange={(e) => {
        valueRef.current = e.target.value
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit()
        }
        e.stopPropagation()
      }}
    />
  )
}

export function useTextEditShortcuts() {
  const selectedObjectIds = useProjectStore((s) => s.selectedObjectIds)
  const objects = useProjectStore((s) => s.project.objects)
  const editingTextId = useProjectStore((s) => s.editingTextId)
  const setEditingTextId = useProjectStore((s) => s.setEditingTextId)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return
      if (selectedObjectIds.length !== 1) return

      const obj = objects.find((o) => o.id === selectedObjectIds[0])
      if (!obj || obj.type !== 'text' || obj.locked) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return
      }

      if (e.key === 'F2' || e.key === 'Enter') {
        e.preventDefault()
        setEditingTextId(obj.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedObjectIds, objects, editingTextId, setEditingTextId])
}

export function isTextBeingEdited(objectId: string, editingTextId: string | null): boolean {
  return editingTextId === objectId
}
