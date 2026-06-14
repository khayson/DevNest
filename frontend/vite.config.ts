import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isTauriContext = Boolean(process.env.TAURI_ENV_PLATFORM || process.env.TAURI_ENV_FAMILY)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Browser dev (dev.ps1 / vite) — stubs so Vite does not require Tauri plugins at runtime
      ...(isTauriContext
        ? {}
        : {
            '@tauri-apps/plugin-updater': path.resolve(
              __dirname,
              './src/shared/lib/tauri-stubs/plugin-updater.ts'
            ),
            '@tauri-apps/plugin-process': path.resolve(
              __dirname,
              './src/shared/lib/tauri-stubs/plugin-process.ts'
            ),
          }),
    },
  },
  optimizeDeps: {
    include: isTauriContext
      ? ['@tauri-apps/plugin-updater', '@tauri-apps/plugin-process']
      : [],
  },
})
