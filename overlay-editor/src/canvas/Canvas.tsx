import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import ImageObjectNode from '../objects/ImageObject'
import TextEditorOverlay, { useTextEditShortcuts } from './TextEditorOverlay'
import { useEditorShortcuts } from '../hooks/useEditorShortcuts'
import { filterImageDropFiles, uploadAsset } from '../utils/assetUpload'
import { useProjectStore } from '../store/projectStore'
import { useExcelValues, getObjectDisplayText, getObjectDisplayImagePath } from '../hooks/useExcelValues'
import { canEditTextInline } from '../utils/text'
import type { CanvasObject } from '../types/project'

const GRID_SIZE = 20
const ARTBOARD_PADDING = 80

function TextObjectNode({
  object,
  displayText,
  selected,
  isEditing,
  onSelect,
  onDragEnd,
  onDragStart,
  onStartEdit,
}: {
  object: CanvasObject
  displayText: string
  selected: boolean
  isEditing: boolean
  onSelect: (id: string, additive?: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onDragStart?: () => void
  onStartEdit: (id: string) => void
}) {
  if (!object.visible) return null

  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true
    onSelect(object.id, (e.evt as MouseEvent).shiftKey)
  }

  const handleDblClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true
    if (canEditTextInline(object)) onStartEdit(object.id)
  }

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.style.opacity ?? 1}
      draggable={!object.locked && !isEditing}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragStart={onDragStart}
      onDragEnd={(e) => onDragEnd(object.id, e.target.x(), e.target.y())}
    >
      {object.style.backgroundColor && (
        <Rect
          width={object.width}
          height={object.height}
          fill={object.style.backgroundColor}
          cornerRadius={object.style.borderRadius ?? 0}
          stroke={object.style.borderColor}
          strokeWidth={object.style.borderWidth ?? 0}
        />
      )}
      {!isEditing && (displayText || object.textBinding || object.text) && (
        <Text
          width={object.width}
          height={object.height}
          text={displayText || ' '}
          fontSize={object.style.fontSize ?? 16}
          fontFamily={object.style.fontFamily ?? 'Inter, sans-serif'}
          fontStyle={
            object.style.fontWeight && Number(object.style.fontWeight) >= 600
              ? 'bold'
              : 'normal'
          }
          fill={object.style.color ?? '#ffffff'}
          align={object.style.textAlign ?? 'left'}
          verticalAlign="middle"
        />
      )}
      {object.textBinding && !isEditing && (
        <Rect
          x={object.width - 20}
          y={2}
          width={18}
          height={14}
          fill="#22c55e"
          cornerRadius={3}
          listening={false}
        />
      )}
      {selected && !isEditing && (
        <Rect
          width={object.width}
          height={object.height}
          stroke="#6366f1"
          strokeWidth={2}
          dash={[4, 4]}
          listening={false}
        />
      )}
    </Group>
  )
}

function GridLines({ width, height }: { width: number; height: number }) {
  const lines: React.ReactElement[] = []

  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
        listening={false}
      />,
    )
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
        listening={false}
      />,
    )
  }

  return <>{lines}</>
}

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const spaceDownRef = useRef(false)
  const isPanningRef = useRef(false)
  const panSessionRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 })
  const editHistoryPushedRef = useRef(false)
  const [panMode, setPanMode] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [fileDragOver, setFileDragOver] = useState(false)
  const [dropping, setDropping] = useState(false)
  const dragDepthRef = useRef(0)

  const project = useProjectStore((s) => s.project)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const zoom = useProjectStore((s) => s.zoom)
  const panX = useProjectStore((s) => s.panX)
  const panY = useProjectStore((s) => s.panY)
  const showGrid = useProjectStore((s) => s.showGrid)
  const selectedObjectIds = useProjectStore((s) => s.selectedObjectIds)
  const editingTextId = useProjectStore((s) => s.editingTextId)
  const fitViewNonce = useProjectStore((s) =>
    activeProjectId ? (s.openProjects[activeProjectId]?.fitViewNonce ?? 0) : 0,
  )
  const userHasPanned = useProjectStore((s) =>
    activeProjectId ? (s.openProjects[activeProjectId]?.userHasPanned ?? false) : false,
  )
  const setZoom = useProjectStore((s) => s.setZoom)
  const setPan = useProjectStore((s) => s.setPan)
  const applyFitToView = useProjectStore((s) => s.applyFitToView)
  const pushHistory = useProjectStore((s) => s.pushHistory)
  const selectObject = useProjectStore((s) => s.selectObject)
  const clearSelection = useProjectStore((s) => s.clearSelection)
  const updateObject = useProjectStore((s) => s.updateObject)
  const addImageObject = useProjectStore((s) => s.addImageObject)
  const addAsset = useProjectStore((s) => s.addAsset)
  const setEditingTextId = useProjectStore((s) => s.setEditingTextId)

  const excelValues = useExcelValues()
  useTextEditShortcuts()
  useEditorShortcuts()

  const beginObjectEdit = useCallback(() => {
    if (!editHistoryPushedRef.current) {
      pushHistory()
      editHistoryPushedRef.current = true
    }
  }, [pushHistory])

  const endObjectEdit = useCallback(() => {
    editHistoryPushedRef.current = false
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    applyFitToView(size.width, size.height)
  }, [project.id, fitViewNonce, applyFitToView, size.width, size.height])

  useEffect(() => {
    if (userHasPanned) return
    applyFitToView(size.width, size.height)
  }, [size.width, size.height, userHasPanned, applyFitToView])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        spaceDownRef.current = true
        setPanMode(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        setPanMode(false)
        isPanningRef.current = false
        setIsPanning(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      const dx = e.clientX - panSessionRef.current.startX
      const dy = e.clientY - panSessionRef.current.startY
      setPan(
        panSessionRef.current.panX + dx,
        panSessionRef.current.panY + dy,
        { userInitiated: true },
      )
    }
    const onMouseUp = () => {
      isPanningRef.current = false
      setIsPanning(false)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setPan])

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      isPanningRef.current = true
      setIsPanning(true)
      panSessionRef.current = {
        startX: clientX,
        startY: clientY,
        panX,
        panY,
      }
    },
    [panX, panY],
  )

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      e.preventDefault()
      startPan(e.clientX, e.clientY)
    }
  }

  useEffect(() => {
    if (editingTextId) return
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage) return

    const nodes = selectedObjectIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Group => n != null)

    transformer.nodes(nodes)

    const firstSelected = project.objects.find(
      (o) => o.id === selectedObjectIds[0],
    )
    transformer.keepRatio(!!firstSelected?.lockAspectRatio)
    transformer.rotateEnabled(true)
    transformer.getLayer()?.batchDraw()
  }, [selectedObjectIds, project.objects, editingTextId])

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const delta = e.evt.deltaY > 0 ? -0.05 : 0.05
      setZoom(zoom + delta)
    },
    [zoom, setZoom],
  )

  const handleStageClick = () => {
    if (editingTextId || isPanningRef.current || spaceDownRef.current) return
    clearSelection()
  }

  const handleDragEnd = (id: string, x: number, y: number) => {
    updateObject(id, { x: Math.round(x), y: Math.round(y) }, { skipHistory: true })
    endObjectEdit()
  }

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group
    const id = node.id()
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    node.scaleX(1)
    node.scaleY(1)

    updateObject(
      id,
      {
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        width: Math.max(20, Math.round(node.width() * scaleX)),
        height: Math.max(20, Math.round(node.height() * scaleY)),
        rotation: Math.round(node.rotation()),
      },
      { skipHistory: true },
    )
    endObjectEdit()
  }

  const canvasToArtboard = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 100, y: 100 }
      const x = (clientX - rect.left - panX) / zoom
      const y = (clientY - rect.top - panY) / zoom
      return { x: Math.round(x), y: Math.round(y) }
    },
    [panX, panY, zoom],
  )

  const isDropPayload = (e: React.DragEvent) => {
    const types = e.dataTransfer.types
    return (
      types.includes('Files') ||
      types.includes('application/x-asset-id')
    )
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isDropPayload(e)) return
    dragDepthRef.current += 1
    setFileDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDropPayload(e)) return
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setFileDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (isDropPayload(e)) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setFileDragOver(false)
      dragDepthRef.current = 0

      const assetId = e.dataTransfer.getData('application/x-asset-id')
      if (assetId) {
        const asset = project.assets.find((a) => a.id === assetId)
        if (asset && (asset.type === 'image' || asset.type === 'gif')) {
          const pos = canvasToArtboard(e.clientX, e.clientY)
          addImageObject(asset, pos)
        }
        return
      }

      const files = filterImageDropFiles(e.dataTransfer.files)
      if (!files.length || !project.id || dropping) return

      setDropping(true)
      const base = canvasToArtboard(e.clientX, e.clientY)
      try {
        for (let i = 0; i < files.length; i++) {
          const asset = await uploadAsset(project.id, files[i])
          addAsset(asset)
          addImageObject(asset, {
            x: base.x + i * 24,
            y: base.y + i * 24,
          })
        }
      } catch (err) {
        console.error(err)
        alert('Не удалось загрузить изображение')
      } finally {
        setDropping(false)
      }
    },
    [project.assets, project.id, canvasToArtboard, addImageObject, addAsset, dropping],
  )

  const sortedObjects = [...project.objects].sort(
    (a, b) => a.zIndex - b.zIndex,
  )

  const selectedObject = project.objects.find(
    (o) => o.id === selectedObjectIds[0],
  )

  return (
    <div
      ref={containerRef}
      className={`canvas-container${panMode ? ' canvas-pan-mode' : ''}${isPanning ? ' canvas-panning' : ''}${fileDragOver ? ' canvas-file-drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onMouseDown={handleContainerMouseDown}
      onContextMenu={(e) => e.button === 1 && e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onClick={handleStageClick}
        style={{ pointerEvents: panMode ? 'none' : 'auto' }}
      >
        <Layer x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
          <Rect
            x={-ARTBOARD_PADDING}
            y={-ARTBOARD_PADDING}
            width={project.width + ARTBOARD_PADDING * 2}
            height={project.height + ARTBOARD_PADDING * 2}
            fill="#0d0d12"
            listening={false}
          />
          <Rect
            x={0}
            y={0}
            width={project.width}
            height={project.height}
            fill="#1a1a24"
            shadowColor="rgba(0,0,0,0.5)"
            shadowBlur={20}
            shadowOffset={{ x: 0, y: 4 }}
            listening={false}
          />
          {showGrid && <GridLines width={project.width} height={project.height} />}
        </Layer>

        <Layer x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
          {sortedObjects.map((obj) => {
            if (obj.type === 'text') {
              return (
                <TextObjectNode
                  key={obj.id}
                  object={obj}
                  displayText={getObjectDisplayText(obj, excelValues)}
                  selected={selectedObjectIds.includes(obj.id)}
                  isEditing={editingTextId === obj.id}
                  onSelect={selectObject}
                  onDragStart={beginObjectEdit}
                  onDragEnd={handleDragEnd}
                  onStartEdit={setEditingTextId}
                />
              )
            }
            if (obj.type === 'image' || obj.type === 'gif') {
              const asset = project.assets.find((a) => a.id === obj.assetId)
              return (
                <ImageObjectNode
                  key={obj.id}
                  object={obj}
                  displayImagePath={getObjectDisplayImagePath(
                    obj,
                    excelValues,
                    {
                      projectId: project.id,
                      assets: project.assets,
                      assetPath: asset?.path,
                    },
                  )}
                  selected={selectedObjectIds.includes(obj.id)}
                  onSelect={selectObject}
                  onDragStart={beginObjectEdit}
                  onDragEnd={handleDragEnd}
                />
              )
            }
            return null
          })}

          {!editingTextId && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox
                return newBox
              }}
              anchorStroke="#6366f1"
              anchorFill="#6366f1"
              borderStroke="#6366f1"
              rotateAnchorOffset={20}
              onTransformStart={beginObjectEdit}
              onTransformEnd={handleTransformEnd}
            />
          )}
        </Layer>
      </Stage>

      <TextEditorOverlay containerRef={containerRef} />

      <div className="canvas-info">
        <span>
          {project.width} × {project.height}
        </span>
        <span>{Math.round(zoom * 100)}%</span>
        {selectedObject && (
          <span>
            {Math.round(selectedObject.x)}, {Math.round(selectedObject.y)} ·{' '}
            {Math.round(selectedObject.width)} × {Math.round(selectedObject.height)}
          </span>
        )}
        {selectedObject?.type === 'text' && !editingTextId && (
          <span className="canvas-hint">Двойной клик / F2 — редактировать</span>
        )}
        <span className="canvas-hint">Space / СКМ — перемещение по холсту</span>
        <span className="canvas-hint">Перетащите изображение на холст</span>
        {dropping && <span className="canvas-hint">Загрузка…</span>}
      </div>
    </div>
  )
}
