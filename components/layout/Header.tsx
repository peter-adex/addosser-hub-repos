<<<<<<< HEAD
'use client'
import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Moon, Sun, LogOut, ChevronDown, User } from 'lucide-react'
import NotificationInbox from '@/components/notifications/NotificationInbox'

export default function Header () {
  const { theme, setTheme } = useTheme()
  const user = useCurrentUser()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const eventSource = new EventSource(`/api/sse?userId=${user.id}`)

    eventSource.addEventListener('notification', () => {
      console.log(
        '[Realtime Sync] New notification arrived. Broadcasting sync event.'
      )
      window.dispatchEvent(new CustomEvent('sync-notifications'))
    })

    eventSource.addEventListener('invoice_update', () => {
      console.log(
        '[Realtime Sync] Invoice row modified. Broadcasting sync event.'
      )
      window.dispatchEvent(new CustomEvent('sync-invoices-changed'))
    })

    return () => {
      eventSource.close()
    }
  }, [user?.id])

  return (
    <header className='h-[62px] flex items-center justify-between px-6 lg:px-8 border-b border-border bg-card flex-shrink-0 z-40'>
      <div className='flex items-center gap-3'>
        <div className='flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-2 w-64 focus-within:ring-2 focus-within:ring-[#FFB800] transition-all'>
          <span className='text-muted-foreground text-sm select-none'>🔍</span>
          <input
            placeholder='Search across modules…'
            className='bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-full'
=======
"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Moon, Sun, Bell, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-[62px] flex items-center justify-between px-6 lg:px-8 border-b border-border bg-card flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-2 w-64">
          <span className="text-muted-foreground text-sm">🔍</span>
          <input
            placeholder="Search across modules..."
            className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          />
        </div>
      </div>

<<<<<<< HEAD
      <div className='flex items-center gap-3'>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className='p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground'
          aria-label='Toggle colour theme'
        >
          {mounted ? (
            theme === 'dark' ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )
          ) : (
            <Moon size={18} />
          )}
        </button>

        <NotificationInbox />

        <div className='relative'>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className='flex items-center gap-2 pl-3 border-l border-border hover:opacity-80 transition-opacity'
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name ?? ''}
                className='w-8 h-8 rounded-full object-cover'
              />
            ) : (
              <div className='w-8 h-8 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold'>
                {user?.name?.slice(0, 2).toUpperCase() ?? '??'}
              </div>
            )}
            <div className='hidden md:block text-left'>
              <div className='text-sm font-semibold text-foreground leading-tight max-w-[120px] truncate'>
                {user?.name}
              </div>
              <div className='text-xs text-muted-foreground max-w-[120px] truncate'>
                {user?.roleName}
              </div>
            </div>
            <ChevronDown size={14} className='text-muted-foreground' />
          </button>

          {menuOpen && (
            <div className='absolute right-0 top-12 w-56 bg-card border border-border rounded-xl shadow-xl py-2 z-50 animate-fade-in'>
              <div className='px-4 py-2.5 border-b border-border'>
                <div className='text-xs font-semibold text-foreground truncate'>
                  {user?.entityName}
                </div>
                <div className='text-xs text-muted-foreground truncate'>
                  {user?.email}
                </div>
              </div>
              <button
                onClick={() => {
                  router.push('/profile')
                  setMenuOpen(false)
                }}
                className='w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors'
              >
                <User size={14} className='text-muted-foreground' />
                My Profile
              </button>
              <button
                onClick={() => {
                  signOut({ redirect: false }).finally(() => {
                    window.location.href = '/login'
                  })
                }}
                className='w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors'
=======
      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-4 border-l border-border hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold">
              {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-semibold text-foreground leading-tight">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.roleName}</div>
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 w-52 bg-card border border-border rounded-xl shadow-lg py-2 z-50">
              <div className="px-4 py-2 border-b border-border">
                <div className="text-xs font-semibold text-foreground truncate">{user?.entityName}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
<<<<<<< HEAD
  )
=======
  );
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
