/** Wait for the actual selected preview, including asynchronous QR SVG generation. */
export async function waitForPrintReady(root: HTMLElement): Promise<void> {
  await document.fonts?.ready
  await Promise.all([...root.querySelectorAll('img')].map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return
    await image.decode()
  }))
  if (root.querySelector('[data-qr-ready="false"]')) {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        if (root.querySelector('[data-qr-ready="false"]')) return
        cleanup(); resolve()
      }
      const observer = new MutationObserver(done)
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Der QR-Code ist noch nicht bereit. Bitte versuche es erneut.')) }, 5000)
      const cleanup = () => { observer.disconnect(); clearTimeout(timeout) }
      observer.observe(root, { attributes: true, childList: true, subtree: true })
      done()
    })
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}
