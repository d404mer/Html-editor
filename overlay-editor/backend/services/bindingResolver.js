import {
  getDataFilePath,
} from '../storage/projectManager.js'
import {
  resolveBindingFromFile,
} from '../services/excelService.js'
import {
  resolveImageDisplayPath,
} from '../utils/bindingPath.js'
import { excelDebug } from '../utils/excelDebug.js'

/**
 * @param {object} project
 * @param {object} obj
 * @param {import('../types').ExcelBinding} binding
 */
function resolveObjectBinding(project, obj, binding) {
  const dataFile = (project.dataFiles ?? []).find((f) => f.id === binding.fileId)
  if (!dataFile) {
    excelDebug('resolve: data file not found', {
      objectId: obj.id,
      fileId: binding.fileId,
      knownFiles: (project.dataFiles ?? []).map((f) => ({ id: f.id, name: f.name })),
    })
    return binding.fallback ?? (obj.type === 'text' ? obj.text ?? '' : '')
  }

  try {
    const filePath = getDataFilePath(project.id, dataFile)
    const raw = resolveBindingFromFile(filePath, binding)
    if (obj.type === 'image' || obj.type === 'gif') {
      const asset = project.assets.find((a) => a.id === obj.assetId)

      const value = resolveImageDisplayPath(raw, binding, asset?.path);

      // Добавляем строки отладки
      excelDebug('resolve image: raw', { objectId: obj.id, file: dataFile.name, binding, raw });
      console.log('resolveImageDisplayPath: raw:', raw);

      excelDebug('resolve image: value', { objectId: obj.id, file: dataFile.name, binding, value });
      console.log('resolveImageDisplayPath: value:', value);

      // Добавляем строки отладки для проверки пути
      excelDebug('resolve image: asset path', { objectId: obj.id, assetPath: asset?.path });
      console.log('resolveImageDisplayPath: asset path:', asset?.path);

      return value
    }
    const value = raw || binding.fallback || obj.text || ''
    excelDebug('resolve text: ok', {
      objectId: obj.id,
      file: dataFile.name,
      binding,
      value,
    })
    return value
  } catch (err) {
    excelDebug('resolve: read error', {
      objectId: obj.id,
      file: dataFile?.name,
      error: err.message,
    })
    if (obj.type === 'image' || obj.type === 'gif') {
      const asset = project.assets.find((a) => a.id === obj.assetId)
      return resolveImageDisplayPath('', binding, asset?.path)
    }
    return binding.fallback ?? obj.text ?? ''
  }
}

/**
 * @param {object} project
 * @returns {Record<string, string>} objectId -> resolved text or image path
 */
export function resolveProjectBindings(project) {
  /** @type {Record<string, string>} */
  const values = {}

  for (const obj of project.objects ?? []) {
    const binding =
      obj.type === 'text'
        ? obj.textBinding
        : obj.type === 'image' || obj.type === 'gif'
          ? obj.imageBinding
          : undefined
    if (!binding) continue

    values[obj.id] = resolveObjectBinding(project, obj, binding)
  }

  return values
}

/**
 * @param {object} project
 * @param {string} objectId
 */
export function getDisplayText(project, objectId, resolvedValues) {
  const obj = project.objects.find((o) => o.id === objectId)
  if (!obj) return ''
  if (obj.textBinding) {
    return resolvedValues[objectId] ?? obj.textBinding.fallback ?? obj.text ?? ''
  }
  return obj.text ?? ''
}

/**
 * @param {object} project
 * @param {string} objectId
 * @param {Record<string, string>} resolvedValues
 */
export function getDisplayImagePath(project, objectId, resolvedValues) {
  const obj = project.objects.find((o) => o.id === objectId)
  if (!obj || (obj.type !== 'image' && obj.type !== 'gif') || !obj.imageBinding) return ''
  const asset = project.assets.find((a) => a.id === obj.assetId)
  return resolveImageDisplayPath(
    resolvedValues[objectId],
    obj.imageBinding,
    asset?.path,
  )
}


