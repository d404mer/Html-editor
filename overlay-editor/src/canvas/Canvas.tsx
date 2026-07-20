import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import ImageObjectNode from '../objects/ImageObject'
import { useProjectStore } from '../store/projectStore'
import type { Asset, CanvasObject } from '../types/project'

const GRID_SIZE = 20
const ARTBOARD_PADDING = 80

function TextObjectNode({
  object,
  selected,
  onSelect,
  onDragEnd,
}: {
  object: CanvasObject
  selected: boolean
  onSelect: (id: string, additive?: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
}) {
  if (!object.visible) return null

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    onSelect(object.id, e.evt.shiftKey)
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
      draggable={!object.locked}
      onClick={handleClick}
      onTap={handleClick}
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
      {object.text && (
        <Text
          width={object.width}
          height={object.height}
          text={object.text}
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
      {selected && (
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

  const project = useProjectStore((s) => s.project)
  const zoom = useProjectStore((s) => s.zoom)
  const panX = useProjectStore((s) => s.panX)
  const panY = useProjectStore((s) => s.panY)
  const showGrid = useProjectStore((s) => s.showGrid)
  const selectedObjectIds = useProjectStore((s) => s.selectedObjectIds)
  const setZoom = useProjectStore((s) => s.setZoom)
  const setPan = useProjectStore((s) => s.setPan)
  const selectObject = useProjectStore((s) => s.selectObject)
  const clearSelection = useProjectStore((s) => s.clearSelection)
  const updateObject = useProjectStore((s) => s.updateObject)
  const addImageObject = useProjectStore((s) => s.addImageObject)

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
    const offsetX = (size.width - project.width * zoom) / 2
    const offsetY = (size.height - project.height * zoom) / 2
    setPan(offsetX, offsetY)
  }, [size.width, size.height, project.width, project.height, zoom, setPan])

  useEffect(() => {
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
  }, [selectedObjectIds, project.objects])

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const delta = e.evt.deltaY > 0 ? -0.05 : 0.05
      setZoom(zoom + delta)
    },
    [zoom, setZoom],
  )

  const handleStageClick = () => clearSelection()

  const handleDragEnd = (id: string, x: number, y: number) => {
    updateObject(id, { x: Math.round(x), y: Math.round(y) })
  }

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group
    const id = node.id()
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    node.scaleX(1)
    node.scaleY(1)

    updateObject(id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(20, Math.round(node.width() * scaleX)),
      height: Math.max(20, Math.round(node.height() * scaleY)),
      rotation: Math.round(node.rotation()),
    })
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const assetId = e.dataTransfer.getData('application/x-asset-id')
      if (!assetId) return

      const asset = project.assets.find((a) => a.id === assetId)
      if (!asset || (asset.type !== 'image' && asset.type !== 'gif')) return

      const pos = canvasToArtboard(e.clientX, e.clientY)
      addImageObject(asset, pos)
    },
    [project.assets, canvasToArtboard, addImageObject],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const sortedObjects = [...project.objects].sort(
    (a, b) => a.zIndex - b.zIndex,
  )

  const selectedObject = project.objects.find(
    (o) => o.id === selectedObjectIds[0],
  )

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onClick={handleStageClick}
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
                  selected={selectedObjectIds.includes(obj.id)}
                  onSelect={selectObject}
                  onDragEnd={handleDragEnd}
                />
              )
            }
            if (obj.type === 'image' || obj.type === 'gif') {
              return (
                <ImageObjectNode
                  key={obj.id}
                  object={obj}
                  selected={selectedObjectIds.includes(obj.id)}
                  onSelect={selectObject}
                  onDragEnd={handleDragEnd}
                />
              )
            }
            return null
          })}

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
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>

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
      </div>
    </div>
  )
}
