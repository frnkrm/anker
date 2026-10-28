import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNative } from './native'

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Speichert bzw. teilt eine Datei: im Browser als Download, auf Android über das Teilen-Menü. */
export async function saveFile(name: string, content: string | Uint8Array, mime: string): Promise<void> {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
  if (isNative()) {
    const res = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache })
    await Share.share({ title: name, files: [res.uri] })
    return
  }
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Lässt den Nutzer eine Textdatei auswählen (Backup-Import). */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async () => {
      const f = input.files?.[0]
      resolve(f ? await f.text() : null)
    }
    input.click()
  })
}
