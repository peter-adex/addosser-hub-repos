'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const SAFETY_TIMEOUT_MS = 8000

export default function RouteProgress() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setVisible(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [pathname, searchParams])

  useEffect(() => {
    function isModifiedClick(e: MouseEvent) {
      return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
    }

    function handleClick(e: MouseEvent) {
      if (isModifiedClick(e)) return

      const anchor = (e.target as HTMLElement)?.closest?.('a')
      if (!anchor) return
      if (anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      setVisible(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setVisible(false), SAFETY_TIMEOUT_MS)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className='fixed top-0 left-0 right-0 z-[10000] h-[3px] bg-transparent pointer-events-none'>
      <div className='h-full bg-[#FFB800] animate-route-progress origin-left' />
    </div>
  )
}
