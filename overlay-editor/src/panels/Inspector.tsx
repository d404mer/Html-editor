import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { CanvasObject, ExcelBinding, ObjectFit } from '../types/project'
import { DEFAULT_CROP, DEFAULT_IMAGE_FILTERS } from '../types/project'
import { useExcelSchema, defaultBinding, defaultImageBinding } from '../hooks/useExcelSchema'
import {
  useExcelValues,
  getObjectDisplayText,
  getObjectDisplayImagePath,
} from '../hooks/useExcelValues'
import { cellRef } from '../utils/excel'
import type { SheetSchema } from '../hooks/useExcelSchema'

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className="field-input"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        className="field-input"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        className="field-input field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="field field-toggle">
      <span className="field-label">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
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

function ExcelPreviewTable({
  sheet,
  binding,
  onPickColumn,
  onPickCell,
}: {
  sheet: SheetSchema
  binding: ExcelBinding
  onPickColumn: (column: string) => void
  onPickCell: (cell: string, column: string, row: number) => void
}) {
  if (!sheet.headers.length) return null

  return (
    <div className="excel-preview-wrap">
      <span className="field-label">Выбор поля — клик по ячейке</span>
      <div className="excel-preview-scroll">
        <table className="excel-preview-table">
          <thead>
            <tr>
              <th className="excel-row-num">#</th>
              {sheet.headers.map((h) => (
                <th
                  key={h}
                  className={
                    binding.mode === 'column' && binding.column === h
                      ? 'excel-cell-active'
                      : ''
                  }
                  onClick={() => onPickColumn(h)}
                  title={`Столбец «${h}»`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.sampleRows.map((row, rowIdx) => {
              const sheetRow = rowIdx + 2
              return (
                <tr key={sheetRow}>
                  <td className="excel-row-num">{sheetRow}</td>
                  {row.map((cell, colIdx) => {
                    const header = sheet.headers[colIdx] ?? ''
                    const ref = cellRef(colIdx, sheetRow)
                    const isActive =
                      (binding.mode === 'cell' && binding.cell === ref) ||
                      (binding.mode === 'column' &&
                        binding.column === header &&
                        binding.row === sheetRow)
                    return (
                      <td
                        key={`${sheetRow}-${colIdx}`}
                        className={isActive ? 'excel-cell-active' : ''}
                        onClick={() => onPickCell(ref, header, sheetRow)}
                        title={ref}
                      >
                        {cell || '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExcelBindingPanel({
  object,
  binding,
  setBinding,
  previewValue,
  previewLabel,
  fallbackLabel,
  fallbackPlaceholder,
}: {
  object: CanvasObject
  binding: ExcelBinding | undefined
  setBinding: (binding: ExcelBinding | undefined) => void
  previewValue: string
  previewLabel: string
  fallbackLabel: string
  fallbackPlaceholder: string
}) {
  const project = useProjectStore((s) => s.project)
  const setLeftPanelTab = useProjectStore((s) => s.setLeftPanelTab)
  const dataFiles = project.dataFiles ?? []
  const { schema, loading } = useExcelSchema(binding?.fileId)
  const currentSheet = schema?.sheets.find((s) => s.name === binding?.sheet)

  useEffect(() => {
    if (!binding || !schema || binding.sheet) return
    const first = schema.sheets[0]?.name
    if (first) setBinding({ ...binding, sheet: first })
  }, [binding, schema, setBinding])

  useEffect(() => {
    if (!binding || !currentSheet || binding.mode !== 'column') return
    if (binding.column || !currentSheet.headers.length) return
    setBinding({
      ...binding,
      column: currentSheet.headers[0],
    })
  }, [binding, currentSheet, setBinding])

  const updateBinding = (patch: Partial<ExcelBinding>) => {
    if (!binding) return
    setBinding({ ...binding, ...patch })
  }

  const enableBinding = () => {
    const file = dataFiles[0]
    if (!file) {
      setLeftPanelTab('data')
      return
    }
    const asset = project.assets.find((a) => a.id === object.assetId)
    const fallback =
      object.type === 'text'
        ? '—'
        : asset?.path.replace(/\\/g, '/') ?? ''
    const next =
      object.type === 'text'
        ? defaultBinding(file.id, '')
        : defaultImageBinding(file.id, '', fallback)
    setBinding(next)
  }

  return (
    <Section title="Excel">
      <ToggleField
        label="Привязка к Excel"
        checked={!!binding}
        onChange={(enabled) => {
          if (enabled) enableBinding()
          else setBinding(undefined)
        }}
      />

      {!binding && dataFiles.length === 0 && (
        <span className="field-hint">
          Добавьте Excel в панели «Данные» или положите файл в папку data проекта
        </span>
      )}

      {binding && (
        <>
          <SelectField
            label="Файл"
            value={binding.fileId}
            options={[
              { value: '', label: '— выберите —' },
              ...dataFiles.map((f) => ({ value: f.id, label: f.name })),
            ]}
            onChange={(fileId) => {
              const file = dataFiles.find((f) => f.id === fileId)
              if (file) {
                const asset = project.assets.find((a) => a.id === object.assetId)
                const fallback =
                  object.type === 'text'
                    ? binding.fallback ?? '—'
                    : asset?.path.replace(/\\/g, '/') ?? binding.fallback ?? ''
                setBinding(
                  object.type === 'text'
                    ? defaultBinding(file.id, '', fallback)
                    : defaultImageBinding(file.id, '', fallback),
                )
              }
            }}
          />

          {loading && <span className="field-hint">Загрузка схемы…</span>}

          {schema && (
            <SelectField
              label="Лист"
              value={binding.sheet}
              options={[
                { value: '', label: '— выберите —' },
                ...schema.sheets.map((s) => ({ value: s.name, label: s.name })),
              ]}
              onChange={(sheet) => updateBinding({ sheet })}
            />
          )}

          <SelectField
            label="Режим"
            value={binding.mode}
            options={[
              { value: 'column', label: 'Поле (столбец)' },
              { value: 'cell', label: 'Ячейка' },
            ]}
            onChange={(mode) =>
              updateBinding({
                mode: mode as ExcelBinding['mode'],
              })
            }
          />

          {binding.mode === 'cell' ? (
            <TextField
              label="Ячейка"
              value={binding.cell ?? 'A1'}
              onChange={(cell) => updateBinding({ cell: cell.toUpperCase() })}
            />
          ) : (
            <>
              <SelectField
                label="Столбец"
                value={binding.column ?? ''}
                options={[
                  { value: '', label: '— выберите —' },
                  ...(currentSheet?.headers ?? []).map((h) => ({
                    value: h,
                    label: h,
                  })),
                ]}
                onChange={(column) => updateBinding({ column })}
              />
              <NumberField
                label="Строка"
                value={binding.row ?? 2}
                min={2}
                max={currentSheet ? currentSheet.rowCount + 1 : 9999}
                onChange={(row) => updateBinding({ row })}
              />
              <span className="field-hint">Строка 1 — заголовки столбцов</span>
            </>
          )}

          <TextField
            label={fallbackLabel}
            value={binding.fallback ?? ''}
            placeholder={fallbackPlaceholder}
            onChange={(fallback) => updateBinding({ fallback })}
          />

          <label className="field">
            <span className="field-label">{previewLabel}</span>
            <input
              type="text"
              className="field-input"
              value={previewValue}
              readOnly
            />
          </label>

          {object.type !== 'text' && (
            <span className="field-hint">
              В Excel укажите путь относительно проекта, например{' '}
              <code className="inline-code">assets/images/logo.png</code> или только{' '}
              <code className="inline-code">logo.png</code>
            </span>
          )}

          {currentSheet && (
            <ExcelPreviewTable
              sheet={currentSheet}
              binding={binding}
              onPickColumn={(column) =>
                updateBinding({ mode: 'column', column, row: binding.row ?? 2 })
              }
              onPickCell={(cell, column, row) => {
                if (binding.mode === 'cell') {
                  updateBinding({ mode: 'cell', cell, column, row })
                } else {
                  updateBinding({ mode: 'column', column, row })
                }
              }}
            />
          )}
        </>
      )}
    </Section>
  )
}

function ExcelBindingInspector({ object }: { object: CanvasObject }) {
  const setTextBinding = useProjectStore((s) => s.setTextBinding)
  const excelValues = useExcelValues()
  const preview = getObjectDisplayText(object, excelValues)

  return (
    <ExcelBindingPanel
      object={object}
      binding={object.textBinding}
      setBinding={(binding) => setTextBinding(object.id, binding)}
      previewValue={preview}
      previewLabel="Текущее значение (из Excel)"
      fallbackLabel="Fallback"
      fallbackPlaceholder="—"
    />
  )
}

function ImageExcelBindingInspector({ object }: { object: CanvasObject }) {
  const project = useProjectStore((s) => s.project)
  const setImageBinding = useProjectStore((s) => s.setImageBinding)
  const excelValues = useExcelValues()
  const asset = project.assets.find((a) => a.id === object.assetId)
  const preview = getObjectDisplayImagePath(object, excelValues, asset?.path)

  return (
    <ExcelBindingPanel
      object={object}
      binding={object.imageBinding}
      setBinding={(binding) => setImageBinding(object.id, binding)}
      previewValue={preview}
      previewLabel="Текущий путь (из Excel)"
      fallbackLabel="Fallback (путь к файлу)"
      fallbackPlaceholder="assets/images/logo.png"
    />
  )
}

function ImageInspector({ object }: { object: CanvasObject }) {
  const project = useProjectStore((s) => s.project)
  const updateObject = useProjectStore((s) => s.updateObject)
  const updateObjectStyle = useProjectStore((s) => s.updateObjectStyle)
  const replaceObjectAsset = useProjectStore((s) => s.replaceObjectAsset)
  const setProject = useProjectStore((s) => s.setProject)

  const filters = { ...DEFAULT_IMAGE_FILTERS, ...object.style.filters }
  const crop = { ...DEFAULT_CROP, ...object.style.crop }

  const patch = (data: Partial<CanvasObject>) => updateObject(object.id, data)
  const patchStyle = (key: string, value: unknown) =>
    updateObjectStyle(object.id, { [key]: value })

  const patchFilter = (key: keyof typeof DEFAULT_IMAGE_FILTERS, value: number) =>
    updateObjectStyle(object.id, {
      filters: { ...filters, [key]: value },
    })

  const patchCrop = (key: keyof typeof DEFAULT_CROP, value: number) =>
    updateObjectStyle(object.id, {
      crop: { ...crop, [key]: value },
    })

  const handleReplaceAsset = async (assetId: string) => {
    const asset = project.assets.find((a) => a.id === assetId)
    if (asset) replaceObjectAsset(object.id, asset)
  }

  const handleUploadReplace = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(
      `/api/projects/${project.id}/assets/${object.assetId}/replace`,
      { method: 'POST', body: form },
    )
    if (res.ok) setProject(await res.json())
  }

  return (
    <>
      <Section title="Изображение">
        <SelectField
          label="Ресурс"
          value={object.assetId ?? ''}
          options={[
            { value: '', label: '— не выбран —' },
            ...project.assets
              .filter((a) => a.type === 'image' || a.type === 'gif')
              .map((a) => ({ value: a.id, label: a.name })),
          ]}
          onChange={handleReplaceAsset}
        />
        <button
          type="button"
          className="btn-secondary inspector-btn"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = () => {
              const file = input.files?.[0]
              if (file && object.assetId) handleUploadReplace(file)
            }
            input.click()
          }}
        >
          Заменить файл
        </button>
        <ToggleField
          label="Сохранять пропорции"
          checked={object.lockAspectRatio ?? true}
          onChange={(lockAspectRatio) => patch({ lockAspectRatio })}
        />
        <SelectField
          label="Object Fit"
          value={object.style.objectFit ?? 'cover'}
          options={[
            { value: 'fill', label: 'fill' },
            { value: 'contain', label: 'contain' },
            { value: 'cover', label: 'cover' },
            { value: 'none', label: 'none' },
            { value: 'scale-down', label: 'scale-down' },
          ]}
          onChange={(v) => patchStyle('objectFit', v as ObjectFit)}
        />
        <TextField
          label="Object Position"
          value={object.style.objectPosition ?? 'center'}
          onChange={(v) => patchStyle('objectPosition', v)}
        />
      </Section>

      <Section title="Обрезка (Crop)">
        <div className="field-row">
          <NumberField
            label="X %"
            value={crop.x * 100}
            min={0}
            max={100}
            onChange={(v) => patchCrop('x', v / 100)}
          />
          <NumberField
            label="Y %"
            value={crop.y * 100}
            min={0}
            max={100}
            onChange={(v) => patchCrop('y', v / 100)}
          />
        </div>
        <div className="field-row">
          <NumberField
            label="W %"
            value={crop.width * 100}
            min={1}
            max={100}
            onChange={(v) => patchCrop('width', v / 100)}
          />
          <NumberField
            label="H %"
            value={crop.height * 100}
            min={1}
            max={100}
            onChange={(v) => patchCrop('height', v / 100)}
          />
        </div>
        <button
          type="button"
          className="btn-secondary inspector-btn"
          onClick={() => patchStyle('crop', { ...DEFAULT_CROP })}
        >
          Сбросить crop
        </button>
      </Section>

      <Section title="Flip">
        <div className="field-row">
          <ToggleField
            label="Flip X"
            checked={!!object.style.flipX}
            onChange={(flipX) => patchStyle('flipX', flipX)}
          />
          <ToggleField
            label="Flip Y"
            checked={!!object.style.flipY}
            onChange={(flipY) => patchStyle('flipY', flipY)}
          />
        </div>
      </Section>

      <Section title="Фильтры">
        <NumberField
          label="Brightness %"
          value={filters.brightness}
          min={0}
          max={300}
          onChange={(v) => patchFilter('brightness', v)}
        />
        <NumberField
          label="Contrast %"
          value={filters.contrast}
          min={0}
          max={300}
          onChange={(v) => patchFilter('contrast', v)}
        />
        <NumberField
          label="Blur px"
          value={filters.blur}
          min={0}
          max={50}
          onChange={(v) => patchFilter('blur', v)}
        />
      </Section>

      <ImageExcelBindingInspector object={object} />
    </>
  )
}

function ObjectInspector({ object }: { object: CanvasObject }) {
  const updateObject = useProjectStore((s) => s.updateObject)
  const updateObjectStyle = useProjectStore((s) => s.updateObjectStyle)
  const setEditingTextId = useProjectStore((s) => s.setEditingTextId)

  const patch = (data: Partial<CanvasObject>) => updateObject(object.id, data)
  const patchStyle = (key: string, value: string | number | boolean) =>
    updateObjectStyle(object.id, { [key]: value })

  const isImage = object.type === 'image' || object.type === 'gif'

  return (
    <>
      <Section title="Объект">
        <TextField
          label="Имя"
          value={object.name}
          onChange={(name) => patch({ name })}
        />
        <TextField label="Тип" value={object.type} readOnly />
      </Section>

      <Section title="Позиция">
        <div className="field-row">
          <NumberField label="Left" value={object.x} onChange={(x) => patch({ x })} />
          <NumberField label="Top" value={object.y} onChange={(y) => patch({ y })} />
        </div>
        <div className="field-row">
          <NumberField
            label="Width"
            value={object.width}
            min={1}
            onChange={(width) => patch({ width })}
          />
          <NumberField
            label="Height"
            value={object.height}
            min={1}
            onChange={(height) => patch({ height })}
          />
        </div>
        <NumberField
          label="Z-Index"
          value={object.zIndex}
          onChange={(zIndex) => patch({ zIndex })}
        />
      </Section>

      <Section title="Transform">
        <NumberField
          label="Rotation °"
          value={object.rotation}
          onChange={(rotation) => patch({ rotation })}
        />
        <NumberField
          label="Opacity %"
          value={(object.style.opacity ?? 1) * 100}
          min={0}
          max={100}
          onChange={(v) => patchStyle('opacity', v / 100)}
        />
      </Section>

      {object.type === 'text' && (
        <>
          <Section title="Текст">
            {object.textBinding ? (
              <>
                <TextField
                  label="Fallback (если Excel пуст)"
                  value={object.textBinding.fallback ?? ''}
                  onChange={(fallback) =>
                    patch({
                      textBinding: { ...object.textBinding!, fallback },
                    })
                  }
                />
                <span className="field-hint">
                  На холсте показывается значение из Excel. Двойной клик редактирует fallback.
                </span>
              </>
            ) : (
              <TextField
                label="Содержимое"
                value={object.text ?? ''}
                onChange={(text) => patch({ text })}
              />
            )}
            <button
              type="button"
              className="btn-secondary inspector-btn"
              onClick={() => setEditingTextId(object.id)}
            >
              Редактировать на холсте
            </button>
            <NumberField
              label="Font Size"
              value={object.style.fontSize ?? 16}
              min={1}
              onChange={(fontSize) => patchStyle('fontSize', fontSize)}
            />
            <ColorField
              label="Color"
              value={object.style.color ?? '#ffffff'}
              onChange={(color) => patchStyle('color', color)}
            />
            <TextField
              label="Font Family"
              value={object.style.fontFamily ?? 'Inter, sans-serif'}
              onChange={(fontFamily) => patchStyle('fontFamily', fontFamily)}
            />
            <NumberField
              label="Font Weight"
              value={Number(object.style.fontWeight ?? 400)}
              min={100}
              max={900}
              step={100}
              onChange={(fontWeight) => patchStyle('fontWeight', fontWeight)}
            />
            <NumberField
              label="Line Height"
              value={object.style.lineHeight ?? 1.2}
              min={0.5}
              max={5}
              step={0.1}
              onChange={(lineHeight) => patchStyle('lineHeight', lineHeight)}
            />
            <SelectField
              label="Text Align"
              value={object.style.textAlign ?? 'left'}
              options={[
                { value: 'left', label: 'left' },
                { value: 'center', label: 'center' },
                { value: 'right', label: 'right' },
              ]}
              onChange={(v) => patchStyle('textAlign', v)}
            />
          </Section>
          <ExcelBindingInspector object={object} />
        </>
      )}

      {isImage && <ImageInspector object={object} />}

      <Section title="Background & Border">
        <ColorField
          label="Background"
          value={object.style.backgroundColor ?? '#00000000'}
          onChange={(backgroundColor) => patchStyle('backgroundColor', backgroundColor)}
        />
        <NumberField
          label="Border Radius"
          value={object.style.borderRadius ?? 0}
          min={0}
          onChange={(borderRadius) => patchStyle('borderRadius', borderRadius)}
        />
        <NumberField
          label="Border Width"
          value={object.style.borderWidth ?? 0}
          min={0}
          onChange={(borderWidth) => patchStyle('borderWidth', borderWidth)}
        />
        <ColorField
          label="Border Color"
          value={object.style.borderColor ?? '#ffffff'}
          onChange={(borderColor) => patchStyle('borderColor', borderColor)}
        />
        <TextField
          label="Box Shadow"
          value={object.style.boxShadow ?? ''}
          onChange={(boxShadow) => patchStyle('boxShadow', boxShadow)}
        />
      </Section>

      <Section title="Custom CSS">
        <textarea
          className="field-textarea css-editor"
          placeholder="opacity: 0.9;&#10;mix-blend-mode: screen;"
          value={object.customCss ?? ''}
          onChange={(e) => patch({ customCss: e.target.value })}
          rows={6}
        />
        <span className="field-hint">
          Свойства добавляются к сгенерированным CSS правилам элемента
        </span>
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

  return (
    <div className="inspector-content">
      <ObjectInspector object={selected} />
    </div>
  )
}
