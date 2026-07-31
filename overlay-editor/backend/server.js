import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import AdmZip from 'adm-zip'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import chokidar from 'chokidar'
import {
  ensureProjectsDir,
  listProjects,
  loadProject,
  saveProject,
  writeProjectFiles,
  saveAssetFile,
  deleteAssetFile,
  createDefaultProject,
  getProjectDir,
  getAssetSubdir,
  PROJECTS_DIR,
  syncDataFilesFromDisk,
  saveDataFile,
  deleteDataFile,
  getDataFilePath,
  deleteProject,
  renameProject,
  importProjectFromDir,
} from './storage/projectManager.js'
import { exportProject, EXCEL_BIND_SCRIPT } from './generator/exportProject.js'
import { resolveProjectBindings } from './services/bindingResolver.js'
import { getWorkbookSchema } from './services/excelService.js'
import { excelDebug } from './utils/excelDebug.js'

const PORT = 3000
const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(express.json({ limit: '10mb' }))

const liveReloadClients = new Set()

const LIVE_RELOAD_SCRIPT = `(function () {
  var ws;
  var cssLink = document.querySelector('link[rel="stylesheet"]');
  function connect() {
    ws = new WebSocket('ws://' + location.hostname + ':${PORT}/live');
    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.type === 'css') {
          if (cssLink) {
            var href = cssLink.getAttribute('href').split('?')[0];
            cssLink.setAttribute('href', href + '?t=' + Date.now());
          }
        } else if (msg.type === 'reload') {
          location.reload();
        } else if (msg.type === 'data') {
          fetch('data-cache.json?t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (values) {
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
            })
            .catch(function () {});
        }
      } catch (e) {
        location.reload();
      }
    };
    ws.onclose = function () { setTimeout(connect, 1000); };
  }
  connect();
})();`

function broadcast(message) {
  const payload = JSON.stringify(message)
  let sent = 0
  for (const client of liveReloadClients) {
    if (client.readyState === 1) {
      client.send(payload)
      sent++
    }
  }
  excelDebug('broadcast', message, { clients: liveReloadClients.size, sent })
}

async function syncProjectFiles(project) {
  await syncDataFilesFromDisk(project)
  const resolvedValues = resolveProjectBindings(project)
  const { html, css, dataCache } = exportProject(project, resolvedValues)
  await writeProjectFiles(project.id, html, css, {
    dataCache,
    excelBindScript: EXCEL_BIND_SCRIPT,
  })
  await saveProject(project)
  return { html, css, dataCache }
}

app.get('/live-reload.js', (_req, res) => {
  res.type('application/javascript').send(LIVE_RELOAD_SCRIPT)
})

app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await listProjects()
    res.json(projects)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects', async (req, res) => {
  try {
    const id = crypto.randomUUID()
    const name = req.body?.name ?? 'Untitled Project'
    const project = await createDefaultProject(id, name)
    await syncProjectFiles(project)
    res.json(project)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/projects/:id', async (req, res) => {
  try {
    let project = await loadProject(req.params.id)
    project = await syncDataFilesFromDisk(project)
    await saveProject(project)
    res.json(project)
  } catch (err) {
    res.status(404).json({ error: 'Project not found' })
  }
})

app.patch('/api/projects/:id', async (req, res) => {
  try {
    const name = req.body?.name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' })
    }
    const project = await renameProject(req.params.id, name.trim())
    res.json(project)
  } catch (err) {
    res.status(404).json({ error: err.message })
  }
})

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await loadProject(req.params.id)
    await deleteProject(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(404).json({ error: 'Project not found' })
  }
})

app.post('/api/projects/import', upload.single('file'), async (req, res) => {
  let tempDir = null
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    tempDir = path.join(os.tmpdir(), `overlay-import-${crypto.randomUUID()}`)
    await fs.mkdir(tempDir, { recursive: true })

    const zip = new AdmZip(req.file.buffer)
    zip.extractAllTo(tempDir, true)

    let projectRoot = tempDir
    const directJson = path.join(tempDir, 'project.json')
    try {
      await fs.access(directJson)
    } catch {
      const entries = await fs.readdir(tempDir, { withFileTypes: true })
      const subdirs = entries.filter((e) => e.isDirectory())
      if (subdirs.length === 1) {
        projectRoot = path.join(tempDir, subdirs[0].name)
      }
    }

    let project = await importProjectFromDir(projectRoot)
    project = await syncDataFilesFromDisk(project)
    await syncProjectFiles(project)
    broadcast({ type: 'reload', projectId: project.id })
    res.json(project)
  } catch (err) {
    res.status(400).json({ error: err.message })
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

app.put('/api/projects/:id/sync', async (req, res) => {
  try {
    const project = req.body
    if (!project || project.id !== req.params.id) {
      return res.status(400).json({ error: 'Invalid project payload' })
    }
    await syncDataFilesFromDisk(project)
    const { html, css, dataCache } = await syncProjectFiles(project)
    broadcast({ type: 'data', projectId: project.id })
    broadcast({ type: 'css', projectId: project.id })
    res.json({ ok: true, html, css, dataCache })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Excel / Data files ---

app.get('/api/projects/:id/data/resolve', async (req, res) => {
  try {
    let project = await loadProject(req.params.id)
    project = await syncDataFilesFromDisk(project)
    const values = resolveProjectBindings(project)
    res.json(values)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects/:id/data/resolve', async (req, res) => {
  try {
    let project = req.body?.project ?? (await loadProject(req.params.id))
    if (project.id !== req.params.id) {
      return res.status(400).json({ error: 'Project id mismatch' })
    }
    project = await syncDataFilesFromDisk(project)
    const values = resolveProjectBindings(project)
    excelDebug('POST /data/resolve', {
      projectId: project.id,
      dataFiles: (project.dataFiles ?? []).map((f) => f.name),
      bindings: (project.objects ?? [])
        .filter(
          (o) =>
            (o.type === 'text' && o.textBinding) ||
            ((o.type === 'image' || o.type === 'gif') && o.imageBinding),
        )
        .map((o) => ({
          id: o.id,
          kind: o.textBinding ? 'text' : 'image',
          binding: o.textBinding ?? o.imageBinding,
        })),
      values,
    })
    res.json(values)
  } catch (err) {
    excelDebug('POST /data/resolve ERROR', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects/:id/data/scan', async (req, res) => {
  try {
    let project = await loadProject(req.params.id)
    project = await syncDataFilesFromDisk(project)
    await saveProject(project)
    res.json(project)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/projects/:id/data', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    let project = await loadProject(req.params.id)
    const { name, path: relPath } = await saveDataFile(
      project.id,
      req.file.originalname,
      req.file.buffer,
    )

    project = await syncDataFilesFromDisk(project)
    const match = project.dataFiles.find((f) => f.path === `data/${name}`)
    if (!match) {
      project.dataFiles.push({
        id: crypto.randomUUID().slice(0, 8),
        name,
        path: relPath,
      })
    }

    await syncProjectFiles(project)
    broadcast({ type: 'reload', projectId: project.id })

    res.json({ project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/projects/:id/data/:fileId', async (req, res) => {
  try {
    let project = await loadProject(req.params.id)
    const dataFile = (project.dataFiles ?? []).find((f) => f.id === req.params.fileId)
    if (!dataFile) return res.status(404).json({ error: 'Data file not found' })

    await deleteDataFile(project.id, dataFile.path)
    project.dataFiles = project.dataFiles.filter((f) => f.id !== req.params.fileId)
    project.objects = project.objects.map((obj) => {
      if (obj.textBinding?.fileId === req.params.fileId) {
        return { ...obj, textBinding: undefined }
      }
      if (obj.imageBinding?.fileId === req.params.fileId) {
        return { ...obj, imageBinding: undefined }
      }
      return obj
    })

    await syncProjectFiles(project)
    broadcast({ type: 'reload', projectId: project.id })
    res.json({ project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/projects/:id/data/:fileId/schema', async (req, res) => {
  try {
    const project = await loadProject(req.params.id)
    const dataFile = (project.dataFiles ?? []).find((f) => f.id === req.params.fileId)
    if (!dataFile) return res.status(404).json({ error: 'Data file not found' })

    const filePath = getDataFilePath(project.id, dataFile)
    const schema = getWorkbookSchema(filePath)
    res.json(schema)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function detectAssetType(mimeType, filename) {
  if (mimeType === 'image/gif' || filename.endsWith('.gif')) return 'gif'
  if (mimeType === 'image/svg+xml' || filename.endsWith('.svg')) return 'svg'
  if (mimeType.startsWith('video/')) return 'video'
  return 'image'
}

app.post('/api/projects/:id/assets', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const project = await loadProject(req.params.id)
    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const assetId = crypto.randomUUID().slice(0, 8)
    const type = detectAssetType(req.file.mimetype, originalName.toLowerCase())
    const subdir = getAssetSubdir(type)
    const relPath = `assets/${subdir}/${assetId}-${originalName}`

    const asset = {
      id: assetId,
      type,
      name: originalName,
      path: relPath,
      mimeType: req.file.mimetype,
    }

    await saveAssetFile(project.id, asset, req.file.buffer)
    project.assets.push(asset)
    await saveProject(project)
    await syncProjectFiles(project)
    broadcast({ type: 'reload', projectId: project.id })

    res.json({ asset, project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/projects/:id/assets/:assetId', async (req, res) => {
  try {
    const project = await loadProject(req.params.id)
    const asset = project.assets.find((a) => a.id === req.params.assetId)
    if (!asset) return res.status(404).json({ error: 'Asset not found' })

    await deleteAssetFile(project.id, asset)
    project.assets = project.assets.filter((a) => a.id !== asset.id)
    project.objects = project.objects.map((obj) =>
      obj.assetId === asset.id ? { ...obj, assetId: undefined } : obj,
    )
    await saveProject(project)
    await syncProjectFiles(project)
    broadcast({ type: 'reload', projectId: project.id })

    res.json({ project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/projects/:id/assets/:assetId', async (req, res) => {
  try {
    const project = await loadProject(req.params.id)
    const asset = project.assets.find((a) => a.id === req.params.assetId)
    if (!asset) return res.status(404).json({ error: 'Asset not found' })

    if (req.body?.name) asset.name = req.body.name
    await saveProject(project)
    res.json({ asset, project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post(
  '/api/projects/:id/assets/:assetId/replace',
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

      const project = await loadProject(req.params.id)
      const asset = project.assets.find((a) => a.id === req.params.assetId)
      if (!asset) return res.status(404).json({ error: 'Asset not found' })

      await deleteAssetFile(project.id, asset)
      await saveAssetFile(project.id, asset, req.file.buffer)
      await saveProject(project)
      await syncProjectFiles(project)
      broadcast({ type: 'reload', projectId: project.id })

      res.json({ asset, project })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  },
)

app.use('/preview/:id', async (req, res, next) => {
  const projectDir = getProjectDir(req.params.id)
  express.static(projectDir)(req, res, next)
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/live' })

wss.on('connection', (ws) => {
  liveReloadClients.add(ws)
  excelDebug('ws client connected', { total: liveReloadClients.size })
  ws.on('close', () => {
    liveReloadClients.delete(ws)
    excelDebug('ws client disconnected', { total: liveReloadClients.size })
  })
})

await ensureProjectsDir()

const watcher = chokidar.watch(PROJECTS_DIR, {
  ignoreInitial: true,
  depth: 3,
  awaitWriteFinish: {
    stabilityThreshold: 400,
    pollInterval: 100,
  },
})

function isDataSpreadsheet(relPath) {
  return relPath.startsWith('data/') && /\.(xlsx|xls|csv)$/i.test(relPath)
}

async function refreshProjectData(projectId) {
  excelDebug('refreshProjectData start', { projectId })
  try {
    let project = await loadProject(projectId)
    project = await syncDataFilesFromDisk(project)
    const { dataCache } = await syncProjectFiles(project)
    excelDebug('refreshProjectData done', { projectId, dataCache })
    broadcast({ type: 'data', projectId })
  } catch (err) {
    excelDebug('refreshProjectData ERROR', { projectId, error: err.message })
    throw err
  }
}

function handleProjectFileEvent(eventType, filePath) {
  const rel = path.relative(PROJECTS_DIR, filePath).replace(/\\/g, '/')
  const [projectId, ...rest] = rel.split('/')
  const relPath = rest.join('/')

  excelDebug('watcher', { eventType, filePath, rel, projectId, relPath })

  if (!projectId) return

  if (relPath === 'styles.css') {
    broadcast({ type: 'css', projectId })
  } else if (relPath === 'data-cache.json') {
    broadcast({ type: 'data', projectId })
  } else if (isDataSpreadsheet(relPath)) {
    refreshProjectData(projectId).catch(() => {
      excelDebug('refreshProjectData fallback broadcast', { projectId })
      broadcast({ type: 'data', projectId })
    })
  } else if (relPath === 'index.html' || rest[0] === 'assets') {
    broadcast({ type: 'reload', projectId })
  } else {
    excelDebug('watcher ignored', { relPath })
  }
}

watcher.on('change', (filePath) => handleProjectFileEvent('change', filePath))
watcher.on('add', (filePath) => handleProjectFileEvent('add', filePath))
watcher.on('ready', () => {
  excelDebug('watcher ready', { watchDir: PROJECTS_DIR })
})
watcher.on('error', (err) => {
  excelDebug('watcher ERROR', err.message)
})

httpServer.listen(PORT, () => {
  console.log(`Overlay Editor API: http://localhost:${PORT}`)
  console.log(`Projects dir: ${PROJECTS_DIR}`)
})
