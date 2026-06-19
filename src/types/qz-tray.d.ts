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
