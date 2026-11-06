import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import { bindSmartSpectraIpc } from '@smartspectra/node-sdk/main'
import type { AppConfig, AppInfo } from '../shared/types'

/**
 * CalmDesk AI - Electron main process.
 *
 * Owns the window, the camera permission gate, and the SmartSpectra IPC
 * bridge provided by @smartspectra/node-sdk/main. The API key is read here
 * (via .env, gitignored) and only handed to the renderer at runtime through
 * the allowlisted 'app:config' channel - it never enters source code.
 */

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

/* ---------------- IPC (explicit allowlist only) ---------------- */

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
