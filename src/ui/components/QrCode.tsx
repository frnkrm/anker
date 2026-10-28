import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    void QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then(setSvg)
  }, [value])
  return <div role="img" aria-label={label} style={{ width: size, height: size }} className="overflow-hidden rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
}
