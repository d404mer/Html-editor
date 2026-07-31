import { useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../store/projectStore'

export default function ProjectTabs() {
  const tabOrder = useProjectStore((s) => s.tabOrder)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const openProjects = useProjectStore((s) => s.openProjects)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const closeProject = useProjectStore((s) => s.closeProject)
  const createProject = useProjectStore((s) => s.createProject)
  const importProject = useProjectStore((s) => s.importProject)

  const importInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleClose = useCallback(
    (projectId: string) => {
      const state = openProjects[projectId]
      if (
        state?.syncStatus === 'syncing' ||
        state?.syncStatus === 'error'
      ) {
        if (!confirm('Проект может содержать несохранённые изменения. Закрыть вкладку?')) {
          return
        }
      }
      closeProject(projectId)
    },
    [closeProject, openProjects],
  )

  const handleCreate = async () => {
    const name = prompt('Имя нового проекта', 'Untitled Project')
    if (name === null) return
    setBusy(true)
    try {
      await createProject(name.trim() || 'Untitled Project')
    } catch {
      alert('Не удалось создать проект')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File) => {
    setBusy(true)
    try {
      await importProject(file)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Импорт не удался')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-tabs-bar">
      <div className="project-tabs-scroll">
        {tabOrder.map((id) => {
          const entry = openProjects[id]
          if (!entry) return null
          const isActive = id === activeProjectId
          const unsaved = entry.syncStatus === 'syncing' || entry.syncStatus === 'error'
          return (
            <div
              key={id}
              className={`project-tab${isActive ? ' active' : ''}${unsaved ? ' unsaved' : ''}`}
            >
              <button
                type="button"
                className="project-tab-main"
                onClick={() => setActiveProject(id)}
                title={entry.project.name}
              >
                <span className="project-tab-name">{entry.project.name}</span>
                {unsaved && <span className="project-tab-dot" title="Не синхронизировано" />}
              </button>
              <button
                type="button"
                className="project-tab-close"
                onClick={() => handleClose(id)}
                title="Закрыть вкладку"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className="project-tabs-actions">
        <button
          type="button"
          className="project-tab-action"
          onClick={handleCreate}
          disabled={busy}
          title="Новый проект"
        >
          +
        </button>
        <button
          type="button"
          className="project-tab-action"
          onClick={() => importInputRef.current?.click()}
          disabled={busy}
          title="Импорт zip"
        >
          Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".zip"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImport(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
