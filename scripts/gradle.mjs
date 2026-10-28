// Ruft den Gradle-Wrapper plattformunabhängig auf: node scripts/gradle.mjs assembleDebug
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const dir = resolve('android')
const win = process.platform === 'win32'
const r = win
  ? spawnSync('cmd.exe', ['/d', '/c', resolve(dir, 'gradlew.bat'), ...process.argv.slice(2)], { cwd: dir, stdio: 'inherit' })
  : spawnSync(resolve(dir, 'gradlew'), process.argv.slice(2), { cwd: dir, stdio: 'inherit' })
process.exit(r.status ?? 1)
