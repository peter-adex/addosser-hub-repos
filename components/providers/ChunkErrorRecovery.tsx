'use client'

import { useEffect } from 'react'

const RELOAD_GUARD_KEY = 'addosser-chunk-error-reload-attempted'

function isChunkLoadError(message: unknown): boolean {
  if (typeof message !== 'string') return false
  return /ChunkLoadError|Loading chunk [\w.-]+ failed|Loading CSS chunk [\w.-]+ failed/i.test(
    message
  )
}

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const recover = () => {
      if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.message) || isChunkLoadError(event.error?.message)) {
        recover()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = typeof reason === 'string' ? reason : reason?.message
      if (isChunkLoadError(message)) {
        recover()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => sessionStorage.removeItem(RELOAD_GUARD_KEY), 15000)
    return () => clearTimeout(t)
  }, [])

  return null
}
