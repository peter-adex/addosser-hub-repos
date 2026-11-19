'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  Circle,
  ExternalLink,
  ShieldCheck,
  XCircle,
  Info,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react'

interface Notif {
  id: string
  type: string
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

const TYPE_META: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  APPROVAL_REQUIRED: {
    icon: <ShieldCheck size={13} />,
    color: '#d97706',
    bg: '#fef9c3'
  },
  APPROVED: { icon: <CheckCheck size={13} />, color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { icon: <XCircle size={13} />, color: '#dc2626', bg: '#fee2e2' },
  BUDGET_EXCEEDED: {
    icon: <AlertTriangle size={13} />,
    color: '#dc2626',
    bg: '#fee2e2'
  },
  INFO: { icon: <Info size={13} />, color: '#0284c7', bg: '#e0f2fe' }
}
const DEFAULT_META = {
  icon: <Bell size={13} />,
  color: '#6b7280',
  bg: '#f3f4f6'
}
const getMeta = (type: string) => TYPE_META[type] ?? DEFAULT_META

function timeAgo (iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationInbox () {
  const router = useRouter()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [live, setLive] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(open)

  useEffect(() => {
    isOpenRef.current = open
  }, [open])

  const loadInitialNotifications = (forceRefresh = false) => {
    if (isOpenRef.current && !forceRefresh) return

    fetch('/api/notifications?unreadOnly=true&limit=30')
      .then(r => r.json())
      .then(d => {
        if (d.success) setNotifs(d.data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadInitialNotifications()
  }, [])

  useEffect(() => {
    const handleGlobalSync = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail) {
        loadInitialNotifications(false)
        setLive(true)
      }
    }

    window.addEventListener('sync-notifications', handleGlobalSync)
    return () =>
      window.removeEventListener('sync-notifications', handleGlobalSync)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const unread = notifs.filter(n => !n.isRead).length
  const selectedNotif = notifs.find(n => n.id === selected)
  const handleSelect = async (id: string) => {
    setSelected(id)
    const n = notifs.find(x => x.id === id)
    if (n && !n.isRead) {
      setNotifs(p => p.map(x => (x.id === id ? { ...x, isRead: true } : x)))

      const updateBadgeEvent = new CustomEvent('sync-notifications', {
        detail: { unreadCount: Math.max(0, unread - 1) }
      })
      window.dispatchEvent(updateBadgeEvent)

      try {
        await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      } catch (e) {
        console.error(
          '[Notification Click Error] Failed to sync read state:',
          e
        )
      }
    }
  }

  const markAllRead = async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    setNotifs(p => p.map(x => ({ ...x, isRead: true })))

    const clearBadgeEvent = new CustomEvent('sync-notifications', {
      detail: { unreadCount: 0 }
    })
    window.dispatchEvent(clearBadgeEvent)
  }

  return (
    <div className='relative' ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className='relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground'
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center px-0.5'>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        <span
          className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border-2 border-card ${
            live ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </button>

      {open && (
        <div
          className='absolute right-0 top-12 z-50 flex shadow-2xl rounded-2xl border border-border overflow-hidden bg-card animate-fade-in'
          style={{ width: 700, height: 500 }}
        >
          <div className='w-64 flex-shrink-0 border-r border-border flex flex-col'>
            <div className='px-4 py-3 border-b border-border flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='font-bold text-sm text-foreground'>
                  Notifications
                </span>
                {live ? (
                  <Wifi size={11} className='text-green-500' />
                ) : (
                  <WifiOff size={11} className='text-gray-400' />
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className='text-[10px] text-muted-foreground hover:text-foreground'
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className='flex-1 overflow-y-auto scrollbar-thin'>
              {notifs.length === 0 ? (
                <div className='flex flex-col items-center justify-center h-full text-muted-foreground py-12'>
                  <Bell size={28} className='mb-2 opacity-30' />
                  <span className='text-xs'>No notifications</span>
                </div>
              ) : (
                notifs.map(n => {
                  const meta = getMeta(n.type)
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleSelect(n.id)}
                      className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
                        n.id === selected
                          ? 'bg-[#FFB800]/10'
                          : !n.isRead
                          ? 'bg-muted/40 hover:bg-accent/40'
                          : 'hover:bg-accent/20'
                      }`}
                    >
                      <div className='flex items-start gap-2'>
                        {!n.isRead && (
                          <Circle
                            size={6}
                            className='mt-1.5 flex-shrink-0 fill-[#FFB800] text-[#FFB800]'
                          />
                        )}
                        {n.isRead && <div className='w-[6px] flex-shrink-0' />}
                        <div className='min-w-0 w-full'>
                          <div className='flex items-center gap-1 mb-0.5'>
                            <span style={{ color: meta.color }}>
                              {meta.icon}
                            </span>
                            <span
                              className='text-[9px] font-bold uppercase tracking-wider truncate'
                              style={{ color: meta.color }}
                            >
                              {n.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div
                            className={`text-xs leading-tight truncate ${
                              !n.isRead
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {n.title}
                          </div>
                          <div className='text-[10px] text-muted-foreground mt-0.5'>
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className='flex-1 flex flex-col'>
            {selectedNotif ? (
              <>
                <div className='px-6 py-4 border-b border-border'>
                  {(() => {
                    const meta = getMeta(selectedNotif.type)
                    return (
                      <span
                        className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3'
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.icon} {selectedNotif.type.replace(/_/g, ' ')}
                      </span>
                    )
                  })()}
                  <h2 className='font-bold text-foreground text-base'>
                    {selectedNotif.title}
                  </h2>
                  <p className='text-xs text-muted-foreground mt-1'>
                    {timeAgo(selectedNotif.createdAt)}
                  </p>
                </div>

                <div className='flex-1 px-6 py-5 overflow-y-auto'>
                  <p className='text-sm text-foreground leading-relaxed whitespace-pre-wrap'>
                    {selectedNotif.message}
                  </p>
                </div>

                {selectedNotif.actionUrl && (
                  <div className='px-6 py-4 border-t border-border'>
                    <button
                      onClick={() => {
                        router.push(selectedNotif.actionUrl!)
                        setOpen(false)
                      }}
                      className='flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold'
                      style={{ background: '#FFB800', color: '#1B2A8A' }}
                    >
                      View Details <ExternalLink size={13} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className='flex flex-col items-center justify-center flex-1 text-muted-foreground'>
                <Bell size={36} className='mb-3 opacity-20' />
                <span className='text-sm font-medium'>
                  Select a notification
                </span>
                <span className='text-xs mt-1 opacity-70'>
                  Click any item to read it
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
