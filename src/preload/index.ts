import '@smartspectra/node-sdk/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  AppInfo,
  PrivacySettings,
  SessionSummary
} from '../shared/types'

/**
 * CalmDesk AI - preload (the security gate).
 *
 * 1. Loads the official SmartSpectra preload bridge (bundled in, because
 *    sandboxed preloads cannot resolve externalized dependency requires).
 * 2. Exposes CalmDesk's own tiny API: it cannot do anything beyond the
 *    explicit IPC allowlist mirrors below - every method maps to exactly
 *    one allowlisted channel, with typed arguments.
 */

export interface CalmDeskAPI {
  getAppInfo: () => Promise<AppInfo>
  getConfig: () => Promise<AppConfig>
  /** Privacy store (owned by the main process, saved under userData). */
  getPrivacy: () => Promise<PrivacySettings>
  setPrivacy: (
    patch: Partial<Omit<PrivacySettings, 'dataPath'>>
  ) => Promise<PrivacySettings>
  /** Local session summaries (summary only - never raw frames). */
  listSessions: () => Promise<SessionSummary[]>
  appendSession: (summary: SessionSummary) => Promise<SessionSummary[]>
  clearHistory: () => Promise<void>
}

const api: CalmDeskAPI = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('app:config'),
  getPrivacy: (): Promise<PrivacySettings> => ipcRenderer.invoke('privacy:get'),
  setPrivacy: (patch): Promise<PrivacySettings> => ipcRenderer.invoke('privacy:set', patch),
  listSessions: (): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('history:list') as Promise<SessionSummary[]>,
  appendSession: (summary: SessionSummary): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('history:append', summary) as Promise<SessionSummary[]>,
  clearHistory: (): Promise<void> => ipcRenderer.invoke('history:clear') as Promise<void>
}

contextBridge.exposeInMainWorld('calmdesk', api)
