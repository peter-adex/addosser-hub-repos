'use client'
import { createContext, useContext, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

const SyncContext = createContext({})

export function SyncProvider ({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  const prevUnreadRef = useRef<number>(-1)
  const prevInvoiceCountRef = useRef<number>(-1)
  const prevMarkerRef = useRef<string>('')
  const isFetchingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!session?.user) return

    const pollDatabaseState = async () => {
      if (isFetchingRef.current) return

      if (document.hidden) return

      isFetchingRef.current = true
      try {
        const res = await fetch(`/api/notifications/sync?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Prisma-No-Cache': 'true' }
        })
        if (!res.ok) return

        const payload = await res.json()
        if (!payload.success) return

        const { unreadCount, invoiceCount, lastUpdatedMarker } = payload.data

        if (prevUnreadRef.current === -1) {
          prevUnreadRef.current = unreadCount
          prevInvoiceCountRef.current = invoiceCount
          prevMarkerRef.current = lastUpdatedMarker
          return
        }

        if (unreadCount !== prevUnreadRef.current) {
          console.log(
            `[Sync Engine] Unread alert count shifted to ${unreadCount}. Dispatching local view signals.`
          )
          prevUnreadRef.current = unreadCount

          const notifEvent = new CustomEvent('sync-notifications', {
            detail: { unreadCount }
          })
          window.dispatchEvent(notifEvent)
        }

        const totalRowsShift = invoiceCount !== prevInvoiceCountRef.current
        const recordModificationShift =
          lastUpdatedMarker !== prevMarkerRef.current

        if (totalRowsShift || recordModificationShift) {
          console.log(
            '[Sync Engine] Invoice data change detected. Broadcasting sync event.'
          )
          prevInvoiceCountRef.current = invoiceCount
          prevMarkerRef.current = lastUpdatedMarker

          window.dispatchEvent(
            new CustomEvent('sync-invoices-changed', {
              detail: { invoiceCount, lastUpdatedMarker }
            })
          )
        }
      } catch (e) {
        console.warn(
          '[Sync Engine] Background heartbeat skipped pass safely:',
          e
        )
      } finally {
        isFetchingRef.current = false
      }
    }

    pollDatabaseState()

    const heartbeatTimer = setInterval(pollDatabaseState, 8000)

    return () => clearInterval(heartbeatTimer)
  }, [session])

  return <SyncContext.Provider value={{}}>{children}</SyncContext.Provider>
}

export const useSync = () => useContext(SyncContext)
