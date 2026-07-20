import Toolbar from './components/Toolbar'
import Canvas from './canvas/Canvas'
import Layers from './panels/Layers'
import Inspector from './panels/Inspector'
import Assets from './panels/Assets'
import { useProjectStore } from './store/projectStore'
import './App.css'

export default function App() {
  const leftPanelTab = useProjectStore((s) => s.leftPanelTab)
  const setLeftPanelTab = useProjectStore((s) => s.setLeftPanelTab)

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
          </div>
          <div className="sidebar-content">
            {leftPanelTab === 'layers' ? <Layers /> : <Assets />}
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
