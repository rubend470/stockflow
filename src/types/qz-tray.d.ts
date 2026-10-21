declare module 'qz-tray' {
  interface QzConfig {
    printer: string
    options?: Record<string, unknown>
  }

  interface QzRawData {
    type: 'raw' | 'pixel'
    format: 'command' | 'html'
    flavor: 'plain'
    data: string | string[]
  }

  const qz: {
    security: {
      setCertificatePromise: (
        promiseHandler: () => Promise<string>,
        options?: { rejectOnFailure?: boolean },
      ) => void
      setSignaturePromise: (
        promiseFactory: (dataToSign: string) => Promise<string>,
      ) => void
      setSignatureAlgorithm: (algorithm: 'SHA1' | 'SHA256' | 'SHA512') => void
    }
    websocket: {
      connect: () => Promise<void>
      disconnect: () => Promise<void>
      isActive: () => boolean
    }
    printers: {
      find: (query?: string) => Promise<string[] | string>
      getDefault: () => Promise<string>
    }
    configs: {
      create: (printer: string, options?: Record<string, unknown>) => QzConfig
    }
    print: (config: QzConfig, data: Array<QzRawData | string>) => Promise<void>
  }

  export default qz
}
