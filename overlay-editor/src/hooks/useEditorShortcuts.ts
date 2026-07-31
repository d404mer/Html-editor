import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useEditorShortcuts() {
  const editingTextId = useProjectStore((s) => s.editingTextId)
  const copySelectedObjects = useProjectStore((s) => s.copySelectedObjects)
  const pasteObjects = useProjectStore((s) => s.pasteObjects)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const deleteSelectedObjects = useProjectStore((s) => s.deleteSelectedObjects)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return
      if (isEditableTarget(e.target)) return

      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key === 'c') {
        e.preventDefault()
        copySelectedObjects()
        return
      }

      if (mod && e.key === 'v') {
        e.preventDefault()
        pasteObjects()
        return
      }

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelectedObjects()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    editingTextId,
    copySelectedObjects,
    pasteObjects,
    undo,
    redo,
    deleteSelectedObjects,
  ])
}
