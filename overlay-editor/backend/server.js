import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
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
} from './storage/projectManager.js'
import { exportProject } from './generator/exportProject.js'

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
  for (const client of liveReloadClients) {
    if (client.readyState === 1) client.send(payload)
  }
}

async function syncProjectFiles(project) {
  const { html, css } = exportProject(project)
  await writeProjectFiles(project.id, html, css)
  return { html, css }
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
    const project = await loadProject(req.params.id)
    res.json(project)
  } catch (err) {
    res.status(404).json({ error: 'Project not found' })
  }
})

app.put('/api/projects/:id/sync', async (req, res) => {
  try {
    const project = req.body
    if (!project || project.id !== req.params.id) {
      return res.status(400).json({ error: 'Invalid project payload' })
    }
    await saveProject(project)
    const { html, css } = await syncProjectFiles(project)
    broadcast({ type: 'css', projectId: project.id })
    res.json({ ok: true, html, css })
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
  ws.on('close', () => liveReloadClients.delete(ws))
})

await ensureProjectsDir()

const watcher = chokidar.watch(PROJECTS_DIR, {
  ignoreInitial: true,
  depth: 3,
})

watcher.on('change', (filePath) => {
  const rel = path.relative(PROJECTS_DIR, filePath).replace(/\\/g, '/')
  const [projectId, ...rest] = rel.split('/')
  if (!projectId) return

  if (rest.join('/') === 'styles.css') {
    broadcast({ type: 'css', projectId })
  } else if (rest.join('/') === 'index.html' || rest[0] === 'assets') {
    broadcast({ type: 'reload', projectId })
  }
})

httpServer.listen(PORT, () => {
  console.log(`Overlay Editor API: http://localhost:${PORT}`)
  console.log(`Projects dir: ${PROJECTS_DIR}`)
})
