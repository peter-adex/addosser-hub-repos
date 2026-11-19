'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldX, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { PermissionAction } from '@/hooks/useAuth'

interface PermissionGuardProps {
  module: string
  action?: PermissionAction
  children: React.ReactNode
  fallbackHref?: string
}

export function PermissionGuard ({
  module,
  action = 'canView',
  children,
  fallbackHref
}: PermissionGuardProps) {
  const { user, isLoading, hasPermission } = useAuth()
  const router = useRouter()

  const allowed = hasPermission(module, action)

  useEffect(() => {
    if (!isLoading && user && !user.permissions?.length && fallbackHref) {
      router.replace(fallbackHref)
    }
  }, [isLoading, user, fallbackHref, router])

  if (isLoading || !user) {
    return (
      <div className='flex items-center justify-center min-h-[300px]'>
        <Loader2 size={24} className='animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!user.permissions?.length) {
    return (
      <AccessDeniedUI
        title='Session Outdated'
        message="Your session doesn't include role permissions. Please sign out and sign back in to refresh your access."
        showReloginButton
      />
    )
  }

  if (!allowed) {
    return (
      <AccessDeniedUI
        title='Access Denied'
        message={`You don't have permission to access this module. Contact your administrator to request access.`}
        module={module}
        action={action}
      />
    )
  }

  return <>{children}</>
}

function AccessDeniedUI ({
  title,
  message,
  module,
  action,
  showReloginButton
}: {
  title: string
  message: string
  module?: string
  action?: string
  showReloginButton?: boolean
}) {
  const { clearAuth } = useAuth()

  return (
    <div className='flex flex-col items-center justify-center min-h-[400px] text-center px-4'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 mb-4'>
        <ShieldX size={28} className='text-red-500' />
      </div>

      <h2 className='text-[18px] font-bold text-foreground mb-2'>{title}</h2>
      <p className='text-[13px] text-muted-foreground max-w-md leading-relaxed mb-6'>
        {message}
      </p>

      {module && action && (
        <p className='text-[11px] text-muted-foreground/60 mb-6'>
          Required:{' '}
          <code className='bg-muted px-1.5 py-0.5 rounded text-[10px]'>
            {module}.{action}
          </code>
        </p>
      )}

      <div className='flex items-center gap-3'>
        {showReloginButton ? (
          <button
            onClick={() => clearAuth()}
            className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy/90 transition-colors'
          >
            Sign Out & Re-login
          </button>
        ) : (
          <button
            onClick={() => window.history.back()}
            className='inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted transition-colors'
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  )
}

export function usePagePermissions (module: string) {
  const { user, hasPermission } = useAuth()

  return {
    canView: hasPermission(module, 'canView'),
    canCreate: hasPermission(module, 'canCreate'),
    canEdit: hasPermission(module, 'canEdit'),
    canDelete: hasPermission(module, 'canDelete'),
    canExport: hasPermission(module, 'canExport'),
    canApprove: hasPermission(module, 'canApprove'),
    isAdmin: user?.role === 'admin',
    user
  }
}
