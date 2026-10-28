// Erzeugt PWA- und Android-Launcher-Icons aus public/icon.svg (einmalig nach Icon-Änderung ausführen):
//   node scripts/icons.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const svg = readFileSync('public/icon.svg', 'utf8')
// Vordergrund für adaptive Icons: nur das Symbol, ohne Hintergrund, mit Sicherheitsrand
const fg = svg.replace(/<rect[^>]*\/>/, '').replace('<g ', '<g transform="translate(96 96) scale(0.625)" ')

const targets = [
  ['public/icon-192.png', svg, 192],
  ['public/icon-512.png', svg, 512],
]
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, f] of Object.entries(densities)) {
  const res = `android/app/src/main/res/mipmap-${d}`
  targets.push([`${res}/ic_launcher.png`, svg, 48 * f], [`${res}/ic_launcher_round.png`, svg.replace('rx="112"', 'rx="256"'), 48 * f], [`${res}/ic_launcher_foreground.png`, fg, 108 * f])
}

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, content, size] of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${content.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  mkdirSync(dirname(file), { recursive: true })
  await page.locator('svg').screenshot({ path: file, omitBackground: true })
  console.log('✓', file)
}
await browser.close()
