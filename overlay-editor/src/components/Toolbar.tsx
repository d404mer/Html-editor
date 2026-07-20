import { useProjectStore } from '../store/projectStore'

const SYNC_LABELS = {
  idle: '',
  syncing: 'Сохранение…',
  synced: 'Сохранено',
  error: 'Ошибка синхронизации',
} as const

export default function Toolbar() {
  const project = useProjectStore((s) => s.project)
  const zoom = useProjectStore((s) => s.zoom)
  const showGrid = useProjectStore((s) => s.showGrid)
  const syncStatus = useProjectStore((s) => s.syncStatus)
  const setZoom = useProjectStore((s) => s.setZoom)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)
  const setLeftPanelTab = useProjectStore((s) => s.setLeftPanelTab)

  const openPreview = () => {
    if (project.id) {
      window.open(`/preview/${project.id}/`, '_blank')
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
        <span className="project-name">{project.name}</span>
        {syncStatus !== 'idle' && (
          <span className={`sync-status sync-${syncStatus}`}>
            {SYNC_LABELS[syncStatus]}
          </span>
        )}
      </div>

      <div className="toolbar-center">
        <button type="button" className="tool-btn" title="Текст">
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
            onClick={() => setZoom(0.5)}
            title="Сбросить масштаб"
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
