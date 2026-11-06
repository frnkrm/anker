import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [rendered, setRendered] = useState<{ value: string; svg: string }>()
  useEffect(() => {
    let active = true
    void QRCode.toString(value, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then(
      (svg) => { if (active) setRendered({ value, svg }) },
      () => { if (active) setRendered(undefined) },
    )
    return () => { active = false }
  }, [value])
  const ready = rendered?.value === value
  return <div role="img" aria-label={label} aria-busy={!ready} data-qr-ready={ready ? 'true' : 'false'} style={{ width: size, height: size }} className="overflow-hidden rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: ready ? rendered.svg : '' }} />
}
