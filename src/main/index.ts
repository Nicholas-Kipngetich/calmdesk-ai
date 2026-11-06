import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

/**
 * CalmDesk AI - Electron main process.
 *
 * This is the privileged backend. It owns the window, and in Phase 4 it will
 * own the SmartSpectra SDK integration and the camera. API keys will live
 * here only - never in the renderer.
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
      // Security architecture (project requirement):
      contextIsolation: true, // renderer world is isolated from this process
      nodeIntegration: false,  // renderer has NO Node.js access
      sandbox: true,           // preload runs in a hardened sandbox
      webviewTag: false
    }
  })

  // Show the window only once it has fully painted - avoids a white flash.
  win.on('ready-to-show', () => win.show())

  // Any navigations to external URLs open in the system browser, never inside
  // the app window.
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev server (hot reload) during development, static files in production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// Explicit, allowlisted IPC channels only. The renderer can never invoke
// anything that isn't registered here.
ipcMain.handle('app:info', () => ({
  name: 'CalmDesk AI',
  tagline: 'A workspace that responds to you.',
  version: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform
}))

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // Re-create the window if the dock icon is clicked (macOS behaviour).
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Quit when all windows close (on all our target platforms).
  app.quit()
})
