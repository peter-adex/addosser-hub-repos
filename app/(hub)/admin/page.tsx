<<<<<<< HEAD
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import AdminTabs from '@/components/admin/AdminTabs'

export const metadata: Metadata = { title: 'Admin Panel' }

export default async function AdminPage () {
  const user = await requireAuth()
  if (!user.isSystem && user.roleName !== 'Super Admin') redirect('/dashboard')

  const [
    users,
    roles,
    entities,
    apps,
    glAccounts,
    branches,
    vendorCount,
    approvalWorkflows
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        role: true,
        entity: true,

        entityAccess: {
          include: {
            entity: true
          }
        }
      },

      orderBy: {
        name: 'asc'
      }
    }),
    prisma.role.findMany({
      include: {
        permissions: { include: { app: true } },
        _count: { select: { users: true } }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.entity.findMany({
      include: {
        _count: { select: { users: true, glAccounts: true, assets: true } }
      },
      orderBy: { code: 'asc' }
    }),
    prisma.app.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.gLAccount.findMany({
      orderBy: { code: 'asc' },
      include: { entityAccounts: { include: { entity: { select: { code: true, name: true } } } } }
    }),
    prisma.branch.findMany({
      include: { entity: { select: { name: true, code: true } } },
      orderBy: { name: 'asc' }
    }),
    prisma.vendor.count(),
    prisma.approvalWorkflow.findMany({
      include: {
        entity: { select: { name: true, code: true } },
        steps: {
          include: {
            role: { select: { name: true } },
            user: { select: { id: true, name: true, email: true } }
          },
          orderBy: { stepNumber: 'asc' }
        },
        _count: { select: { instances: true } }
      },
      orderBy: { module: 'asc' }
    })
  ])

  const summaryStats = [
    { label: 'Users', value: users.length, icon: '👥', color: '#1B2A8A' },
    { label: 'Entities', value: entities.length, icon: '🏦', color: '#7c3aed' },
    { label: 'Branches', value: branches.length, icon: '📍', color: '#0284c7' },
    {
      label: 'GL Accounts',
      value: glAccounts.length,
      icon: '📋',
      color: '#16a34a'
    },
    { label: 'Vendors', value: vendorCount, icon: '🏪', color: '#d97706' },
    {
      label: 'Workflows',
      value: approvalWorkflows.length,
      icon: '🔄',
      color: '#dc2626'
    }
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>Admin Panel</h1>
        <p className='text-muted-foreground text-sm mt-1'>
          Manage users, roles, entities, branches, GL accounts and approval
          workflows
        </p>
      </div>

      <div className='grid grid-cols-3 md:grid-cols-6 gap-3'>
        {summaryStats.map(s => (
          <div
            key={s.label}
            className='bg-card border border-border rounded-xl p-3 flex items-center gap-2.5'
          >
            <div
              className='w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0'
              style={{ background: `${s.color}18` }}
            >
              {s.icon}
            </div>
            <div>
              <div className='text-base font-extrabold text-foreground'>
                {s.value}
              </div>
              <div className='text-[10px] text-muted-foreground'>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <AdminTabs
        users={users.map(u => ({ ...u, passwordHash: undefined }))}
=======
import { Metadata } from "next";
import { requireAuth } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminTabs from "@/components/admin/AdminTabs";

export const metadata: Metadata = { title: "Admin Panel" };

export default async function AdminPage() {
  const user = await requireAuth();
  if (!user.isSystem && user.roleName !== "Super Admin") redirect("/dashboard");

  const [users, roles, entities, apps, glAccounts] = await Promise.all([
    prisma.user.findMany({ include: { role: true, entity: true }, orderBy: { name: "asc" } }),
    prisma.role.findMany({ include: { permissions: { include: { app: true } }, _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    prisma.entity.findMany({ include: { _count: { select: { users: true, budgets: true } } }, orderBy: { code: "asc" } }),
    prisma.app.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.gLAccount.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage users, roles, entities and permissions</p>
      </div>
      <AdminTabs
        users={users.map((u) => ({ ...u, passwordHash: undefined }))}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        roles={roles}
        entities={entities}
        apps={apps}
        glAccounts={glAccounts}
<<<<<<< HEAD
        branches={branches}
        approvalWorkflows={approvalWorkflows}
      />
    </div>
  )
=======
      />
    </div>
  );
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
