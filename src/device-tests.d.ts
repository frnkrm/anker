declare module 'virtual:anker-device-tests' {
  export const BUILD_FINGERPRINT: string
  const catalog: import('./core/deviceTests').DeviceTestCase[]
  export default catalog
}
