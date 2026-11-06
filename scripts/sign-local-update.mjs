// Signs a prepared APK with an EXISTING local key. No upload, install or key creation.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { basename, delimiter, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const folder = dirname(fileURLToPath(import.meta.url))
const temporary = join(folder, '.anker-signierung.apk')
const hex = (value) => typeof value === 'string' ? value.replace(/:/g, '').toLowerCase() : ''
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const ownFile = (name) => {
  if (typeof name !== 'string' || basename(name) !== name || !name.endsWith('.apk')) throw new Error('Ungültiger APK-Dateiname im Updatepaket.')
  return join(folder, name)
}

function execute(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error('Ein Android-Werkzeug konnte den Schritt nicht abschließen. Es wurde kein neues Update erstellt.')
  return result.stdout
}

function findJava() {
  const executable = process.platform === 'win32' ? 'java.exe' : 'java'
  const home = process.env.JAVA_HOME?.trim().replace(/^"(.*)"$/, '$1')
  const candidates = [process.env.ANKER_JAVA, home && join(home, 'bin', executable), 'java']
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean)) {
      candidates.push(join(base, 'Android', 'Android Studio', 'jbr', 'bin', executable))
      for (const vendor of ['Java', 'Eclipse Adoptium', 'Microsoft']) {
        const root = join(base, vendor)
        if (!existsSync(root)) continue
        let entries
        try { entries = readdirSync(root, { withFileTypes: true }) } catch { continue }
        for (const item of entries) {
          if (item.isDirectory()) candidates.push(join(root, item.name, 'bin', executable))
        }
      }
    }
  }
  for (const java of new Set(candidates.filter(Boolean))) {
    const result = spawnSync(java, ['-version'], { encoding: 'utf8', timeout: 10_000 })
    const version = /version\s+"(\d+)(?:\.(\d+))?/.exec(`${result.stderr ?? ''}\n${result.stdout ?? ''}`)
    if (!result.error && result.status === 0 && version && Number(version[1]) >= 17) return java
  }
  throw new Error('Java 17 oder neuer wurde nicht gefunden. Bitte schick mir diese Meldung; ein Android-SDK ist nicht mehr nötig.')
}

function portableTools(info) {
  const dir = join(folder, 'tools')
  const jar = join(dir, 'apksig-8.13.0.jar')
  const helper = join(dir, 'AnkerApkTool.class')
  for (const [file, expected] of [[jar, info.tools?.apksigSha256], [helper, info.tools?.helperSha256]]) {
    if (!/^[a-f0-9]{64}$/.test(expected ?? '') || !existsSync(file) || sha256(file) !== expected) {
      throw new Error('Die beigepackten Signierwerkzeuge fehlen oder sind beschädigt. Bitte die neue ZIP vollständig entpacken.')
    }
  }
  return [jar, dir].join(delimiter)
}

function versionCode(value) {
  if (!/^\d+$/.test(String(value))) throw new Error('Ungültiger Versionscode im Updatepaket.')
  return BigInt(value)
}

try {
  const info = JSON.parse(readFileSync(join(folder, 'update-info.json'), 'utf8'))
  const expected = hex(info.certificateSha256)
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(info.apkSha256)) throw new Error('Die Prüfangaben im Updatepaket sind ungültig.')
  const input = ownFile(info.input)
  const output = ownFile(info.output)
  if (input === output || sha256(input) !== info.apkSha256) throw new Error('Die APK passt nicht zur Prüfsumme. Lade das Updatepaket erneut herunter.')
  const profile = process.env.USERPROFILE
  const key = process.argv[2] ?? (profile ? join(profile, '.android', 'debug.keystore') : '')
  if (!key || !existsSync(key)) throw new Error('Der bisherige debug.keystore wurde nicht gefunden. Es wird kein neuer Schlüssel erzeugt.')
  console.log('Anker-Signierhilfe 2 – ohne Android-SDK')
  const project = process.env.ANKER_PROJECT ?? 'D:\\Projekt\\Anker'
  const classpath = portableTools(info)
  const java = findJava()
  const tool = (...args) => execute(java, ['-cp', classpath, 'AnkerApkTool', ...args])
  const certificate = (file) => {
    const text = tool('verify', file)
    const matches = [...text.matchAll(/^CERT_SHA256=([a-fA-F0-9]{64})\s*$/gm)]
    if (matches.length !== 1 || hex(matches[0][1]) !== expected) throw new Error('Das Zertifikat stimmt nicht mit deinem Windows-Signierbericht überein. Kein neues Update wird bereitgestellt.')
  }
  const metadata = (file) => {
    const match = /^PACKAGE=(\S+)\r?\nVERSION_CODE=(\d+)\s*$/.exec(tool('metadata', file))
    if (!match || match[1] !== info.applicationId) throw new Error('Die APK gehört nicht zur erwarteten Anker-App.')
    return versionCode(match[2])
  }
  const nextVersion = metadata(input)
  if (nextVersion !== versionCode(info.versionCode)) throw new Error('Die APK-Version passt nicht zum Updatepaket.')
  const previous = join(project, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  if (existsSync(previous)) {
    certificate(previous)
    if (metadata(previous) > nextVersion) throw new Error('Deine bisherige lokale APK hat einen höheren Versionscode. Ich muss das Update passend neu bauen; Anker bleibt installiert.')
    console.log('Vorherige lokale APK: Zertifikat und Versionsfolge passen.')
  } else console.log('Keine frühere lokale APK gefunden. Android prüft beim Installieren zusätzlich die Kompatibilität zur installierten App.')
  rmSync(temporary, { force: true })
  rmSync(`${temporary}.idsig`, { force: true })
  if (tool('key-certificate', key).trim() !== `CERT_SHA256=${expected}`) throw new Error('Der vorhandene Schlüssel passt nicht zum gemeldeten Zertifikat.')
  console.log('Signiere mit deinem vorhandenen Schlüssel. Die Datei bleibt auf diesem PC.')
  tool('sign', input, temporary, key, expected)
  certificate(temporary)
  if (metadata(temporary) !== nextVersion) throw new Error('Die Versionsprüfung nach dem Signieren ist fehlgeschlagen.')
  renameSync(temporary, output)
  rmSync(`${temporary}.idsig`, { force: true })
  console.log(`Fertig: ${basename(output)}`)
  console.log(`APK-SHA256: ${sha256(output)}`)
  console.log('Übertrage diese signierte APK aufs Handy und installiere sie über die bestehende App.')
  console.log('Falls Android das Update ablehnt: Anker installiert lassen und mir den genauen Text schicken.')
} catch (error) {
  rmSync(temporary, { force: true })
  rmSync(`${temporary}.idsig`, { force: true })
  console.error(error instanceof Error ? error.message : 'Die Signierung wurde nicht abgeschlossen.')
  console.error('Die vorhandene App und der bisherige Schlüssel wurden nicht verändert. Bei einem abweichenden Schlüsselpasswort melde dich; bitte kein Passwort im Chat senden.')
  process.exitCode = 1
}
