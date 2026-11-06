// Run explicitly with Node >=24 and PowerShell: PWSH_PATH=/path/to/pwsh node scripts/test-pc-stop.mjs.
// No Windows integration is invoked. Missing PowerShell fails this separate command, never a Vitest skip.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pcStopFiles } from '../src/core/export/pcstop.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = process.env.ANKER_PC_TEST_OUTPUT ? resolve(process.env.ANKER_PC_TEST_OUTPUT) : tmpdir()
mkdirSync(outputRoot, { recursive: true })
const evidenceDir = mkdtempSync(join(outputRoot, 'anker-pc-stop-'))
const files = pcStopFiles({ endpoint: 'https://synthetic.invalid/pc-stop', token: 'synthetic-token', fallbackTime: '23:00' })
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
for (const [name, body] of Object.entries(files)) writeFileSync(join(evidenceDir, name), body)
writeFileSync(join(evidenceDir, 'source-manifest.json'), JSON.stringify({
  source: join(root, 'src/core/export/pcstop.ts'),
  sourceSha256: sha256(readFileSync(join(root, 'src/core/export/pcstop.ts'))),
  exportedFiles: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, sha256(body)])),
  clockTransformation: '[datetimeoffset]::UtcNow replaced only in ephemeral harness body',
  toastTransformation: 'Show-Toast AST body replaced with recorder; production exports unchanged',
  executedExports: ['PC_STOP_PS1', 'ABORT_PS1'],
  parsedOnlyExports: ['INSTALL_PS1', 'UNINSTALL_PS1'],
}, null, 2) + '\n')

const runtime = process.env.PWSH_PATH || 'pwsh'
const result = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-File', join(root, 'scripts/test/pc-stop.runtime.ps1'), '-EvidenceDir', evidenceDir], {
  cwd: root,
  encoding: 'utf8',
  timeout: 30_000,
  maxBuffer: 8 * 1024 * 1024,
  env: {
    ...process.env,
    TZ: 'Europe/Berlin',
    POWERSHELL_TELEMETRY_OPTOUT: '1',
    XDG_CACHE_HOME: join(evidenceDir, 'xdg-cache'),
    XDG_CONFIG_HOME: join(evidenceDir, 'xdg-config'),
    XDG_DATA_HOME: join(evidenceDir, 'xdg-data'),
  },
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
console.log(`PC-Stopp-Testnachweise: ${evidenceDir}`)
if (result.error) {
  const state = result.error.code === 'ENOENT' ? 'nicht ausgeführt' : 'nicht vollständig abgeschlossen'
  console.error(`PowerShell-Test ${state}: ${result.error.message}. Prüfe die Laufzeit; PWSH_PATH kann ihre ausführbare Datei angeben.`)
  process.exit(1)
}
if (result.status !== 0) process.exit(result.status ?? 1)
const report = JSON.parse(readFileSync(join(evidenceDir, 'results.json'), 'utf8').replace(/^\uFEFF/, ''))
if (report.parser.length !== 4 || report.parser.some((script) => script.errors.length) || !report.tests.length || report.tests.some((test) => test.status !== 'passed')) {
  console.error('Die PowerShell-Nachweise enthalten unvollständige oder fehlgeschlagene Prüfungen.')
  process.exit(1)
}
console.log(`PowerShell ${report.runtime} (${report.platform}): isolierte Logik/Parser geprüft; Windows-Aufgabenplanung, echte Toasts und Abschaltung bleiben ungeprüft.`)
