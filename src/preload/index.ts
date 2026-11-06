import '@smartspectra/node-sdk/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, AppInfo } from '../shared/types'

/**
 * CalmDesk AI - preload (the security gate).
 *
 * 1. Loads the official SmartSpectra preload bridge (bundled in, because
 *    sandboxed preloads cannot resolve externalized dependency requires).
 * 2. Exposes CalmDesk's own tiny API: it cannot do anything beyond the two
 *    allowlisted IPC calls below.
 */

export interface CalmDeskAPI {
  getAppInfo: () => Promise<AppInfo>
  getConfig: () => Promise<AppConfig>
}

const api: CalmDeskAPI = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('app:config')
}

contextBridge.exposeInMainWorld('calmdesk', api)
