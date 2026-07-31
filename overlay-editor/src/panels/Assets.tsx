import { useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { Asset } from '../types/project'
import { revealProjectFolder, scanAssets } from '../utils/projectFolders'
import { isMediaDropFile, uploadAsset } from '../utils/assetUpload'

const TYPE_LABELS: Record<string, string> = {
  image: 'IMG',
  gif: 'GIF',
  video: 'VID',
  svg: 'SVG',
}

type AssetFilter = 'all' | 'image' | 'video'

function matchesFilter(asset: Asset, filter: AssetFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'video') return asset.type === 'video'
  return asset.type === 'image' || asset.type === 'gif' || asset.type === 'svg'
}

export default function Assets() {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const addImageObject = useProjectStore((s) => s.addImageObject)
  const getAssetUrl = useProjectStore((s) => s.getAssetUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const filteredAssets = project.assets.filter((a) => matchesFilter(a, filter))

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!project.id) return
      setUploading(true)
      try {
        for (const file of Array.from(files)) {
          if (!isMediaDropFile(file)) continue
          await uploadAsset(project.id, file)
          const res = await fetch(`/api/projects/${project.id}`)
          if (res.ok) setProject(await res.json())
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
      const updated = await scanAssets(project.id)
      setProject(updated)
    } finally {
      setScanning(false)
    }
  }

  const handleRevealFolder = async () => {
    if (!project.id) return
    try {
      await revealProjectFolder(project.id, { target: 'assets' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть папку')
    }
  }

  const handleRevealAsset = async (assetId: string) => {
    if (!project.id) return
    try {
      await revealProjectFolder(project.id, { assetId })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть файл')
    }
  }

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

  const toolbar = (
    <div className="assets-toolbar data-toolbar">
      <button
        type="button"
        className="btn-secondary assets-upload-btn-sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Загрузка…' : '+ Загрузить'}
      </button>
      <button
        type="button"
        className="btn-secondary assets-upload-btn-sm"
        onClick={handleScan}
        disabled={scanning}
        title="Найти файлы в папке assets проекта"
      >
        {scanning ? '…' : '↻ Скан'}
      </button>
      <button
        type="button"
        className="btn-secondary assets-upload-btn-sm"
        onClick={handleRevealFolder}
        title="Открыть папку assets в проводнике"
      >
        📁 Папка
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

  const filterBar = (
    <div className="assets-filter-bar">
      {(
        [
          ['all', 'Все'],
          ['image', 'Изображения'],
          ['video', 'Видео'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`assets-filter-btn${filter === id ? ' active' : ''}`}
          onClick={() => setFilter(id)}
        >
          {label}
        </button>
      ))}
      <span className="assets-count">{project.assets.length} ресурсов</span>
    </div>
  )

  const hint = (
    <p className="data-hint assets-hint">
      Положите файлы в{' '}
      <code className="inline-code">projects/{project.id || '…'}/assets/</code>{' '}
      и нажмите «Скан», или загрузите через кнопку выше.
    </p>
  )

  if (!project.assets.length && !uploading) {
    return (
      <div className="assets-panel">
        {toolbar}
        {hint}
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
        </div>
      </div>
    )
  }

  return (
    <div className="assets-panel">
      {toolbar}
      {hint}
      {filterBar}

      <div
        className={`assets-grid${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZoneDrop}
      >
        {filteredAssets.length === 0 ? (
          <p className="assets-empty-filter">Нет ресурсов в этой категории</p>
        ) : (
          filteredAssets.map((asset) => (
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
                  <>
                    <span className="asset-name" onDoubleClick={() => startRename(asset)}>
                      {asset.name}
                    </span>
                    <span className="asset-path">{asset.path}</span>
                  </>
                )}
                <div className="asset-actions">
                  <button
                    type="button"
                    className="layer-action-btn"
                    title="Показать в проводнике"
                    onClick={() => handleRevealAsset(asset.id)}
                  >
                    📁
                  </button>
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
          ))
        )}
      </div>
    </div>
  )
}
