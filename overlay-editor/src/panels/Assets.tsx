import { useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { Asset } from '../types/project'

const TYPE_LABELS: Record<string, string> = {
  image: 'IMG',
  gif: 'GIF',
  video: 'VID',
  svg: 'SVG',
}

async function uploadAsset(projectId: string, file: File): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/projects/${projectId}/assets`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.asset
}

export default function Assets() {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const addImageObject = useProjectStore((s) => s.addImageObject)
  const getAssetUrl = useProjectStore((s) => s.getAssetUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!project.id) return
      setUploading(true)
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            continue
          }
          const asset = await uploadAsset(project.id, file)
          const res = await fetch(`/api/projects/${project.id}`)
          if (res.ok) setProject(await res.json())
          else addImageObject(asset)
        }
      } finally {
        setUploading(false)
      }
    },
    [project.id, setProject, addImageObject],
  )

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Удалить «${asset.name}»?`)) return
    const res = await fetch(`/api/projects/${project.id}/assets/${asset.id}`, {
      method: 'DELETE',
    })
    if (res.ok) setProject(await res.json())
  }

  const handleReplace = async (asset: Asset, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(
      `/api/projects/${project.id}/assets/${asset.id}/replace`,
      { method: 'POST', body: form },
    )
    if (res.ok) setProject(await res.json())
  }

  const startRename = (asset: Asset) => {
    setRenamingId(asset.id)
    setRenameValue(asset.name)
  }

  const commitRename = async (asset: Asset) => {
    setRenamingId(null)
    if (renameValue.trim() && renameValue !== asset.name) {
      const res = await fetch(
        `/api/projects/${project.id}/assets/${asset.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: renameValue.trim() }),
        },
      )
      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
      }
    }
  }

  const onAssetDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('application/x-asset-id', asset.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files)
    }
  }

  if (!project.assets.length && !uploading) {
    return (
      <div
        className={`assets-dropzone panel-empty${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZoneDrop}
      >
        <p>Ресурсы проекта</p>
        <span>Перетащите изображения сюда или загрузите файл</span>
        <button
          type="button"
          className="btn-secondary assets-upload-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Загрузить файл
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>
    )
  }

  return (
    <div className="assets-panel">
      <div className="assets-toolbar">
        <button
          type="button"
          className="btn-secondary assets-upload-btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Загрузка…' : '+ Загрузить'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div
        className={`assets-grid${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZoneDrop}
      >
        {project.assets.map((asset) => (
          <div
            key={asset.id}
            className="asset-card"
            draggable
            onDragStart={(e) => onAssetDragStart(e, asset)}
            onDoubleClick={() => addImageObject(asset)}
            title="Перетащите на холст или дважды кликните"
          >
            <div className="asset-thumb">
              {asset.type === 'video' ? (
                <span className="asset-placeholder">▶</span>
              ) : (
                <img src={getAssetUrl(asset)} alt={asset.name} draggable={false} />
              )}
              <span className="asset-type-badge">{TYPE_LABELS[asset.type]}</span>
            </div>
            <div className="asset-meta">
              {renamingId === asset.id ? (
                <input
                  className="field-input asset-rename-input"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(asset)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(asset)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <span className="asset-name" onDoubleClick={() => startRename(asset)}>
                  {asset.name}
                </span>
              )}
              <div className="asset-actions">
                <button
                  type="button"
                  className="layer-action-btn"
                  title="Переименовать"
                  onClick={() => startRename(asset)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="layer-action-btn"
                  title="Заменить файл"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*,video/*'
                    input.onchange = () => {
                      const file = input.files?.[0]
                      if (file) handleReplace(asset, file)
                    }
                    input.click()
                  }}
                >
                  ↻
                </button>
                <button
                  type="button"
                  className="layer-action-btn"
                  title="Удалить"
                  onClick={() => handleDelete(asset)}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
