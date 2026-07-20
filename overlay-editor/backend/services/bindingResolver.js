import {
  getDataFilePath,
} from '../storage/projectManager.js'
import {
  resolveBindingFromFile,
} from '../services/excelService.js'
import { excelDebug } from '../utils/excelDebug.js'

/**
 * @param {object} project
 * @returns {Record<string, string>} objectId -> resolved text
 */
export function resolveProjectBindings(project) {
  /** @type {Record<string, string>} */
  const values = {}

  for (const obj of project.objects ?? []) {
    if (obj.type !== 'text' || !obj.textBinding) continue

    const binding = obj.textBinding
    const dataFile = (project.dataFiles ?? []).find((f) => f.id === binding.fileId)
    if (!dataFile) {
      excelDebug('resolve: data file not found', {
        objectId: obj.id,
        fileId: binding.fileId,
        knownFiles: (project.dataFiles ?? []).map((f) => ({ id: f.id, name: f.name })),
      })
      values[obj.id] = binding.fallback ?? obj.text ?? ''
      continue
    }

    try {
      const filePath = getDataFilePath(project.id, dataFile)
      const value = resolveBindingFromFile(filePath, binding)
      excelDebug('resolve: ok', {
        objectId: obj.id,
        file: dataFile.name,
        binding,
        value,
      })
      values[obj.id] = value
    } catch (err) {
      excelDebug('resolve: read error', {
        objectId: obj.id,
        file: dataFile.name,
        error: err.message,
      })
      values[obj.id] = binding.fallback ?? obj.text ?? ''
    }
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
