'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { useModulePermissions } from '@/hooks/useModulePermissions'

export default function GranularPermissionsPanel ({
  roleId,
  moduleKey,
  disabled = false
}: {
  roleId: string
  moduleKey: string
  disabled?: boolean
}) {
  const {
    tree, loading, saving, dirty, error,
    toggleAction, togglePageAll, toggleModuleAll, save,
    grantedCount, totalCount,
  } = useModulePermissions(roleId, moduleKey)

  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())
  const togglePageExpand = (pageId: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId); else next.add(pageId)
      return next
    })
  }

  if (loading && !tree) {
    return <div className='py-8 text-center text-sm text-muted-foreground'>Loading permission tree…</div>
  }
  if (error && !tree) {
    return <div className='py-4 text-sm text-red-600'>⚠️ {error}</div>
  }
  if (!tree) return null

  return (
    <div className='border border-border rounded-2xl overflow-hidden'>
      <div className='px-5 py-4 bg-muted/30 border-b border-border flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          <ShieldCheck size={18} className='text-[#1B2A8A] dark:text-blue-400' />
          <div>
            <div className='font-bold text-sm text-foreground'>{tree.icon} {tree.label} — Granular Permissions</div>
            <div className='text-xs text-muted-foreground'>{tree.pages.length} pages · {grantedCount}/{totalCount} permissions granted</div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <button type='button' disabled={disabled} onClick={() => toggleModuleAll(true)} className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50'>Select All</button>
          <button type='button' disabled={disabled} onClick={() => toggleModuleAll(false)} className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50'>Clear All</button>
          <button type='button' disabled={disabled || saving || !dirty} onClick={save} className='px-4 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50' style={{ background: '#FFB800', color: '#1B2A8A' }}>
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {error && <div className='px-5 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20'>⚠️ {error}</div>}

      <div className='divide-y divide-border'>
        {tree.pages.map(page => {
          const grantedPageCount = page.actions.filter(a => a.granted).length
          const allGranted = grantedPageCount === page.actions.length && page.actions.length > 0
          const isOpen = expandedPages.has(page.id)
          return (
            <div key={page.id}>
              <button type='button' onClick={() => togglePageExpand(page.id)} className='w-full flex items-center justify-between px-5 py-3 hover:bg-accent/30 text-left'>
                <div className='flex items-center gap-2'>
                  {isOpen ? <ChevronDown size={15} className='text-muted-foreground' /> : <ChevronRight size={15} className='text-muted-foreground' />}
                  <span className='text-sm font-semibold text-foreground'>{page.label}</span>
                  <code className='text-[10px] text-muted-foreground'>{page.href}</code>
                </div>
                <div className='flex items-center gap-3'>
                  <span className={`text-xs font-semibold ${allGranted ? 'text-green-600' : grantedPageCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{grantedPageCount}/{page.actions.length}</span>
                  <span role='button' tabIndex={0} onClick={(e) => { e.stopPropagation(); if (!disabled) togglePageAll(page.id, !allGranted) }} className='text-[11px] font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'>
                    {allGranted ? 'Clear' : 'Select all'}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className='px-5 pb-4 pl-11 flex flex-wrap gap-4'>
                  {page.actions.map(action => (
                    <label key={action.id} className='flex items-center gap-2 cursor-pointer select-none'>
                      <input type='checkbox' checked={action.granted} disabled={disabled} onChange={() => toggleAction(page.id, action.id)} className='w-4 h-4 accent-[#FFB800] cursor-pointer disabled:cursor-not-allowed' />
                      <span className='text-xs text-foreground'>{action.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
