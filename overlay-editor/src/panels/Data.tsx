import { useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { scanDataFiles, uploadDataFile } from '../hooks/useExcelSchema'

export default function DataPanel() {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [scanning, setScanning] = useState(false)

  const dataFiles = project.dataFiles ?? []

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!project.id) return
      setUploading(true)
      try {
        for (const file of Array.from(files)) {
          const lower = file.name.toLowerCase()
          if (
            !lower.endsWith('.xlsx') &&
            !lower.endsWith('.xls') &&
            !lower.endsWith('.csv')
          ) {
            continue
          }
          const { project: updated } = await uploadDataFile(project.id, file)
          setProject(updated)
        }
      } finally {
        setUploading(false)
      }
    },
    [project.id, setProject],
  )

  const handleScan = async () => {
    if (!project.id) return
    setScanning(true)
    try {
      const updated = await scanDataFiles(project.id)
      setProject(updated)
    } finally {
      setScanning(false)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('Удалить файл данных?')) return
    const res = await fetch(`/api/projects/${project.id}/data/${fileId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      const data = await res.json()
      setProject(data.project ?? data)
    }
  }

  return (
    <div className="data-panel">
      <div className="data-toolbar">
        <button
          type="button"
          className="btn-secondary assets-upload-btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Загрузка…' : '+ Excel'}
        </button>
        <button
          type="button"
          className="btn-secondary assets-upload-btn-sm"
          onClick={handleScan}
          disabled={scanning}
          title="Найти .xlsx/.csv в папке data проекта"
        >
          {scanning ? '…' : '↻ Скан'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          hidden
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
      </div>

      <p className="data-hint">
        Положите Excel в{' '}
        <code className="inline-code">projects/{project.id || '…'}/data/</code>{' '}
        и нажмите «Скан», или загрузите через кнопку выше.
      </p>

      <div
        className={`data-dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files)
        }}
      >
        {dataFiles.length === 0 ? (
          <span className="data-empty">Нет файлов данных</span>
        ) : (
          <ul className="data-file-list">
            {dataFiles.map((file) => (
              <li key={file.id} className="data-file-item">
                <span className="data-file-icon">📊</span>
                <div className="data-file-info">
                  <span className="data-file-name">{file.name}</span>
                  <span className="data-file-path">{file.path}</span>
                </div>
                <button
                  type="button"
                  className="layer-action-btn"
                  title="Удалить"
                  onClick={() => handleDelete(file.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
