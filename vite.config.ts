/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseDeviceTestCatalog } from './src/core/deviceTests'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Stable source identity even while an unreleased package version is unchanged. No user data. */
function appSourceFingerprint(): string {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const hash = createHash('sha256')
  const visit = (path: string) => {
    for (const entry of readdirSync(root + path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = `${path}/${entry.name}`
      if (entry.isDirectory()) visit(file)
      else if (/\.(ts|tsx|css|kt|xml)$/.test(file) && !/\.test\.|\.d\.ts$/.test(file)) hash.update(file).update('\0').update(readFileSync(root + file)).update('\0')
    }
  }
  visit('src')
  // Gemeinsam mit Deno genutzte Protokolle gehören ebenfalls zum tatsächlichen Appcode.
  visit('supabase/functions/_shared')
  visit('android/app/src/main/java/de/frnkrm/anker')
  visit('android/app/src/main/res')
  for (const path of ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'app.config.ts', 'capacitor.config.ts', 'android/app/src/main/AndroidManifest.xml', 'android/app/build.gradle', 'android/variables.gradle', 'android/build.gradle', 'android/gradle/wrapper/gradle-wrapper.properties']) hash.update(path).update('\0').update(readFileSync(root + path)).update('\0')
  hash.update(JSON.stringify(parseDeviceTestCatalog(readFileSync(root + 'docs/GERAETETEST.md', 'utf8'))))
  return hash.digest('hex')
}

export default defineConfig({
  plugins: [
    {
      name: 'anker-device-test-catalog',
      resolveId(id) { if (id === 'virtual:anker-device-tests') return '\0anker-device-tests' },
      load(id) {
        if (id !== '\0anker-device-tests') return
        const path = fileURLToPath(new URL('./docs/GERAETETEST.md', import.meta.url))
        this.addWatchFile(path)
        // Ship instructions only. Personal historical results stay in the source document.
        return `export const BUILD_FINGERPRINT = ${JSON.stringify(appSourceFingerprint())}; export default ${JSON.stringify(parseDeviceTestCatalog(readFileSync(path, 'utf8')))}`
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Anker',
        short_name: 'Anker',
        description: 'Dein Tag, ein Schritt nach dem anderen.',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  // Windows-Dateiüberwachung verpasst sonst gelegentlich schnelle Änderungen
  server: { watch: { usePolling: process.platform === 'win32', interval: 300 } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: { TZ: 'UTC' },
  },
})
