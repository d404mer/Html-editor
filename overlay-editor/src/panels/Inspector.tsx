import { useProjectStore } from '../store/projectStore'
import type { CanvasObject } from '../types/project'

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className="field-input"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="field field-color">
      <span className="field-label">{label}</span>
      <div className="color-input-wrap">
        <input
          type="color"
          className="color-picker"
          value={value.startsWith('#') ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="inspector-section">
      <h3 className="inspector-section-title">{title}</h3>
      <div className="inspector-fields">{children}</div>
    </section>
  )
}

function ObjectInspector({ object }: { object: CanvasObject }) {
  const updateObject = useProjectStore((s) => s.updateObject)

  const patch = (data: Partial<CanvasObject>) => updateObject(object.id, data)
  const patchStyle = (key: string, value: string | number) =>
    updateObject(object.id, { style: { ...object.style, [key]: value } })

  return (
    <>
      <Section title="Объект">
        <TextField
          label="Имя"
          value={object.name}
          onChange={(name) => patch({ name })}
        />
        <label className="field">
          <span className="field-label">Тип</span>
          <input type="text" className="field-input" value={object.type} readOnly />
        </label>
      </Section>

      <Section title="Позиция">
        <div className="field-row">
          <NumberField label="X" value={object.x} onChange={(x) => patch({ x })} />
          <NumberField label="Y" value={object.y} onChange={(y) => patch({ y })} />
        </div>
        <div className="field-row">
          <NumberField
            label="W"
            value={object.width}
            onChange={(width) => patch({ width })}
          />
          <NumberField
            label="H"
            value={object.height}
            onChange={(height) => patch({ height })}
          />
        </div>
        <NumberField
          label="Z-Index"
          value={object.zIndex}
          onChange={(zIndex) => patch({ zIndex })}
        />
      </Section>

      <Section title="Трансформация">
        <NumberField
          label="Rotation"
          value={object.rotation}
          onChange={(rotation) => patch({ rotation })}
        />
      </Section>

      {object.type === 'text' && (
        <Section title="Текст">
          <TextField
            label="Содержимое"
            value={object.text ?? ''}
            onChange={(text) => patch({ text })}
          />
          <NumberField
            label="Размер"
            value={object.style.fontSize ?? 16}
            onChange={(fontSize) => patchStyle('fontSize', fontSize)}
          />
          <ColorField
            label="Цвет"
            value={object.style.color ?? '#ffffff'}
            onChange={(color) => patchStyle('color', color)}
          />
          <TextField
            label="Шрифт"
            value={object.style.fontFamily ?? 'Inter, sans-serif'}
            onChange={(fontFamily) => patchStyle('fontFamily', fontFamily)}
          />
        </Section>
      )}

      <Section title="Внешний вид">
        <NumberField
          label="Opacity"
          value={(object.style.opacity ?? 1) * 100}
          onChange={(v) => patchStyle('opacity', v / 100)}
        />
        {object.style.backgroundColor !== undefined && (
          <ColorField
            label="Фон"
            value={object.style.backgroundColor}
            onChange={(backgroundColor) => patchStyle('backgroundColor', backgroundColor)}
          />
        )}
        <NumberField
          label="Radius"
          value={object.style.borderRadius ?? 0}
          onChange={(borderRadius) => patchStyle('borderRadius', borderRadius)}
        />
      </Section>
    </>
  )
}

export default function Inspector() {
  const selectedObjectIds = useProjectStore((s) => s.selectedObjectIds)
  const objects = useProjectStore((s) => s.project.objects)

  const selected =
    selectedObjectIds.length === 1
      ? objects.find((o) => o.id === selectedObjectIds[0])
      : undefined

  if (!selected) {
    return (
      <div className="panel-empty">
        <p>Ничего не выбрано</p>
        <span>Выберите объект на холсте или в списке слоёв</span>
      </div>
    )
  }

  return <div className="inspector-content"><ObjectInspector object={selected} /></div>
}
