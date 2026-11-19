'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ActionRow { id: string; key: string; label: string; granted: boolean }
export interface PageRow { id: string; key: string; label: string; href: string; actions: ActionRow[] }
export interface ModuleTree { key: string; label: string; icon: string | null; pages: PageRow[] }

export function useModulePermissions(roleId: string, moduleKey: string, enabled: boolean = true) {
  const [tree, setTree] = useState<ModuleTree | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/roles/${roleId}/page-permissions?moduleKey=${moduleKey}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load permission tree')
      setTree(data.data)
      setDirty(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [roleId, moduleKey, enabled])

  useEffect(() => {
    if (enabled && !tree && !loading) load()
  }, [enabled])

  const toggleAction = (pageId: string, actionId: string) => {
    setTree(prev => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id !== pageId
            ? p
            : { ...p, actions: p.actions.map(a => a.id === actionId ? { ...a, granted: !a.granted } : a) }
        )
      }
    })
    setDirty(true)
  }

  const togglePageAll = (pageId: string, value: boolean) => {
    setTree(prev => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map(p => p.id !== pageId ? p : { ...p, actions: p.actions.map(a => ({ ...a, granted: value })) })
      }
    })
    setDirty(true)
  }

  const toggleModuleAll = (value: boolean) => {
    setTree(prev => {
      if (!prev) return prev
      return { ...prev, pages: prev.pages.map(p => ({ ...p, actions: p.actions.map(a => ({ ...a, granted: value })) })) }
    })
    setDirty(true)
  }

  const save = async () => {
    if (!tree) return
    setSaving(true)
    setError('')
    try {
      const grants = tree.pages.flatMap(p => p.actions.map(a => ({ pageId: p.id, actionId: a.id, granted: a.granted })))
      const res = await fetch(`/api/roles/${roleId}/page-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleKey, grants })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setDirty(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const grantedCount = tree ? tree.pages.reduce((s, p) => s + p.actions.filter(a => a.granted).length, 0) : null
  const totalCount = tree ? tree.pages.reduce((s, p) => s + p.actions.length, 0) : null

  const matchesQuery = useCallback((query: string): boolean | null => {
    if (!query.trim()) return true
    if (!tree) return null
    const q = query.trim().toLowerCase()
    return tree.pages.some(p => p.label.toLowerCase().includes(q) || p.actions.some(a => a.label.toLowerCase().includes(q)))
  }, [tree])

  return {
    tree, loading, saving, dirty, error,
    toggleAction, togglePageAll, toggleModuleAll, save, reload: load,
    grantedCount, totalCount, matchesQuery,
  }
}
