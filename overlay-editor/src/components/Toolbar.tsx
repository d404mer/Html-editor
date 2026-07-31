import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { revealProjectFolder } from '../utils/projectFolders'

const SYNC_LABELS = {
  idle: '',
  syncing: 'Сохранение…',
  synced: 'Сохранено',
  error: 'Ошибка синхронизации',
} as const

export default function Toolbar() {
  const project = useProjectStore((s) => s.project)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const zoom = useProjectStore((s) => s.zoom)
  const showGrid = useProjectStore((s) => s.showGrid)
  const syncStatus = useProjectStore((s) => s.syncStatus)
  const setZoom = useProjectStore((s) => s.setZoom)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)
  const setLeftPanelTab = useProjectStore((s) => s.setLeftPanelTab)
  const addTextObject = useProjectStore((s) => s.addTextObject)
  const renameActiveProject = useProjectStore((s) => s.renameActiveProject)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => {
    const id = s.activeProjectId
    if (!id) return false
    return (s.openProjects[id]?.historyIndex ?? 0) > 0
  })
  const canRedo = useProjectStore((s) => {
    const id = s.activeProjectId
    const st = id ? s.openProjects[id] : null
    if (!st) return false
    return st.historyIndex < st.history.length - 1
  })
  const requestFitToView = useProjectStore((s) => s.requestFitToView)

  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)

  const openPreview = () => {
    if (activeProjectId) {
      window.open(`/preview/${activeProjectId}/`, '_blank')
    }
  }

  const commitRename = async () => {
    const next = renameValue.trim()
    setRenaming(false)
    if (!next || next === project.name) return
    try {
      await renameActiveProject(next)
    } catch {
      setRenameValue(project.name)
    }
  }

  const handleRevealProject = async () => {
    if (!activeProjectId) return
    try {
      await revealProjectFolder(activeProjectId, { target: 'project' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть папку')
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">Overlay Editor</span>
        </div>
        <div className="toolbar-divider" />
        {renaming ? (
          <input
            className="project-name-input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setRenameValue(project.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <span
            className="project-name project-name-editable"
            title="Двойной клик — переименовать"
            onDoubleClick={() => {
              setRenameValue(project.name)
              setRenaming(true)
            }}
          >
            {project.name}
          </span>
        )}
        {syncStatus !== 'idle' && (
          <span className={`sync-status sync-${syncStatus}`}>
            {SYNC_LABELS[syncStatus]}
          </span>
        )}
      </div>

      <div className="toolbar-center">
        <button
          type="button"
          className="tool-btn"
          title="Отменить (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
        >
          ↶
        </button>
        <button
          type="button"
          className="tool-btn"
          title="Повторить (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={redo}
        >
          ↷
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          className="tool-btn"
          title="Добавить текст"
          onClick={() => addTextObject()}
        >
          T
        </button>
        <button
          type="button"
          className="tool-btn"
          title="Изображение — загрузите в панели Ресурсы и перетащите на холст"
          onClick={() => setLeftPanelTab('assets')}
        >
          ▣
        </button>
        <button type="button" className="tool-btn" title="Видео" disabled>
          ▶
        </button>
        <button type="button" className="tool-btn" title="SVG" disabled>
          ◇
        </button>
      </div>

      <div className="toolbar-right">
        <button
          type="button"
          className="tool-btn"
          title="Открыть папку проекта"
          onClick={handleRevealProject}
        >
          📁
        </button>
        <button
          type="button"
          className={`tool-btn${showGrid ? ' active' : ''}`}
          title="Сетка"
          onClick={toggleGrid}
        >
          ⊞
        </button>
        <div className="zoom-controls">
          <button
            type="button"
            className="tool-btn"
            onClick={() => setZoom(zoom - 0.1)}
            title="Уменьшить"
          >
            −
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="tool-btn"
            onClick={() => setZoom(zoom + 0.1)}
            title="Увеличить"
          >
            +
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={requestFitToView}
            title="По размеру — вместить холст в окно"
          >
            ⊡
          </button>
        </div>
        <div className="toolbar-divider" />
        <button type="button" className="btn-secondary" onClick={openPreview}>
          Live Preview
        </button>
      </div>
    </header>
  )
}
