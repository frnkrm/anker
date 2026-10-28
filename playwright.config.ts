import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } },
  webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173, timeout: 180_000, reuseExistingServer: true },
})
