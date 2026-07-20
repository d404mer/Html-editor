import { Group, Image as KonvaImage, Rect } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useImage } from '../hooks/useImage'
import { useProjectStore } from '../store/projectStore'
import type { CanvasObject } from '../types/project'
import { DEFAULT_CROP } from '../types/project'

interface ImageObjectProps {
  object: CanvasObject
  selected: boolean
  onSelect: (id: string, additive?: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

export default function ImageObjectNode({
  object,
  selected,
  onSelect,
  onDragEnd,
}: ImageObjectProps) {
  const getAssetUrl = useProjectStore((s) => s.getAssetUrl)
  const asset = useProjectStore((s) =>
    s.project.assets.find((a) => a.id === object.assetId),
  )

  const src = asset ? getAssetUrl(asset) : undefined
  const image = useImage(src)

  if (!object.visible || !asset) return null

  const crop = object.style.crop ?? DEFAULT_CROP
  const hasCrop =
    crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1

  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true
    onSelect(object.id, (e.evt as MouseEvent).shiftKey)
  }

  const imgNaturalW = image?.naturalWidth ?? object.width
  const imgNaturalH = image?.naturalHeight ?? object.height

  const cropX = crop.x * imgNaturalW
  const cropY = crop.y * imgNaturalH
  const cropW = crop.width * imgNaturalW
  const cropH = crop.height * imgNaturalH

  const scaleX = object.style.flipX ? -1 : 1
  const scaleY = object.style.flipY ? -1 : 1

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
      {!image && (
        <Rect
          width={object.width}
          height={object.height}
          fill="rgba(99,102,241,0.12)"
          stroke="#6366f1"
          strokeWidth={1}
          dash={[6, 4]}
          cornerRadius={object.style.borderRadius ?? 0}
        />
      )}

      {image && (
        <Group
          clipX={0}
          clipY={0}
          clipWidth={object.width}
          clipHeight={object.height}
        >
          <KonvaImage
            image={image}
            x={hasCrop ? -cropX * (object.width / cropW) : 0}
            y={hasCrop ? -cropY * (object.height / cropH) : 0}
            width={
              hasCrop ? imgNaturalW * (object.width / cropW) : object.width
            }
            height={
              hasCrop ? imgNaturalH * (object.height / cropH) : object.height
            }
            crop={
              hasCrop
                ? { x: cropX, y: cropY, width: cropW, height: cropH }
                : undefined
            }
            scaleX={scaleX}
            scaleY={scaleY}
            offsetX={object.style.flipX ? object.width : 0}
            offsetY={object.style.flipY ? object.height : 0}
            cornerRadius={object.style.borderRadius ?? 0}
          />
        </Group>
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

      {object.style.borderWidth ? (
        <Rect
          width={object.width}
          height={object.height}
          stroke={object.style.borderColor ?? '#ffffff'}
          strokeWidth={object.style.borderWidth}
          cornerRadius={object.style.borderRadius ?? 0}
          listening={false}
        />
      ) : null}
    </Group>
  )
}
