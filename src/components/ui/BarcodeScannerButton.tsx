import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { ModalCloseButton } from './ModalFrame'
import { normalizeBarcode } from '../../utils/barcode'

interface BarcodeScannerButtonProps {
  label?: string
  onDetected: (barcode: string) => void
  className?: string
}

interface BarcodeDetectorResult {
  rawValue: string
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): {
    detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>
  }
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

const barcodeFormats = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'itf',
  'upc_a',
  'upc_e',
  'qr_code',
]

export function BarcodeScannerButton({
  label = 'Escanear',
  onDetected,
  className,
}: BarcodeScannerButtonProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const zxingControlsRef = useRef<IScannerControls | null>(null)
  const stoppedRef = useRef(true)

  useEffect(() => {
    if (!open) return undefined

    let frameId = 0
    stoppedRef.current = false

    async function startScanner() {
      setError('')
      setStatus('Abriendo cámara...')

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('No se pudo acceder a la cámara desde este navegador.')
        setStatus('')
        return
      }

      if (!window.BarcodeDetector) {
        await startZxingScanner()
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        streamRef.current = stream

        const video = videoRef.current
        if (!video) return

        video.srcObject = stream
        await video.play()

        const detector = new window.BarcodeDetector({ formats: barcodeFormats })
        setStatus('Apunta la cámara al código de barras.')

        async function scanFrame() {
          if (stoppedRef.current) return

          const currentVideo = videoRef.current
          if (!currentVideo || currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            frameId = window.requestAnimationFrame(scanFrame)
            return
          }

          try {
            const results = await detector.detect(currentVideo)
            const detected = normalizeBarcode(results[0]?.rawValue)
            if (detected) {
              onDetected(detected)
              setOpen(false)
              return
            }
          } catch {
            // Algunos navegadores fallan en frames intermedios; el siguiente frame reintenta.
          }

          frameId = window.requestAnimationFrame(scanFrame)
        }

        frameId = window.requestAnimationFrame(scanFrame)
      } catch (err) {
        setStatus('')
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Permite el acceso a la cámara para escanear el código.')
          return
        }
        setError('No se pudo abrir la cámara. Verifica permisos o prueba desde HTTPS.')
      }
    }

    async function startZxingScanner() {
      try {
        const video = videoRef.current
        if (!video) return

        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        setStatus('Apunta la cámara al código de barras.')

        zxingControlsRef.current = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          video,
          (result) => {
            const detected = normalizeBarcode(result?.getText())
            if (!detected || stoppedRef.current) return
            onDetected(detected)
            setOpen(false)
          },
        )
      } catch (err) {
        setStatus('')
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Permite el acceso a la cámara para escanear el código.')
          return
        }
        setError('No se pudo iniciar el escáner con cámara en este navegador.')
      }
    }

    void startScanner()

    return () => {
      stoppedRef.current = true
      window.cancelAnimationFrame(frameId)
      zxingControlsRef.current?.stop()
      zxingControlsRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [open, onDetected])

  return (
    <>
      <button
        type="button"
        className={['barcode-scan-button', className].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        aria-label="Escanear código con cámara"
      >
        <span className="barcode-scan-icon" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {open && (
        <div className="barcode-scanner-backdrop" onClick={() => setOpen(false)}>
          <div className="barcode-scanner-modal" onClick={(event) => event.stopPropagation()}>
            <ModalCloseButton onClick={() => setOpen(false)} />
            <div className="barcode-scanner-header">
              <h2>Escanear código</h2>
              <p>{error || status || 'Coloca el código dentro del recuadro.'}</p>
            </div>

            <div className="barcode-scanner-preview">
              <video ref={videoRef} playsInline muted />
              <div className="barcode-scanner-frame" aria-hidden="true" />
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <button
              type="button"
              className="barcode-scanner-cancel"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
