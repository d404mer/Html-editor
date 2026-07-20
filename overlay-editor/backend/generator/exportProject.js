function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getDisplayTextForObject(obj, resolvedValues) {
  if (obj.type !== 'text') return obj.text ?? ''
  if (obj.textBinding) {
    return resolvedValues[obj.id] ?? obj.textBinding.fallback ?? obj.text ?? ''
  }
  return obj.text ?? ''
}

function getImageSrcForObject(obj, project, resolvedValues) {
  if (obj.type !== 'image' && obj.type !== 'gif') return ''
  const asset = project.assets.find((a) => a.id === obj.assetId)
  if (obj.imageBinding) {
    const resolved = resolvedValues[obj.id]
    if (resolved) return resolved.replace(/\\/g, '/')
    if (obj.imageBinding.fallback) return obj.imageBinding.fallback.replace(/\\/g, '/')
    if (asset) return asset.path.replace(/\\/g, '/')
    return ''
  }
  if (!asset) return ''
  return asset.path.replace(/\\/g, '/')
}

function buildFilterCss(filters) {
  if (!filters) return undefined
  const parts = []
  if (filters.brightness !== undefined && filters.brightness !== 100) {
    parts.push(`brightness(${filters.brightness / 100})`)
  }
  if (filters.contrast !== undefined && filters.contrast !== 100) {
    parts.push(`contrast(${filters.contrast / 100})`)
  }
  if (filters.blur !== undefined && filters.blur > 0) {
    parts.push(`blur(${filters.blur}px)`)
  }
  return parts.length ? parts.join(' ') : undefined
}

function getEffectiveFilter(style) {
  const generated = buildFilterCss(style.filters)
  if (style.filter && generated) return `${generated} ${style.filter}`.trim()
  return style.filter ?? generated
}

function styleToCss(style, object) {
  const lines = [
    '  position: absolute;',
    `  left: ${object.x}px;`,
    `  top: ${object.y}px;`,
    `  width: ${object.width}px;`,
    `  height: ${object.height}px;`,
    `  z-index: ${object.zIndex};`,
  ]

  const transforms = []
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
  if (style.borderWidth) {
    lines.push(`  border-width: ${style.borderWidth}px;`)
    lines.push('  border-style: solid;')
  }
  if (style.borderColor) lines.push(`  border-color: ${style.borderColor};`)
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

function cropWrapperCss(object) {
  const crop = object.style?.crop
  if (!crop || (crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1)) {
    return null
  }
  return `.el-${object.id}-crop {
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

function cropInnerCss(object) {
  const crop = object.style?.crop ?? { x: 0, y: 0, width: 1, height: 1 }
  const scaleX = 1 / crop.width
  const scaleY = 1 / crop.height
  const left = -(crop.x * object.width * scaleX)
  const top = -(crop.y * object.height * scaleY)

  const transforms = []
  if (object.rotation) transforms.push(`rotate(${object.rotation}deg)`)
  if (object.style?.flipX) transforms.push('scaleX(-1)')
  if (object.style?.flipY) transforms.push('scaleY(-1)')

  const lines = [
    '  position: absolute;',
    `  left: ${left}px;`,
    `  top: ${top}px;`,
    `  width: ${object.width * scaleX}px;`,
    `  height: ${object.height * scaleY}px;`,
  ]
  if (transforms.length) lines.push(`  transform: ${transforms.join(' ')};`)
  if (object.style?.opacity !== undefined && object.style.opacity !== 1) {
    lines.push(`  opacity: ${object.style.opacity};`)
  }
  const filter = getEffectiveFilter(object.style ?? {})
  if (filter) lines.push(`  filter: ${filter};`)
  if (object.style?.objectFit) lines.push(`  object-fit: ${object.style.objectFit};`)
  if (object.style?.objectPosition) lines.push(`  object-position: ${object.style.objectPosition};`)

  return lines.join('\n')
}

export function generateHtml(project, resolvedValues = {}) {
  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex)
  const elements = []

  for (const obj of sorted) {
    if (!obj.visible) continue

    if (obj.type === 'text') {
      const displayText = getDisplayTextForObject(obj, resolvedValues)
      const bindAttr = obj.textBinding
        ? ` data-excel-bind="${obj.id}"`
        : ''
      elements.push(
        `    <div class="el-${obj.id}"${bindAttr}>${escapeHtml(displayText)}</div>`,
      )
      continue
    }

    if ((obj.type === 'image' || obj.type === 'gif') && (obj.assetId || obj.imageBinding)) {
      const src = getImageSrcForObject(obj, project, resolvedValues)
      if (!src) continue
      const bindAttr = obj.imageBinding
        ? ` data-excel-bind="${obj.id}" data-excel-bind-kind="image"`
        : ''
      const crop = obj.style?.crop
      const hasCrop =
        crop && (crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1)

      if (hasCrop) {
        elements.push(
          `    <div class="el-${obj.id}-crop"><img class="el-${obj.id}-img"${bindAttr} src="${src}" alt="${escapeHtml(obj.name)}" /></div>`,
        )
      } else {
        elements.push(
          `    <img class="el-${obj.id}"${bindAttr} src="${src}" alt="${escapeHtml(obj.name)}" />`,
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
  <script src="excel-bind.js"></script>
</head>
<body>
  <div id="overlay">
${elements.join('\n')}
  </div>
</body>
</html>
`
}

export function generateCss(project) {
  const rules = [
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
      rules.push(`.el-${obj.id} {\n${styleToCss(obj.style ?? {}, obj)}\n}`)
      continue
    }

    if ((obj.type === 'image' || obj.type === 'gif') && (obj.assetId || obj.imageBinding)) {
      const crop = obj.style?.crop
      const hasCrop =
        crop && (crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1)

      if (hasCrop) {
        const wrapper = cropWrapperCss(obj)
        if (wrapper) rules.push(wrapper)
        rules.push(`.el-${obj.id}-img {\n${cropInnerCss(obj)}\n}`)
      } else {
        rules.push(`.el-${obj.id} {\n${styleToCss(obj.style ?? {}, obj)}\n}`)
      }
    }
  }

  return `${rules.join('\n\n')}\n`
}

export function exportProject(project, resolvedValues = {}) {
  return {
    html: generateHtml(project, resolvedValues),
    css: generateCss(project),
    dataCache: resolvedValues,
  }
}

export const EXCEL_BIND_SCRIPT = `(function () {
  var POLL_MS = 2000;
  function applyValues(values) {
    if (!values) return;
    Object.keys(values).forEach(function (id) {
      document.querySelectorAll('[data-excel-bind="' + id + '"]').forEach(function (el) {
        var kind = el.getAttribute('data-excel-bind-kind');
        if (kind === 'image' || el.tagName === 'IMG') {
          var next = values[id];
          if (!next) return;
          var sep = next.indexOf('?') >= 0 ? '&' : '?';
          el.setAttribute('src', next + sep + 't=' + Date.now());
        } else {
          el.textContent = values[id];
        }
      });
    });
  }
  function loadCache() {
    fetch('data-cache.json?t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(applyValues)
      .catch(function () {});
  }
  loadCache();
  setInterval(loadCache, POLL_MS);
})();
`
