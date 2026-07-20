import Toolbar from './components/Toolbar'
import Canvas from './canvas/Canvas'
import Layers from './panels/Layers'
import Inspector from './panels/Inspector'
import Assets from './panels/Assets'
import DataPanel from './panels/Data'
import { useProjectStore } from './store/projectStore'
import { useProjectInit, useProjectSync } from './hooks/useProjectSync'
import './App.css'

export default function App() {
  const leftPanelTab = useProjectStore((s) => s.leftPanelTab)
  const setLeftPanelTab = useProjectStore((s) => s.setLeftPanelTab)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)

  useProjectInit()
  useProjectSync()

  if (!projectLoaded) {
    return (
      <div className="editor loading-screen">
        <p>Загрузка проекта…</p>
      </div>
    )
  }

  return (
    <div className="editor">
      <Toolbar />

      <div className="editor-body">
        <aside className="sidebar sidebar-left">
          <div className="sidebar-tabs">
            <button
              type="button"
              className={`sidebar-tab${leftPanelTab === 'layers' ? ' active' : ''}`}
              onClick={() => setLeftPanelTab('layers')}
            >
              Слои
            </button>
            <button
              type="button"
              className={`sidebar-tab${leftPanelTab === 'assets' ? ' active' : ''}`}
              onClick={() => setLeftPanelTab('assets')}
            >
              Ресурсы
            </button>
            <button
              type="button"
              className={`sidebar-tab${leftPanelTab === 'data' ? ' active' : ''}`}
              onClick={() => setLeftPanelTab('data')}
            >
              Данные
            </button>
          </div>
          <div className="sidebar-content">
            {leftPanelTab === 'layers' && <Layers />}
            {leftPanelTab === 'assets' && <Assets />}
            {leftPanelTab === 'data' && <DataPanel />}
          </div>
        </aside>

        <main className="workspace">
          <Canvas />
        </main>

        <aside className="sidebar sidebar-right">
          <div className="sidebar-header">
            <span>Инспектор</span>
          </div>
          <div className="sidebar-content">
            <Inspector />
          </div>
        </aside>
      </div>
    </div>
  )
}
