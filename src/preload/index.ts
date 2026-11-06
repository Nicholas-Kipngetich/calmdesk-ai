import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo } from '../shared/types'

/**
 * CalmDesk AI - preload (the security gate).
 *
 * Runs in an isolated, sandboxed context between the privileged main process
 * and the untrusted renderer. Only explicitly whitelisted functions are
 * exposed to the UI - nothing else can cross this boundary.
 */

export interface CalmDeskAPI {
  getAppInfo: () => Promise<AppInfo>
}

const api: CalmDeskAPI = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('calmdesk', api)
