import { useProjectStore } from '../store/projectStore'

const TYPE_ICONS: Record<string, string> = {
  text: 'T',
  image: '▣',
  video: '▶',
  svg: '◇',
  gif: '◈',
}

export default function Layers() {
  const objects = useProjectStore((s) => s.project.objects)
  const selectedObjectIds = useProjectStore((s) => s.selectedObjectIds)
  const selectObject = useProjectStore((s) => s.selectObject)
  const toggleObjectVisibility = useProjectStore((s) => s.toggleObjectVisibility)
  const toggleObjectLock = useProjectStore((s) => s.toggleObjectLock)
  const reorderObject = useProjectStore((s) => s.reorderObject)

  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex)

  if (sorted.length === 0) {
    return (
      <div className="panel-empty">
        <p>Нет объектов</p>
        <span>Добавьте элемент на холст</span>
      </div>
    )
  }

  return (
    <ul className="layers-list">
      {sorted.map((obj) => {
        const selected = selectedObjectIds.includes(obj.id)
        return (
          <li
            key={obj.id}
            className={`layer-item${selected ? ' selected' : ''}${!obj.visible ? ' hidden-layer' : ''}`}
            onClick={() => selectObject(obj.id)}
          >
            <span className="layer-type-icon">{TYPE_ICONS[obj.type] ?? '?'}</span>
            <span className="layer-name">{obj.name}</span>
            <div className="layer-actions">
              <button
                type="button"
                className="layer-action-btn"
                title={obj.visible ? 'Скрыть' : 'Показать'}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleObjectVisibility(obj.id)
                }}
              >
                {obj.visible ? '◉' : '○'}
              </button>
              <button
                type="button"
                className="layer-action-btn"
                title={obj.locked ? 'Разблокировать' : 'Заблокировать'}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleObjectLock(obj.id)
                }}
              >
                {obj.locked ? 'L' : 'l'}
              </button>
              <button
                type="button"
                className="layer-action-btn"
                title="Выше"
                onClick={(e) => {
                  e.stopPropagation()
                  reorderObject(obj.id, 'up')
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="layer-action-btn"
                title="Ниже"
                onClick={(e) => {
                  e.stopPropagation()
                  reorderObject(obj.id, 'down')
                }}
              >
                ↓
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
