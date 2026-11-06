// Signs a prepared APK with an EXISTING local key. No upload, install or key creation.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
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

function findTools(project) {
  const roots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]
  const properties = join(project, 'android', 'local.properties')
  if (existsSync(properties)) {
    const match = /^sdk\.dir\s*=\s*(.+)$/m.exec(readFileSync(properties, 'utf8'))
    if (match) roots.push(match[1].trim().replace(/\\([\\:= ])/g, '$1'))
  }
  if (process.env.LOCALAPPDATA) roots.push(join(process.env.LOCALAPPDATA, 'Android', 'Sdk'))
  for (const root of roots.filter(Boolean)) {
    const tools = join(root, 'build-tools')
    if (!existsSync(tools)) continue
    const versions = readdirSync(tools).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
    for (const version of versions) {
      const dir = join(tools, version)
      const jar = join(dir, 'lib', 'apksigner.jar')
      const aapt = join(dir, process.platform === 'win32' ? 'aapt.exe' : 'aapt')
      if (existsSync(jar) && existsSync(aapt)) return { jar, aapt }
    }
  }
  throw new Error('Android-Buildwerkzeuge nicht gefunden. Bitte schick mir diese Fehlermeldung; dein Schlüssel wurde nicht verändert.')
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
  const project = process.env.ANKER_PROJECT ?? 'D:\\Projekt\\Anker'
  const { jar, aapt } = findTools(project)
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'
  const signer = (...args) => execute(java, ['-jar', jar, ...args])
  const certificate = (file) => {
    const text = signer('verify', '--print-certs', file)
    const matches = [...text.matchAll(/^Signer #\d+ certificate SHA-256 digest:\s*([a-fA-F0-9:]+)\s*$/gm)]
    if (matches.length !== 1 || hex(matches[0][1]) !== expected) throw new Error('Das Zertifikat stimmt nicht mit deinem Windows-Signierbericht überein. Kein neues Update wird bereitgestellt.')
  }
  const metadata = (file) => {
    const match = /package: name='([^']+)' versionCode='(\d+)'/.exec(execute(aapt, ['dump', 'badging', file]))
    if (!match || match[1] !== info.applicationId) throw new Error('Die APK gehört nicht zur erwarteten Anker-App.')
    return Number(match[2])
  }
  const nextVersion = metadata(input)
  if (nextVersion !== info.versionCode) throw new Error('Die APK-Version passt nicht zum Updatepaket.')
  const previous = join(project, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  if (existsSync(previous)) {
    certificate(previous)
    if (metadata(previous) > nextVersion) throw new Error('Deine bisherige lokale APK hat einen höheren Versionscode. Ich muss das Update passend neu bauen; Anker bleibt installiert.')
    console.log('Vorherige lokale APK: Zertifikat und Versionsfolge passen.')
  } else console.log('Keine frühere lokale APK gefunden. Android prüft beim Installieren zusätzlich die Kompatibilität zur installierten App.')
  rmSync(temporary, { force: true })
  rmSync(`${temporary}.idsig`, { force: true })
  console.log('Signiere mit deinem vorhandenen Schlüssel. Die Datei bleibt auf diesem PC.')
  signer('sign', '--ks', key, '--ks-key-alias', 'AndroidDebugKey', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', temporary, input)
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
