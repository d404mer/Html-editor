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
    const projectPath = path.join(PROJECTS_DIR, entry.name, 'project.json')
    try {
      const data = await fs.readFile(projectPath, 'utf-8')
      const project = JSON.parse(data)
      projects.push({ id: project.id, name: project.name })
    } catch {
      // skip invalid folders
    }
  }

  return projects
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

  const projectPath = path.join(dir, 'project.json')
  const tmpPath = `${projectPath}.tmp`
  await fs.writeFile(tmpPath, JSON.stringify(project, null, 2), 'utf-8')
  await fs.rename(tmpPath, projectPath)
}

export async function writeProjectFiles(projectId, html, css) {
  const dir = getProjectDir(projectId)
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8')
  await fs.writeFile(path.join(dir, 'styles.css'), css, 'utf-8')
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
    objects: [],
  }
  await saveProject(project)
  return project
}
