import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { bindSmartSpectraIpc } from '@smartspectra/node-sdk/main'
import type {
  AppConfig,
  AppInfo,
  PrivacySettings,
  SessionSummary
} from '../shared/types'

/**
 * CalmDesk AI - Electron main process.
 *
 * Owns the window, the camera permission gate, the SmartSpectra IPC
 * bridge provided by @smartspectra/node-sdk/main, and the LOCAL privacy
 * store (session summaries + privacy preferences). The API key is read
 * here (via .env, gitignored) and only handed to the renderer at runtime
 * through the allowlisted 'app:config' channel - it never enters source.
 */

/* ---------------- Local privacy store (files, not databases) ----------------
 * Everything is a small JSON document under app.getPath('userData'):
 *   privacy.json         - consent + history preference
 *   session-history.json - array of SessionSummary (summary only!)
 * Plain files on purpose: no native modules to build, easy for users to
 * inspect/delete, and no frame/video/image data is ever written.
 */

const HISTORY_LIMIT = 500

const dataDir = (): string => app.getPath('userData')

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir(), file), 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown): void {
  const target = path.join(dataDir(), file)
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  fs.renameSync(tmp, target)
}

const DEFAULT_PRIVACY: Omit<PrivacySettings, 'dataPath'> = {
  consented: false,
  historyEnabled: true
}

function readPrivacy(): PrivacySettings {
  const stored = readJson('privacy.json', DEFAULT_PRIVACY)
  return { ...DEFAULT_PRIVACY, ...stored, dataPath: dataDir() }
}

ipcMain.handle('app:info', (): AppInfo => ({
  name: 'CalmDesk AI',
  tagline: 'A workspace that responds to you.',
  version: app.getVersion(),
  electron: process.versions.electron ?? '',
  node: process.versions.node,
  platform: process.platform
}))

// The renderer asks for runtime configuration when it starts. Only this
// channel exposes the API key, only over IPC, only in memory.
ipcMain.handle('app:config', (): AppConfig => ({
  apiKey: process.env['SMARTSPECTRA_API_KEY'] ?? '',
  telemetryEnabled: false
}))

ipcMain.handle('privacy:get', (): Promise<PrivacySettings> | PrivacySettings => readPrivacy())

ipcMain.handle(
  'privacy:set',
  (_event, patch: Partial<Omit<PrivacySettings, 'dataPath'>>): PrivacySettings => {
    const next = { ...readPrivacy(), ...patch }
    delete (next as Partial<PrivacySettings>).dataPath
    writeJson('privacy.json', next)
    return { ...next, dataPath: dataDir() }
  }
)

ipcMain.handle('history:list', (): SessionSummary[] =>
  readJson<SessionSummary[]>('session-history.json', []).toSorted(
    (a, b) => b.startedAt - a.startedAt
  )
)

ipcMain.handle('history:append', (_event, summary: SessionSummary): SessionSummary[] => {
  // Basic shape check - the renderer is treated as untrusted input.
  if (
    !summary ||
    typeof summary !== 'object' ||
    typeof summary.startedAt !== 'number' ||
    typeof summary.endedAt !== 'number'
  ) {
    return readJson<SessionSummary[]>('session-history.json', []).toSorted(
      (a, b) => b.startedAt - a.startedAt
    )
  }
  const sessions = readJson<SessionSummary[]>('session-history.json', [])
  sessions.push({ ...summary, id: summary.id || randomUUID() })
  while (sessions.length > HISTORY_LIMIT) sessions.shift()
  writeJson('session-history.json', sessions)
  return sessions.toSorted((a, b) => b.startedAt - a.startedAt)
})

ipcMain.handle('history:clear', (): void => {
  writeJson('session-history.json', [])
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'CalmDesk AI',
    backgroundColor: '#0b1325',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // SmartSpectra's official Electron bridge: accepts the renderer's
  // MessagePort and owns one native SDK session per renderer. Teardown
  // happens automatically when the window closes.
  bindSmartSpectraIpc(win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/* ---------------- Camera permission gate (Feature 6) ---------------- */

function trustedCaptureSource(requestingUrl: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173'
  return requestingUrl.startsWith('file://') || requestingUrl.startsWith(devUrl)
}

app.whenReady().then(() => {
  // Grant the camera ONLY to the app's own page, deny everything else.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const url =
      details?.requestingUrl ??
      (wc && 'getURL' in wc ? wc.getURL() : '')
    callback(permission === 'media' && trustedCaptureSource(url))
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
