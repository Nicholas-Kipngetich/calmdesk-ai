import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * electron-vite builds all three faces of the app:
 *   main     -> out/main/index.js       (Electron main process)
 *   preload  -> out/preload/index.js    (security bridge)
 *   renderer -> out/renderer/...        (React UI, served by Vite)
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    // Sandboxed preloads cannot `require()` external packages at runtime,
    // so exclude the SDK from externalization to bundle it inline.
    plugins: [externalizeDepsPlugin({ exclude: ['@smartspectra/node-sdk'] })]
  },
  renderer: {
    plugins: [react()]
  }
})
