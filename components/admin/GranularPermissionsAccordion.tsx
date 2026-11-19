'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck, Search } from 'lucide-react'
import { useModulePermissions } from '@/hooks/useModulePermissions'

interface ModuleSummary { key: string; label: string; icon: string | null; totalActions: number; grantedActions: number }

function ModuleAccordionItem ({
  roleId,
  summary,
  isOpen,
  isMounted,
  searchQuery,
  onToggle,
  onMatchResolved,
  disabled
}: {
  roleId: string
  summary: ModuleSummary
  isOpen: boolean
  isMounted: boolean
  searchQuery: string
  onToggle: () => void
  onMatchResolved: (moduleKey: string, matches: boolean) => void
  disabled: boolean
}) {
  const {
    tree, loading, saving, dirty, error,
    toggleAction, togglePageAll, toggleModuleAll, save,
    grantedCount, totalCount, matchesQuery,
  } = useModulePermissions(roleId, summary.key, isMounted)

  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!searchQuery.trim()) return
    const result = matchesQuery(searchQuery)
    if (result !== null) onMatchResolved(summary.key, result)
  }, [searchQuery, tree])

  const granted = grantedCount ?? summary.grantedActions
  const total = totalCount ?? summary.totalActions

  return (
    <div className='border border-border rounded-xl overflow-hidden bg-card'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 text-left transition-colors'
      >
        <div className='flex items-center gap-2.5'>
          {isOpen ? <ChevronDown size={16} className='text-muted-foreground flex-shrink-0' /> : <ChevronRight size={16} className='text-muted-foreground flex-shrink-0' />}
          <span className='text-base'>{summary.icon}</span>
          <span className='text-sm font-bold text-foreground'>{summary.label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${granted === total && total > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : granted > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
          {granted}/{total}
        </span>
      </button>

      {isMounted && (
        <div className={isOpen ? '' : 'hidden'}>
          {loading && !tree && (
            <div className='py-6 text-center text-xs text-muted-foreground'>Loading {summary.label} permissions…</div>
          )}
          {error && !tree && (
            <div className='px-5 py-3 text-xs text-red-600'>⚠️ {error}</div>
          )}
          {tree && (
            <div className='border-t border-border'>
              <div className='px-5 py-3 flex items-center justify-between flex-wrap gap-2 bg-muted/20'>
                <div className='flex items-center gap-2'>
                  <button type='button' disabled={disabled} onClick={() => toggleModuleAll(true)} className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50'>Select All</button>
                  <button type='button' disabled={disabled} onClick={() => toggleModuleAll(false)} className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50'>Clear All</button>
                </div>
                <button type='button' disabled={disabled || saving || !dirty} onClick={save} className='px-4 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50' style={{ background: '#FFB800', color: '#1B2A8A' }}>
                  {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
                </button>
              </div>

              <div className='divide-y divide-border'>
                {tree.pages
                  .filter(p => {
                    if (!searchQuery.trim()) return true
                    const q = searchQuery.trim().toLowerCase()
                    return p.label.toLowerCase().includes(q) || p.actions.some(a => a.label.toLowerCase().includes(q))
                  })
                  .map(page => {
                    const grantedPageCount = page.actions.filter(a => a.granted).length
                    const allGranted = grantedPageCount === page.actions.length && page.actions.length > 0
                    const isPageOpen = expandedPages.has(page.id) || !!searchQuery.trim()
                    return (
                      <div key={page.id}>
                        <button
                          type='button'
                          onClick={() => setExpandedPages(prev => { const n = new Set(prev); n.has(page.id) ? n.delete(page.id) : n.add(page.id); return n })}
                          className='w-full flex items-center justify-between px-5 py-2.5 hover:bg-accent/20 text-left'
                        >
                          <div className='flex items-center gap-2'>
                            {isPageOpen ? <ChevronDown size={13} className='text-muted-foreground' /> : <ChevronRight size={13} className='text-muted-foreground' />}
                            <span className='text-xs font-semibold text-foreground'>{page.label}</span>
                          </div>
                          <div className='flex items-center gap-3'>
                            <span className={`text-[11px] font-semibold ${allGranted ? 'text-green-600' : grantedPageCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{grantedPageCount}/{page.actions.length}</span>
                            <span role='button' tabIndex={0} onClick={(e) => { e.stopPropagation(); if (!disabled) togglePageAll(page.id, !allGranted) }} className='text-[10px] font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'>
                              {allGranted ? 'Clear' : 'Select all'}
                            </span>
                          </div>
                        </button>
                        {isPageOpen && (
                          <div className='px-5 pb-3 pl-9 flex flex-wrap gap-3'>
                            {page.actions
                              .filter(a => !searchQuery.trim() || page.label.toLowerCase().includes(searchQuery.trim().toLowerCase()) || a.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                              .map(action => (
                                <label key={action.id} className='flex items-center gap-1.5 cursor-pointer select-none'>
                                  <input type='checkbox' checked={action.granted} disabled={disabled} onChange={() => toggleAction(page.id, action.id)} className='w-3.5 h-3.5 accent-[#FFB800] cursor-pointer disabled:cursor-not-allowed' />
                                  <span className='text-[11px] text-foreground'>{action.label}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GranularPermissionsAccordion ({
  roleId,
  disabled = false
}: {
  roleId: string
  disabled?: boolean
}) {
  const [summaries, setSummaries] = useState<ModuleSummary[] | null>(null)
  const [error, setError] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [mountedKeys, setMountedKeys] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [searchMatches, setSearchMatches] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setSummaries(null)
    setOpenKey(null)
    setMountedKeys(new Set())
    setSearchMatches({})
    fetch(`/api/roles/${roleId}/page-permissions/summary`)
      .then(r => r.json())
      .then(d => { if (d.success) setSummaries(d.data); else setError(d.error ?? 'Failed to load modules') })
      .catch(() => setError('Failed to load modules'))
  }, [roleId])

  useEffect(() => {
    if (!search.trim() || !summaries) return
    setMountedKeys(prev => {
      const next = new Set(prev)
      summaries.forEach(s => next.add(s.key))
      return next
    })
  }, [search, summaries])

  const handleToggle = (key: string) => {
    setOpenKey(prev => (prev === key ? null : key))
    setMountedKeys(prev => { const next = new Set(prev); next.add(key); return next })
  }

  const handleMatchResolved = (moduleKey: string, matches: boolean) => {
    setSearchMatches(prev => (prev[moduleKey] === matches ? prev : { ...prev, [moduleKey]: matches }))
  }

  useEffect(() => {
    if (!search.trim()) return
    const firstMatch = summaries?.find(s => s.label.toLowerCase().includes(search.trim().toLowerCase()) || searchMatches[s.key])
    if (firstMatch) setOpenKey(firstMatch.key)
  }, [search, searchMatches])

  const visibleSummaries = useMemo(() => {
    if (!summaries) return []
    if (!search.trim()) return summaries
    const q = search.trim().toLowerCase()
    return summaries.filter(s => {
      if (s.label.toLowerCase().includes(q)) return true
      return searchMatches[s.key] ?? true
    })
  }, [summaries, search, searchMatches])

  if (error) return <div className='py-4 text-sm text-red-600'>⚠️ {error}</div>
  if (!summaries) return <div className='py-8 text-center text-sm text-muted-foreground'>Loading permission modules…</div>

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          <ShieldCheck size={18} className='text-[#1B2A8A] dark:text-blue-400' />
          <span className='font-bold text-sm text-foreground'>Granular Permissions</span>
        </div>
        <div className='relative'>
          <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search permissions…'
            className='pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs w-56 focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
          />
        </div>
      </div>

      {visibleSummaries.length === 0 ? (
        <div className='py-6 text-center text-xs text-muted-foreground'>No modules or permissions match "{search}"</div>
      ) : (
        <div className='space-y-2'>
          {visibleSummaries.map(s => (
            <ModuleAccordionItem
              key={s.key}
              roleId={roleId}
              summary={s}
              isOpen={openKey === s.key}
              isMounted={mountedKeys.has(s.key)}
              searchQuery={search}
              onToggle={() => handleToggle(s.key)}
              onMatchResolved={handleMatchResolved}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}
