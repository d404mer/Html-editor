import type { CanvasObject, ObjectStyle, Project } from '../types/project'
import { getEffectiveFilter } from './filters'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function styleToCss(style: ObjectStyle, object: CanvasObject): string {
  const lines: string[] = [
    '  position: absolute;',
    `  left: ${object.x}px;`,
    `  top: ${object.y}px;`,
    `  width: ${object.width}px;`,
    `  height: ${object.height}px;`,
    `  z-index: ${object.zIndex};`,
  ]

  const transforms: string[] = []
  if (object.rotation) transforms.push(`rotate(${object.rotation}deg)`)
  if (style.flipX) transforms.push('scaleX(-1)')
  if (style.flipY) transforms.push('scaleY(-1)')
  if (transforms.length) lines.push(`  transform: ${transforms.join(' ')};`)

  if (style.opacity !== undefined && style.opacity !== 1) {
    lines.push(`  opacity: ${style.opacity};`)
  }
  if (style.backgroundColor) lines.push(`  background-color: ${style.backgroundColor};`)
  if (style.color) lines.push(`  color: ${style.color};`)
  if (style.fontSize) lines.push(`  font-size: ${style.fontSize}px;`)
  if (style.fontFamily) lines.push(`  font-family: ${style.fontFamily};`)
  if (style.fontWeight) lines.push(`  font-weight: ${style.fontWeight};`)
  if (style.lineHeight) lines.push(`  line-height: ${style.lineHeight};`)
  if (style.textAlign) lines.push(`  text-align: ${style.textAlign};`)
  if (style.borderRadius) lines.push(`  border-radius: ${style.borderRadius}px;`)
  if (style.borderWidth) lines.push(`  border-width: ${style.borderWidth}px;`)
  if (style.borderColor) lines.push(`  border-color: ${style.borderColor};`)
  if (style.borderWidth) lines.push('  border-style: solid;')
  if (style.boxShadow) lines.push(`  box-shadow: ${style.boxShadow};`)

  const filter = getEffectiveFilter(style)
  if (filter) lines.push(`  filter: ${filter};`)

  if (object.type === 'image' || object.type === 'gif') {
    if (style.objectFit) lines.push(`  object-fit: ${style.objectFit};`)
    if (style.objectPosition) lines.push(`  object-position: ${style.objectPosition};`)
  }

  if (object.customCss) {
    object.customCss
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((rule) => lines.push(`  ${rule};`))
  }

  return lines.join('\n')
}

function cropWrapperCss(object: CanvasObject): string | null {
  const crop = object.style.crop
  if (!crop || (crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1)) {
    return null
  }
  return `.el-${object.id} {
  position: absolute;
  left: ${object.x}px;
  top: ${object.y}px;
  width: ${object.width}px;
  height: ${object.height}px;
  z-index: ${object.zIndex};
  overflow: hidden;
  border-radius: ${object.style.borderRadius ?? 0}px;
}`
}

function cropInnerCss(object: CanvasObject): string {
  const crop = object.style.crop ?? { x: 0, y: 0, width: 1, height: 1 }
  const scaleX = 1 / crop.width
  const scaleY = 1 / crop.height
  const left = -(crop.x * object.width * scaleX)
  const top = -(crop.y * object.height * scaleY)

  const transforms: string[] = []
  if (object.rotation) transforms.push(`rotate(${object.rotation}deg)`)
  if (object.style.flipX) transforms.push('scaleX(-1)')
  if (object.style.flipY) transforms.push('scaleY(-1)')

  const lines = [
    '  position: absolute;',
    `  left: ${left}px;`,
    `  top: ${top}px;`,
    `  width: ${object.width * scaleX}px;`,
    `  height: ${object.height * scaleY}px;`,
  ]
  if (transforms.length) lines.push(`  transform: ${transforms.join(' ')};`)
  if (object.style.opacity !== undefined && object.style.opacity !== 1) {
    lines.push(`  opacity: ${object.style.opacity};`)
  }
  const filter = getEffectiveFilter(object.style)
  if (filter) lines.push(`  filter: ${filter};`)
  if (object.style.objectFit) lines.push(`  object-fit: ${object.style.objectFit};`)
  if (object.style.objectPosition) lines.push(`  object-position: ${object.style.objectPosition};`)

  return lines.join('\n')
}

export function generateHtml(project: Project): string {
  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex)
  const elements: string[] = []

  for (const obj of sorted) {
    if (!obj.visible) continue

    if (obj.type === 'text') {
      elements.push(`    <div class="el-${obj.id}">${escapeHtml(obj.text ?? '')}</div>`)
      continue
    }

    if ((obj.type === 'image' || obj.type === 'gif') && obj.assetId) {
      const asset = project.assets.find((a) => a.id === obj.assetId)
      if (!asset) continue
      const src = asset.path.replace(/\\/g, '/')
      const hasCrop =
        obj.style.crop &&
        (obj.style.crop.x !== 0 ||
          obj.style.crop.y !== 0 ||
          obj.style.crop.width !== 1 ||
          obj.style.crop.height !== 1)

      if (hasCrop) {
        elements.push(
          `    <div class="el-${obj.id}-crop"><img class="el-${obj.id}-img" src="${src}" alt="${escapeHtml(obj.name)}" /></div>`,
        )
      } else {
        elements.push(
          `    <img class="el-${obj.id}" src="${src}" alt="${escapeHtml(obj.name)}" />`,
        )
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${project.width}, height=${project.height}" />
  <title>${escapeHtml(project.name)}</title>
  <link rel="stylesheet" href="styles.css" />
  <script src="/live-reload.js"></script>
</head>
<body>
  <div id="overlay">
${elements.join('\n')}
  </div>
</body>
</html>
`
}

export function generateCss(project: Project): string {
  const rules: string[] = [
    '* { margin: 0; padding: 0; box-sizing: border-box; }',
    'body { background: transparent; overflow: hidden; }',
    `#overlay {
  position: relative;
  width: ${project.width}px;
  height: ${project.height}px;
  overflow: hidden;
}`,
  ]

  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex)

  for (const obj of sorted) {
    if (!obj.visible) continue

    if (obj.type === 'text') {
      rules.push(`.el-${obj.id} {\n${styleToCss(obj.style, obj)}\n}`)
      continue
    }

    if ((obj.type === 'image' || obj.type === 'gif') && obj.assetId) {
      const hasCrop =
        obj.style.crop &&
        (obj.style.crop.x !== 0 ||
          obj.style.crop.y !== 0 ||
          obj.style.crop.width !== 1 ||
          obj.style.crop.height !== 1)

      if (hasCrop) {
        const wrapper = cropWrapperCss(obj)
        if (wrapper) rules.push(wrapper)
        rules.push(`.el-${obj.id}-img {\n${cropInnerCss(obj)}\n}`)
      } else {
        rules.push(`.el-${obj.id} {\n${styleToCss(obj.style, obj)}\n}`)
      }
    }
  }

  return `${rules.join('\n\n')}\n`
}
