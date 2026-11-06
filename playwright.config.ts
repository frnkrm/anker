import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    timeout: 180_000,
    // In CI muss der gerade gebaute Stand laufen; lokal darf ein eigener Preview-Server bleiben.
    reuseExistingServer: !process.env.CI,
  },
})
