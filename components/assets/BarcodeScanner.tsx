'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'

import { BarcodeFormat, DecodeHintType } from '@zxing/library'

import { ScanLine, X, Camera, Keyboard } from 'lucide-react'

interface Props {
  onScan: (value: string) => void
  currentValue: string
}

export default function BarcodeScanner ({ onScan, currentValue }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [manualInput, setManualInput] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'scanning' | 'detected' | 'error'
  >('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [cameraSupported, setCameraSupported] = useState(false)

  const [cameraPermission, setCameraPermission] = useState<
    'unknown' | 'granted' | 'denied'
  >('unknown')

  const videoRef = useRef<HTMLVideoElement>(null)

  const controlsRef = useRef<IScannerControls | null>(null)

  const readerRef = useRef<BrowserMultiFormatReader | null>(null)

  const lastCodeRef = useRef('')

  useEffect(() => {
    const supported =
      !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia

    setCameraSupported(supported)

    console.log('Camera Supported:', supported)
  }, [])

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop()
    } catch {}

    controlsRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setStatus('idle')
  }, [])

  const hints = useRef(
    new Map([
      [
        DecodeHintType.POSSIBLE_FORMATS,
        [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX
        ]
      ]
    ])
  )

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader(hints.current)

    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      setMode('manual')
      return
    }

    if (!readerRef.current) return

    setStatus('scanning')
    setErrorMsg('')

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()

      console.table(devices)

      if (!devices.length) {
        throw new Error('No camera found.')
      }

      const preferredCamera =
        devices.find(d => d.label.includes('HP HD Camera')) ??
        devices.find(d => !d.label.toLowerCase().includes('camo')) ??
        devices[0]

      console.log('Using camera:', preferredCamera.label)

      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        preferredCamera.deviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            console.log('Format:', result.getBarcodeFormat().toString())
            console.log('Text:', result.getText())

            const code = result.getText()

            if (lastCodeRef.current === code) {
              return
            }

            lastCodeRef.current = code

            setStatus('detected')

            onScan(code)

            stopCamera()

            setTimeout(() => {
              setOpen(false)
            }, 150)

            return
          }

          if (error) {
            if (
              error.name !== 'NotFoundException' &&
              error.name !== 'ChecksumException' &&
              error.name !== 'FormatException'
            ) {
              console.error('ZXing Error:', error)
            }
          }
        }
      )

      setCameraPermission('granted')
    } catch (err: any) {
      console.error(err)

      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError'
      ) {
        setCameraPermission('denied')

        setErrorMsg('Camera permission denied.')
      } else {
        setErrorMsg(err.message || 'Unable to access camera.')
      }

      setStatus('error')
    }
  }, [cameraSupported, onScan, stopCamera])

  useEffect(() => {
    if (open && mode === 'scan') {
      startCamera()
    }

    return () => stopCamera()
  }, [open, mode, startCamera, stopCamera])

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return
    onScan(manualInput.trim())
    setManualInput('')
    setOpen(false)
  }

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-sm font-semibold text-foreground'
      >
        <ScanLine size={16} className='text-[#1B2A8A] dark:text-blue-400' />
        {currentValue ? (
          <span className='font-mono text-xs'>{currentValue}</span>
        ) : (
          <span>Scan Barcode</span>
        )}
      </button>

      {open && (
        <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4'>
          <div className='bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
              <h3 className='font-bold text-foreground flex items-center gap-2'>
                <ScanLine size={18} className='text-[#1B2A8A]' />
                Barcode Scanner
              </h3>
              <button
                onClick={() => {
                  setOpen(false)
                  stopCamera()
                }}
                className='p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground'
              >
                <X size={18} />
              </button>
            </div>

            <div className='flex border-b border-border'>
              {[
                ['scan', 'Camera', 'Camera'] as const,
                ['manual', 'Manual', 'Keyboard'] as const
              ].map(([m, label]) => (
                <button
                  key={m}
                  type='button'
                  onClick={() => {
                    stopCamera()
                    setMode(m)
                    setStatus('idle')
                  }}
                  className='flex-1 py-2.5 text-sm font-semibold transition-colors'
                  style={{
                    color:
                      mode === m ? '#1B2A8A' : 'hsl(var(--muted-foreground))',
                    borderBottom:
                      mode === m
                        ? '2px solid #1B2A8A'
                        : '2px solid transparent',
                    background: mode === m ? '#EEF2FF' : 'transparent'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className='p-5'>
              {mode === 'scan' ? (
                <div>
                  <div className='relative rounded-xl overflow-hidden bg-black aspect-video mb-3'>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className='w-full h-full object-cover'
                    />
                    {status === 'scanning' && (
                      <div className='absolute inset-0 flex flex-col items-center justify-center'>
                        <div className='w-48 h-48 border-2 border-[#FFB800] rounded-xl relative'>
                          <div className='absolute inset-0 flex items-center'>
                            <div className='w-full h-0.5 bg-[#FFB800] opacity-80 animate-pulse' />
                          </div>
                        </div>
                        <p className='text-white/70 text-xs mt-3'>
                          Point camera at barcode
                        </p>
                      </div>
                    )}
                    {status === 'detected' && (
                      <div className='absolute inset-0 flex items-center justify-center bg-green-500/20'>
                        <div className='bg-green-500 text-white px-4 py-2 rounded-xl font-bold text-sm'>
                          ✓ Barcode detected!
                        </div>
                      </div>
                    )}
                    {status === 'error' && (
                      <div className='absolute inset-0 flex items-center justify-center p-4'>
                        <div className='text-center'>
                          <p className='text-red-400 text-sm mb-3'>
                            {errorMsg}
                          </p>
                          <button
                            onClick={() => setMode('manual')}
                            className='px-4 py-2 rounded-xl text-sm font-bold bg-[#FFB800] text-[#1B2A8A]'
                          >
                            Use Manual Entry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {cameraPermission === 'denied' && (
                    <p className='text-xs text-red-500 text-center'>
                      Camera permission was denied. Please allow camera access
                      or use manual entry.
                    </p>
                  )}
                </div>
              ) : (
                <div className='space-y-3'>
                  <p className='text-sm text-muted-foreground'>
                    Type or paste the barcode / asset tag value manually.
                  </p>
                  <input
                    type='text'
                    autoFocus
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                    placeholder='e.g. AFL/HO/000005 or 1234567890128'
                    className='w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] font-mono'
                  />
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim()}
                    className='w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50'
                    style={{ background: '#FFB800', color: '#1B2A8A' }}
                  >
                    Apply Barcode
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
