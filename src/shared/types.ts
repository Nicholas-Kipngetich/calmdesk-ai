/**
 * CalmDesk AI - shared contracts.
 *
 * Types here are intentionally free of any Electron imports so both the
 * main/preload TypeScript project and the renderer project can import them.
 * Later phases will add measurement and signal-quality types here too.
 */

export interface AppInfo {
  name: string
  tagline: string
  version: string
  electron: string
  node: string
  platform: string
}
