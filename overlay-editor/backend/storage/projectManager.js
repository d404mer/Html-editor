import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PROJECTS_DIR = path.resolve(__dirname, '../projects')

export async function ensureProjectsDir() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true })
}

export function getProjectDir(projectId) {
  return path.join(PROJECTS_DIR, projectId)
}

export async function listProjects() {
  await ensureProjectsDir()
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
  const projects = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const summary = await getProjectSummary(entry.name).catch(() => null)
    if (summary) projects.push(summary)
  }

  projects.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return tb - ta
  })

  return projects
}

export async function getProjectSummary(projectId) {
  const projectPath = path.join(getProjectDir(projectId), 'project.json')
  const stat = await fs.stat(projectPath)
  const data = await fs.readFile(projectPath, 'utf-8')
  const project = JSON.parse(data)
  return {
    id: project.id,
    name: project.name,
    updatedAt: stat.mtime.toISOString(),
  }
}

export async function loadProject(projectId) {
  const projectPath = path.join(getProjectDir(projectId), 'project.json')
  const data = await fs.readFile(projectPath, 'utf-8')
  return JSON.parse(data)
}

export async function saveProject(project) {
  const dir = getProjectDir(project.id)
  await fs.mkdir(path.join(dir, 'assets', 'images'), { recursive: true })
  await fs.mkdir(path.join(dir, 'assets', 'videos'), { recursive: true })
  await fs.mkdir(path.join(dir, 'assets', 'svg'), { recursive: true })
  await fs.mkdir(path.join(dir, 'data'), { recursive: true })

  const projectPath = path.join(dir, 'project.json')
  const tmpPath = `${projectPath}.tmp`
  await fs.writeFile(tmpPath, JSON.stringify(project, null, 2), 'utf-8')
  await fs.rename(tmpPath, projectPath)
}

export function getDataDir(projectId) {
  return path.join(getProjectDir(projectId), 'data')
}

/** Сканирует папку data/ и синхронизирует список Excel-файлов в project.dataFiles */
export async function syncDataFilesFromDisk(project) {
  const dataDir = getDataDir(project.id)
  await fs.mkdir(dataDir, { recursive: true })

  let entries = []
  try {
    entries = await fs.readdir(dataDir, { withFileTypes: true })
  } catch {
    entries = []
  }

  const existing = new Map((project.dataFiles ?? []).map((f) => [f.path, f]))
  const dataFiles = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const lower = entry.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      continue
    }

    const relPath = `data/${entry.name}`
    const prev = existing.get(relPath)
    if (prev) {
      dataFiles.push(prev)
    } else {
      dataFiles.push({
        id: crypto.randomUUID().slice(0, 8),
        name: entry.name,
        path: relPath,
      })
    }
  }

  project.dataFiles = dataFiles
  return project
}

export async function saveDataFile(projectId, filename, buffer) {
  const dataDir = getDataDir(projectId)
  await fs.mkdir(dataDir, { recursive: true })
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fullPath = path.join(dataDir, safeName)
  await fs.writeFile(fullPath, buffer)
  return { name: safeName, path: `data/${safeName}` }
}

export async function deleteDataFile(projectId, relPath) {
  const fullPath = path.join(getProjectDir(projectId), relPath)
  try {
    await fs.unlink(fullPath)
  } catch {
    // already removed
  }
}

export function getDataFilePath(projectId, dataFile) {
  return path.join(getProjectDir(projectId), dataFile.path)
}

export async function writeProjectFiles(projectId, html, css, extras = {}) {
  const dir = getProjectDir(projectId)
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8')
  await fs.writeFile(path.join(dir, 'styles.css'), css, 'utf-8')
  if (extras.dataCache != null) {
    await fs.writeFile(
      path.join(dir, 'data-cache.json'),
      JSON.stringify(extras.dataCache, null, 2),
      'utf-8',
    )
  }
  if (extras.excelBindScript) {
    await fs.writeFile(path.join(dir, 'excel-bind.js'), extras.excelBindScript, 'utf-8')
  }
}

export function getAssetSubdir(type) {
  switch (type) {
    case 'video':
      return 'videos'
    case 'svg':
      return 'svg'
    default:
      return 'images'
  }
}

export async function saveAssetFile(projectId, asset, buffer) {
  const subdir = getAssetSubdir(asset.type)
  const dir = path.join(getProjectDir(projectId), 'assets', subdir)
  await fs.mkdir(dir, { recursive: true })
  const filename = path.basename(asset.path)
  const fullPath = path.join(dir, filename)
  await fs.writeFile(fullPath, buffer)
  return fullPath
}

export async function deleteAssetFile(projectId, asset) {
  const fullPath = path.join(getProjectDir(projectId), asset.path)
  try {
    await fs.unlink(fullPath)
  } catch {
    // file may already be gone
  }
}

export async function createDefaultProject(projectId, name = 'Untitled Project') {
  const project = {
    id: projectId,
    name,
    width: 1920,
    height: 1080,
    assets: [],
    dataFiles: [],
    objects: [],
  }
  await saveProject(project)
  return project
}

export async function deleteProject(projectId) {
  const dir = getProjectDir(projectId)
  await fs.rm(dir, { recursive: true, force: true })
}

export async function renameProject(projectId, name) {
  const project = await loadProject(projectId)
  project.name = name
  await saveProject(project)
  return project
}

async function projectDirExists(projectId) {
  try {
    await fs.access(getProjectDir(projectId))
    return true
  } catch {
    return false
  }
}

async function copyDirRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath)
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

function validateProjectJson(project) {
  if (!project || typeof project !== 'object') {
    throw new Error('Invalid project.json')
  }
  if (!project.id || typeof project.id !== 'string') {
    throw new Error('project.json must contain id')
  }
  if (!project.name || typeof project.name !== 'string') {
    throw new Error('project.json must contain name')
  }
  if (!Array.isArray(project.objects)) {
    throw new Error('project.json must contain objects array')
  }
  if (!Array.isArray(project.assets)) {
    throw new Error('project.json must contain assets array')
  }
}

/**
 * @param {string} srcDir absolute path to extracted project root (contains project.json)
 */
export async function importProjectFromDir(srcDir) {
  const projectJsonPath = path.join(srcDir, 'project.json')
  const raw = await fs.readFile(projectJsonPath, 'utf-8')
  const project = JSON.parse(raw)
  validateProjectJson(project)

  let targetId = project.id
  if (await projectDirExists(targetId)) {
    targetId = crypto.randomUUID()
    project.id = targetId
  }

  const destDir = getProjectDir(targetId)
  await copyDirRecursive(srcDir, destDir)

  await saveProject(project)
  return loadProject(targetId)
}
