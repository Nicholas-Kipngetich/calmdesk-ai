import type { CalmDeskAPI } from './index'

declare global {
  interface Window {
    calmdesk: CalmDeskAPI
  }
}

export {}
