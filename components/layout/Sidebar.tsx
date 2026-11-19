<<<<<<< HEAD
'use client'

import { useState, useMemo, createContext, useContext } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { isRouteActive, isWithinSection } from '@/lib/route-matching'

const AllHrefsContext = createContext<string[]>([])

function NavLink ({
  href,
  label,
  icon,
  collapsed,
  sub = false
}: {
  href: string
  label: string
  icon: string
  collapsed: boolean
  sub?: boolean
}) {
  const pathname = usePathname()
  const allHrefs = useContext(AllHrefsContext)
  const active = isRouteActive(pathname, href, allHrefs)
=======
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞", app: null },
  { href: "/budgeting", label: "Budgeting", icon: "📊", app: "budgeting" as const },
  { href: "/assets", label: "Asset Management", icon: "🏗️", app: "assets" as const },
  { href: "/facility", label: "Facility Management", icon: "🏢", app: "facility" as const },
  { href: "/invoice", label: "Invoice Processing", icon: "🧾", app: "invoice" as const },
  { href: "/fleet", label: "Fleet Management", icon: "🚗", app: "fleet" as const },
];

function NavItem({ href, label, icon, collapsed }: { href: string; label: string; icon: string; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  return (
    <Link
      href={href}
      className={cn(
<<<<<<< HEAD
        'flex items-center gap-2.5 rounded-xl transition-all duration-150 font-medium',
        collapsed
          ? 'justify-center px-3 py-3'
          : sub
          ? 'px-3 py-2 text-xs ml-4'
          : 'px-4 py-2.5 text-sm',
        active
          ? 'bg-[#FFB800] text-[#1B2A8A] font-bold shadow-sm'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      <span className={cn('flex-shrink-0', sub ? 'text-sm' : 'text-lg')}>
        {icon}
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}

function NavGroup ({
  href,
  label,
  icon,
  collapsed,
  subItems
}: {
  href: string
  label: string
  icon: string
  collapsed: boolean
  subItems: { href: string; label: string; icon: string }[]
}) {
  const pathname = usePathname()
  const isActive = isWithinSection(pathname, href)
  const [open, setOpen] = useState(isActive)

  if (collapsed) {
    return (
      <Link
        href={href}
        className={cn(
          'flex justify-center items-center rounded-xl transition-all px-3 py-3',
          isActive
            ? 'bg-[#FFB800] text-[#1B2A8A]'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <span className='text-lg'>{icon}</span>
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
          isActive && !open
            ? 'bg-[#FFB800]/20 text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <span className='text-lg flex-shrink-0'>{icon}</span>
        <span className='flex-1 text-left'>{label}</span>
        {open ? (
          <ChevronDown size={13} className='opacity-60' />
        ) : (
          <ChevronRight size={13} className='opacity-60' />
        )}
      </button>

      {open && (
        <div className='mt-0.5 space-y-0.5'>
          {subItems.map(sub => (
            <NavLink key={sub.href} {...sub} collapsed={false} sub />
          ))}
        </div>
      )}
    </div>
  )
}

interface AccessiblePage {
  key: string
  label: string
  icon: string | null
  href: string
  sortOrder: number
  actions: string[]
}
interface AccessibleModule {
  key: string
  label: string
  icon: string | null
  section: string | null
  href: string | null
  sortOrder: number
  pages: AccessiblePage[]
}

export default function Sidebar ({
  modules,
  hasMasterDashboard
}: {
  modules: AccessibleModule[]
  hasMasterDashboard: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const user = useCurrentUser()

  const allHrefs = useMemo(() => {
    const moduleHrefs = modules.flatMap(m => m.pages.map(p => p.href))
    return [...moduleHrefs, '/dashboard', '/admin', '/audit']
  }, [modules])

  return (
    <AllHrefsContext.Provider value={allHrefs}>
    <aside
      className={cn(
        'flex flex-col h-full flex-shrink-0 transition-all duration-250 overflow-hidden bg-[#1B2A8A]',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 border-b border-white/10',
          collapsed ? 'justify-center p-4' : 'px-5 py-5'
        )}
      >
        <Image
          src='/logo.png'
          alt='Addosser'
          width={collapsed ? 36 : 40}
          height={collapsed ? 36 : 40}
          className='rounded-lg flex-shrink-0 object-contain'
        />
        {!collapsed && (
          <div>
            <div className='text-[#FFB800] font-extrabold text-sm leading-tight tracking-wide'>
              ADDOSSER
            </div>
            <div className='text-white/40 text-[9px] uppercase tracking-[0.12em]'>
              Enterprise Hub
            </div>
=======
        "flex items-center gap-3 rounded-xl transition-all duration-150 font-medium text-sm",
        collapsed ? "justify-center px-3 py-3" : "px-4 py-2.5",
        active
          ? "bg-[#FFB800] text-[#1B2A8A] font-bold shadow-sm"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useCurrentUser();

  // Filter nav items based on permissions
  const canViewBudgeting = usePermission("budgeting", "canView");
  const canViewAssets = usePermission("assets", "canView");
  const canViewFacility = usePermission("facility", "canView");
  const canViewInvoice = usePermission("invoice", "canView");
  const canViewFleet = usePermission("fleet", "canView");

  const permMap: Record<string, boolean> = {
    budgeting: canViewBudgeting,
    assets: canViewAssets,
    facility: canViewFacility,
    invoice: canViewInvoice,
    fleet: canViewFleet,
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.app || permMap[item.app]);

  return (
    <aside
      className={cn(
        "flex flex-col h-full flex-shrink-0 transition-all duration-250 overflow-hidden",
        "bg-[#1B2A8A]",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 border-b border-white/10", collapsed ? "justify-center p-4" : "px-5 py-5")}>
        <Image src="/logo.png" alt="Addosser" width={collapsed ? 36 : 40} height={collapsed ? 36 : 40} className="rounded-lg flex-shrink-0 object-contain" />
        {!collapsed && (
          <div>
            <div className="text-[#FFB800] font-extrabold text-sm leading-tight tracking-wide">ADDOSSER</div>
            <div className="text-white/40 text-[9px] uppercase tracking-[0.12em]">Enterprise Hub</div>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          </div>
        )}
      </div>

<<<<<<< HEAD
      <nav className='flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin'>
        {!collapsed && (
          <p className='text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 py-2'>
            Applications
          </p>
        )}

        {hasMasterDashboard && (
          <NavLink href='/dashboard' label='Dashboard' icon='⊞' collapsed={collapsed} />
        )}

        {modules.map((mod, i) => {
          const prevSection = i > 0 ? modules[i - 1].section : null
          const showSectionHeader = mod.section && mod.section !== prevSection

          return (
            <div key={mod.key}>
              {showSectionHeader && !collapsed && (
                <p className='text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 py-2 mt-1'>
                  {mod.section}
                </p>
              )}
              {mod.pages.length === 1 ? (
                <NavLink
                  href={mod.pages[0].href}
                  label={mod.label}
                  icon={mod.icon ?? '📄'}
                  collapsed={collapsed}
                />
              ) : (
                <NavGroup
                  href={mod.href ?? mod.pages[0].href}
                  label={mod.label}
                  icon={mod.icon ?? '📄'}
                  collapsed={collapsed}
                  subItems={mod.pages.map(p => ({
                    href: p.href,
                    label: p.label,
                    icon: p.icon ?? '📄'
                  }))}
                />
              )}
            </div>
          )
        })}

        {(user?.isSystem || user?.roleName === 'Super Admin') && (
          <>
            <div className='my-3 border-t border-white/10' />
            {!collapsed && (
              <p className='text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 pb-1'>
                Administration
              </p>
            )}
            <NavLink
              href='/admin'
              label='Admin Panel'
              icon='⚙️'
              collapsed={collapsed}
            />
            <NavLink
              href='/audit'
              label='Audit Trail'
              icon='📋'
              collapsed={collapsed}
            />
=======
      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 py-2">Applications</p>
        )}
        {visibleItems.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} />
        ))}

        {/* Admin separator */}
        {(user?.isSystem || user?.roleName === "Super Admin") && (
          <>
            <div className="my-3 border-t border-white/10" />
            {!collapsed && (
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 pb-1">Administration</p>
            )}
            <NavItem href="/admin" label="Admin Panel" icon="⚙️" collapsed={collapsed} />
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          </>
        )}
      </nav>

<<<<<<< HEAD
      {!collapsed && user && (
        <div className='p-4 border-t border-white/10'>
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold flex-shrink-0'>
              {user.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className='overflow-hidden'>
              <div className='text-white text-xs font-semibold truncate'>
                {user.name}
              </div>
              <div className='text-white/40 text-[10px] truncate'>
                {user.roleName}
              </div>
=======
      {/* User info */}
      {!collapsed && user && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold flex-shrink-0">
              {user.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-white text-xs font-semibold truncate">{user.name}</div>
              <div className="text-white/40 text-[10px] truncate">{user.roleName}</div>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
            </div>
          </div>
        </div>
      )}

<<<<<<< HEAD
      <div className='p-3 border-t border-white/10'>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className='w-full bg-white/8 hover:bg-white/15 text-white/60 rounded-xl py-2 text-sm transition-all'
        >
          {collapsed ? '›' : '‹ Collapse'}
        </button>
      </div>
    </aside>
    </AllHrefsContext.Provider>
  )
=======
      {/* Collapse toggle */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full bg-white/8 hover:bg-white/15 text-white/60 rounded-xl py-2 text-sm transition-all"
        >
          {collapsed ? "›" : "‹ Collapse"}
        </button>
      </div>
    </aside>
  );
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
