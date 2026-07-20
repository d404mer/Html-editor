import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useProjectStore } from '../store/projectStore'
import type { CanvasObject } from '../types/project'

const GRID_SIZE = 20
const ARTBOARD_PADDING = 80

function CanvasObjectNode({
  object,
  selected,
  onSelect,
}: {
  object: CanvasObject
  selected: boolean
  onSelect: (id: string) => void
}) {
  if (!object.visible) return null

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    onSelect(object.id)
  }

  if (object.type === 'text') {
    return (
      <Group key={object.id}>
        {object.style.backgroundColor && (
          <Rect
            x={object.x}
            y={object.y}
            width={object.width}
            height={object.height}
            fill={object.style.backgroundColor}
            cornerRadius={object.style.borderRadius ?? 0}
            stroke={object.style.borderColor}
            strokeWidth={object.style.borderWidth ?? 0}
            opacity={object.style.opacity ?? 1}
            rotation={object.rotation}
            onClick={handleClick}
          />
        )}
        {object.text && (
          <Text
            x={object.x}
            y={object.y}
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
            opacity={object.style.opacity ?? 1}
            rotation={object.rotation}
            onClick={handleClick}
          />
        )}
        {selected && (
          <Rect
            x={object.x - 2}
            y={object.y - 2}
            width={object.width + 4}
            height={object.height + 4}
            stroke="#6366f1"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
      </Group>
    )
  }

  return null
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

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const delta = e.evt.deltaY > 0 ? -0.05 : 0.05
      setZoom(zoom + delta)
    },
    [zoom, setZoom],
  )

  const handleStageClick = () => {
    clearSelection()
  }

  const sortedObjects = [...project.objects].sort(
    (a, b) => a.zIndex - b.zIndex,
  )

  return (
    <div ref={containerRef} className="canvas-container">
      <Stage
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
          {showGrid && (
            <Layer listening={false}>
              <GridLines width={project.width} height={project.height} />
            </Layer>
          )}
        </Layer>

        <Layer x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
          {sortedObjects.map((obj) => (
            <CanvasObjectNode
              key={obj.id}
              object={obj}
              selected={selectedObjectIds.includes(obj.id)}
              onSelect={selectObject}
            />
          ))}
        </Layer>
      </Stage>

      <div className="canvas-info">
        <span>
          {project.width} × {project.height}
        </span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
