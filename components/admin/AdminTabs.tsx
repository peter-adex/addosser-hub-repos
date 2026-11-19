<<<<<<< HEAD
'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/shared/Badge'
import GranularPermissionsAccordion from '@/components/admin/GranularPermissionsAccordion'
import SecurityAdminPanel from '@/components/admin/SecurityAdminPanel'
import UserMfaPanel from '@/components/admin/UserMfaPanel'
import { MODULE_OPTIONS, MODULE_ACTIONS, MODULES_NOT_YET_WIRED } from '@/lib/approval-workflow-modules'
import { useRouter } from 'next/navigation'

interface Props {
  users: any[]
  roles: any[]
  entities: any[]
  apps: any[]
  glAccounts: any[]
  branches: any[]
  approvalWorkflows: any[]
}

type Tab =
  | 'users'
  | 'roles'
  | 'entities'
  | 'branches'
  | 'gl'
  | 'workflows'
  | 'invite'

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: '👥 Users' },
  { id: 'roles', label: '🛡️ Roles' },
  { id: 'entities', label: '🏦 Entities' },
  { id: 'branches', label: '🏢 Branches' },
  { id: 'gl', label: '📋 GL Accounts' },
  { id: 'workflows', label: '⚙️ Approvals' },
  { id: 'invite', label: '✉️ Invite' }
]

const PERM_KEYS = [
  'canView',
  'canCreate',
  'canEdit',
  'canDelete',
  'canApprove'
] as const

function SearchInput ({
  value,
  onChange,
  placeholder
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className='relative'>
      <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>
        🔍
      </span>
      <input
        type='text'
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className='pl-8 pr-4 py-2 rounded-xl border border-border bg-background text-foreground text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
      />
    </div>
  )
}

function Switch ({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type='button'
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
const labelCls =
  'block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5'

interface Confirm {
  message: string
  onConfirm: () => void
}

export default function AdminTabs ({
  users: initialUsers,
  roles: initialRoles,
  entities: initialEntities,
  apps,
  glAccounts: initialGLs,
  branches: initialBranches,
  approvalWorkflows: initialWorkflows = []
}: Props) {
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('users')
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [testEmailState, setTestEmailState] = useState<
    { status: 'idle' | 'sending' | 'success' | 'error'; message?: string }
  >({ status: 'idle' })

  async function sendTestEmail () {
    setTestEmailState({ status: 'sending' })
    try {
      const res = await fetch('/api/admin/test-email', { method: 'POST' })
      const data = await res.json()
      setTestEmailState({
        status: data.success ? 'success' : 'error',
        message: data.message
      })
    } catch {
      setTestEmailState({
        status: 'error',
        message: 'Network error — could not reach the server.'
      })
    }
  }
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const [confirmModal, setConfirmModal] = useState<Confirm | null>(null)

  const [users, setUsers] = useState(initialUsers)
  const [roles, setRoles] = useState(initialRoles)
  const [entities, setEntities] = useState(initialEntities)
  const [gls, setGLs] = useState(initialGLs)
  const [branches, setBranches] = useState(initialBranches)

  const [userSearch, setUserSearch] = useState('')
  const [glSearch, setGLSearch] = useState('')
  const [glEntityFilter, setGLEntityFilter] = useState('')
  const [branchSearch, setBranchSearch] = useState('')

  const [selectedRole, setSelectedRole] = useState<any>(null)
  const [permissions, setPermissions] = useState<
    Record<string, Record<string, boolean>>
  >(() => {
    const p: Record<string, Record<string, boolean>> = {}
    for (const role of initialRoles) {
      p[role.id] = {}
      for (const perm of role.permissions ?? []) {
        for (const k of PERM_KEYS)
          p[role.id][`${perm.app?.slug}:${k}`] = perm[k]
      }
    }
    return p
  })
  const [savingPerms, setSavingPerms] = useState(false)

  const [entityModal, setEntityModal] = useState<{ open: boolean; data?: any }>(
    { open: false }
  )
  const [entityForm, setEntityForm] = useState({
    name: '',
    code: '',
    type: 'Bank',
    address: '',
    phone: '',
    email: ''
  })

  const [branchModal, setBranchModal] = useState<{ open: boolean; data?: any }>(
    { open: false }
  )
  const [branchForm, setBranchForm] = useState({
    entityId: '',
    name: '',
    code: '',
    address: '',
    phone: '',
    manager: ''
  })

  const [glModal, setGLModal] = useState<{ open: boolean; data?: any }>({
    open: false
  })
  const [glForm, setGLForm] = useState({
    code: '',
    name: '',
    category: '',
    description: ''
  })

  const [roleModal, setRoleModal] = useState(false)
  const [roleForm, setRoleForm] = useState({ name: '', description: '' })
  const [editRoleModal, setEditRoleModal] = useState<{ open: boolean; role?: any }>({ open: false })
  const [editRoleForm, setEditRoleForm] = useState({ name: '', description: '' })
  const [deleteRoleModal, setDeleteRoleModal] = useState<{ open: boolean; role?: any; reassignTo: string }>({ open: false, reassignTo: '' })

  const [userModal, setUserModal] = useState<{ open: boolean; data?: any }>({
    open: false
  })
  const [userForm, setUserForm] = useState({
    name: '',
    roleId: '',
    entityId: '',
    isActive: true,
    extraEntityIds: [] as string[]
  })

  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    roleId: initialRoles[0]?.id ?? '',
    entityId: initialEntities[0]?.id ?? '',
    extraEntityIds: [] as string[],
    approvalLimit: ''
  })

  const [workflows, setWorkflows] = useState<any[]>(initialWorkflows ?? [])
  const [workflowModal, setWorkflowModal] = useState<{
    open: boolean
    editing?: any
  }>({ open: false })
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    entityIds: [] as string[],
    module: 'invoice',
    actions: ['SUBMIT'] as string[],
    description: '',
    steps: [
      {
        userId: '',
        stepNumber: 1,
        approvalLimitAmount: '',
        isExceptionalApprover: false
      }
    ]
  })
  const [workflowApproverSearch, setWorkflowApproverSearch] = useState<Record<number, string>>({})
  const [entityPickerOpen, setEntityPickerOpen] = useState(false)

  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  function showToast (msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function apiCall (url: string, method: string, body?: any) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })

    let data: any = {}
    const text = await res.text()
    if (text.trim()) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: `Server error (${res.status}): ${text.slice(0, 120)}` }
      }
    }

    if (!res.ok) {
      const detailMsgs = data?.details
        ? Object.entries(data.details)
            .map(([field, msgs]: [string, any]) =>
              Array.isArray(msgs) && msgs.length ? `${field}: ${msgs.join(', ')}` : null
            )
            .filter(Boolean)
        : []
      const baseMsg =
        data?.error ?? data?.message ?? `Request failed with status ${res.status}`
      throw new Error(
        detailMsgs.length ? `${baseMsg} — ${detailMsgs.join('; ')}` : baseMsg
      )
    }
    return data
  }

  function askConfirm (message: string, onConfirm: () => void) {
    setConfirmModal({ message, onConfirm })
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase()
    return users.filter(
      u =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role?.name.toLowerCase().includes(q)
    )
  }, [users, userSearch])

  async function toggleUserActive (u: any) {
    try {
      const res = await apiCall(`/api/admin/users/${u.id}`, 'PATCH', {
        isActive: !u.isActive
      })

      setUsers(prev =>
        prev.map(x =>
          x.id === u.id ? { ...x, isActive: res.data.isActive } : x
        )
      )
      showToast(
        `${u.name} has been ${res.data.isActive ? 'enabled' : 'disabled'}`
      )
    } catch (e: any) {
      showToast(e.message, false)
    }
  }

  async function handleNameChangeAction (u: any, action: 'approve' | 'reject') {
    try {
      const res = await apiCall(
        `/api/admin/users/${u.id}/name-change`,
        'POST',
        { action }
      )
      setUsers(prev =>
        prev.map(x =>
          x.id === u.id
            ? { ...x, name: res.data.name, pendingName: null, pendingNameRequestedAt: null }
            : x
        )
      )
      showToast(
        action === 'approve'
          ? `Name change approved — now "${res.data.name}"`
          : `Name change rejected — kept as "${res.data.name}"`
      )
    } catch (e: any) {
      showToast(e.message, false)
    }
  }

  function openEditUser (u: any) {
    setUserForm({
      name: u.name,
      roleId: u.roleId,
      entityId: u.entityId,
      isActive: u.isActive,

      extraEntityIds:
        u.entityAccess
          ?.map((x: any) => x.entityId)
          .filter((id: string) => id !== u.entityId) ?? []
    })

    setUserModal({
      open: true,
      data: u
    })
  }

  function toggleUserEntity (entityId: string) {
    setUserForm(prev => {
      const exists = prev.extraEntityIds.includes(entityId)

      return {
        ...prev,
        extraEntityIds: exists
          ? prev.extraEntityIds.filter(id => id !== entityId)
          : [...prev.extraEntityIds, entityId]
      }
    })
  }
  async function saveUser () {
    if (!userModal.data) return
    try {
      setLoading(true)
      await apiCall(`/api/admin/users/${userModal.data.id}`, 'PATCH', userForm)
      setUsers(prev =>
        prev.map(x =>
          x.id === userModal.data.id
            ? {
                ...x,
                ...userForm,

                role: roles.find(r => r.id === userForm.roleId),

                entity: entities.find(e => e.id === userForm.entityId),

                entityAccess: [
                  {
                    entityId: userForm.entityId,
                    entity: entities.find(e => e.id === userForm.entityId)
                  },

                  ...userForm.extraEntityIds.map(id => ({
                    entityId: id,
                    entity: entities.find(e => e.id === id)
                  }))
                ]
              }
            : x
        )
      )
      setUserModal({ open: false })
      showToast('User updated successfully')
      router.refresh()
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function deleteUser (u: any) {
    askConfirm(
      `Permanently delete ${u.name}? This cannot be undone.`,
      async () => {
        try {
          await apiCall(`/api/admin/users/${u.id}`, 'DELETE')
          setUsers(prev => prev.filter(x => x.id !== u.id))
          showToast(`${u.name} has been deleted`)
        } catch (e: any) {
          showToast(e.message, false)
        }
        setConfirmModal(null)
      }
    )
  }

  function togglePerm (roleId: string, slug: string, key: string) {
    setPermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [`${slug}:${key}`]: !prev[roleId]?.[`${slug}:${key}`]
      }
    }))
  }

  async function savePermissions () {
    if (!selectedRole) return
    setSavingPerms(true)
    try {
      const permsPayload = apps.map(app => ({
=======
"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { DataTable } from "@/components/shared/DataTable";

interface Props {
  users: any[];
  roles: any[];
  entities: any[];
  apps: any[];
  glAccounts: any[];
}

type Tab = "users" | "roles" | "entities" | "gl" | "invite";

export default function AdminTabs({ users, roles, entities, apps, glAccounts }: Props) {
  const [tab, setTab] = useState<Tab>("users");
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    const p: Record<string, Record<string, boolean>> = {};
    for (const role of roles) {
      p[role.id] = {};
      for (const perm of role.permissions) {
        for (const key of ["canView", "canCreate", "canEdit", "canDelete", "canApprove"]) {
          p[role.id][`${perm.app.slug}:${key}`] = perm[key];
        }
      }
    }
    return p;
  });
  const [saving, setSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", roleId: roles[0]?.id ?? "", entityId: entities[0]?.id ?? "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const PERM_KEYS = ["canView", "canCreate", "canEdit", "canDelete", "canApprove"];

  const togglePerm = (roleId: string, slug: string, key: string) => {
    setPermissions((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [`${slug}:${key}`]: !prev[roleId]?.[`${slug}:${key}`] },
    }));
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const permsPayload = apps.map((app) => ({
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        appId: app.id,
        canView: !!permissions[selectedRole.id]?.[`${app.slug}:canView`],
        canCreate: !!permissions[selectedRole.id]?.[`${app.slug}:canCreate`],
        canEdit: !!permissions[selectedRole.id]?.[`${app.slug}:canEdit`],
        canDelete: !!permissions[selectedRole.id]?.[`${app.slug}:canDelete`],
<<<<<<< HEAD
        canApprove: !!permissions[selectedRole.id]?.[`${app.slug}:canApprove`]
      }))
      await apiCall(`/api/roles/${selectedRole.id}/permissions`, 'PUT', {
        permissions: permsPayload
      })
      showToast('Permissions saved successfully')
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setSavingPerms(false)
    }
  }

  async function createRole () {
    if (!roleForm.name.trim()) return
    try {
      setLoading(true)
      const data = await apiCall('/api/roles', 'POST', {
        name: roleForm.name,
        description: roleForm.description,
        permissions: apps.map(a => ({
          appId: a.id,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canApprove: false
        }))
      })
      setRoles(prev => [...prev, data.data])
      setPermissions(prev => ({ ...prev, [data.data.id]: {} }))
      setRoleModal(false)
      setRoleForm({ name: '', description: '' })
      showToast(`Role "${roleForm.name}" created`)
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function saveEditRole () {
    if (!editRoleModal.role || !editRoleForm.name.trim()) return
    try {
      setLoading(true)
      const data = await apiCall(`/api/roles/${editRoleModal.role.id}`, 'PATCH', {
        name: editRoleForm.name,
        description: editRoleForm.description
      })
      setRoles(prev => prev.map(r => (r.id === editRoleModal.role.id ? { ...r, ...data.data } : r)))
      if (selectedRole?.id === editRoleModal.role.id) {
        setSelectedRole((prev: any) => ({ ...prev, ...data.data }))
      }
      setEditRoleModal({ open: false })
      showToast(`Role "${editRoleForm.name}" updated`)
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function confirmDeleteRole () {
    if (!deleteRoleModal.role) return
    try {
      setLoading(true)
      await apiCall(
        `/api/roles/${deleteRoleModal.role.id}`,
        'DELETE',
        deleteRoleModal.reassignTo ? { reassignToRoleId: deleteRoleModal.reassignTo } : undefined
      )
      setRoles(prev => prev.filter(r => r.id !== deleteRoleModal.role.id))
      if (selectedRole?.id === deleteRoleModal.role.id) setSelectedRole(null)
      showToast(`Role "${deleteRoleModal.role.name}" deleted`)
      setDeleteRoleModal({ open: false, reassignTo: '' })
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  function openEntityModal (data?: any) {
    if (data) {
      setEntityForm({
        name: data.name,
        code: data.code,
        type: data.type,
        address: data.address ?? '',
        phone: data.phone ?? '',
        email: data.email ?? ''
      })
    } else {
      setEntityForm({
        name: '',
        code: '',
        type: 'Bank',
        address: '',
        phone: '',
        email: ''
      })
    }
    setEntityModal({ open: true, data })
  }

  async function saveEntity () {
    try {
      setLoading(true)
      if (entityModal.data) {
        const res = await apiCall(
          `/api/entities/${entityModal.data.id}`,
          'PATCH',
          entityForm
        )
        setEntities(prev =>
          prev.map(e =>
            e.id === entityModal.data.id ? { ...e, ...entityForm } : e
          )
        )
        showToast('Entity updated')
      } else {
        const res = await apiCall('/api/entities', 'POST', entityForm)
        setEntities(prev => [
          ...prev,
          {
            ...res.data,
            _count: { users: 0, assets: 0, branches: 0, glAccounts: 0 }
          }
        ])
        showToast(`Entity "${entityForm.name}" created`)
      }
      setEntityModal({ open: false })
      router.refresh()
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function toggleEntity (ent: any) {
    try {
      await apiCall(`/api/entities/${ent.id}`, 'PATCH', {
        isActive: !ent.isActive
      })
      setEntities(prev =>
        prev.map(e => (e.id === ent.id ? { ...e, isActive: !e.isActive } : e))
      )
      showToast(`${ent.name} ${ent.isActive ? 'disabled' : 'enabled'}`)
    } catch (e: any) {
      showToast(e.message, false)
    }
  }

  async function deleteEntity (ent: any) {
    askConfirm(
      `Delete entity "${ent.name}"? This cannot be undone.`,
      async () => {
        try {
          await apiCall(`/api/entities/${ent.id}`, 'DELETE')
          setEntities(prev => prev.filter(e => e.id !== ent.id))
          showToast(`${ent.name} deleted`)
        } catch (e: any) {
          showToast(e.message, false)
        }
        setConfirmModal(null)
      }
    )
  }

  const filteredBranches = useMemo(() => {
    const q = branchSearch.toLowerCase()
    return branches.filter(
      b =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.entity?.name?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q)
    )
  }, [branches, branchSearch])

  function openBranchModal (data?: any) {
    if (data) {
      setBranchForm({
        entityId: data.entityId,
        name: data.name,
        code: data.code ?? '',
        address: data.address ?? '',
        phone: data.phone ?? '',
        manager: data.manager ?? ''
      })
    } else {
      setBranchForm({
        entityId: entities[0]?.id ?? '',
        name: '',
        code: '',
        address: '',
        phone: '',
        manager: ''
      })
    }
    setBranchModal({ open: true, data })
  }

  async function saveBranch () {
    try {
      setLoading(true)
      if (branchModal.data) {
        const res = await apiCall(
          `/api/branches/${branchModal.data.id}`,
          'PATCH',
          branchForm
        )
        setBranches(prev =>
          prev.map(b =>
            b.id === branchModal.data.id ? { ...b, ...branchForm } : b
          )
        )
        showToast('Branch updated')
      } else {
        const res = await apiCall('/api/branches', 'POST', branchForm)
        const ent = entities.find(e => e.id === branchForm.entityId)
        setBranches(prev => [
          ...prev,
          {
            ...res.data,
            entity: { name: ent?.name, code: ent?.code },
            _count: { budgets: 0, assets: 0 }
          }
        ])
        showToast(`Branch "${branchForm.name}" created`)
      }
      setBranchModal({ open: false })
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function toggleBranch (b: any) {
    try {
      await apiCall(`/api/branches/${b.id}`, 'PATCH', { isActive: !b.isActive })
      setBranches(prev =>
        prev.map(x => (x.id === b.id ? { ...x, isActive: !x.isActive } : x))
      )
      showToast(`${b.name} ${b.isActive ? 'disabled' : 'enabled'}`)
    } catch (e: any) {
      showToast(e.message, false)
    }
  }

  async function deleteBranch (b: any) {
    askConfirm(`Delete branch "${b.name}"?`, async () => {
      try {
        await apiCall(`/api/branches/${b.id}`, 'DELETE')
        setBranches(prev => prev.filter(x => x.id !== b.id))
        showToast(`${b.name} deleted`)
      } catch (e: any) {
        showToast(e.message, false)
      }
      setConfirmModal(null)
    })
  }

  const filteredGLs = useMemo(() => {
    const q = glSearch.toLowerCase()
    return gls.filter(
      gl =>
        (!q ||
          gl.code.toLowerCase().includes(q) ||
          gl.name.toLowerCase().includes(q) ||
          gl.category.toLowerCase().includes(q)) &&
        (!glEntityFilter ||
          (gl.entityAccounts ?? []).some((ea: any) => ea.entityId === glEntityFilter))
    )
  }, [gls, glSearch, glEntityFilter])

  function openGLModal (data?: any) {
    if (data)
      setGLForm({
        code: data.code,
        name: data.name,
        category: data.category,
        description: data.description ?? ''
      })
    else setGLForm({ code: '', name: '', category: '', description: '' })
    setGLModal({ open: true, data })
  }

  async function saveGL () {
    try {
      setLoading(true)
      if (glModal.data) {
        await apiCall(`/api/gl-accounts/${glModal.data.id}`, 'PATCH', glForm)
        setGLs(prev =>
          prev.map(g => (g.id === glModal.data.id ? { ...g, ...glForm } : g))
        )
        showToast('GL Account updated')
      } else {
        const res = await apiCall('/api/gl-accounts', 'POST', glForm)
        setGLs(prev => [...prev, res.data])
        showToast(`GL Account ${glForm.code} created`)
      }
      setGLModal({ open: false })
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function toggleGL (gl: any) {
    try {
      await apiCall(`/api/gl-accounts/${gl.id}`, 'PATCH', {
        isActive: !gl.isActive
      })
      setGLs(prev =>
        prev.map(g => (g.id === gl.id ? { ...g, isActive: !g.isActive } : g))
      )
      showToast(`${gl.name} ${gl.isActive ? 'disabled' : 'enabled'}`)
    } catch (e: any) {
      showToast(e.message, false)
    }
  }

  async function deleteGL (gl: any) {
    askConfirm(
      `Delete GL Account ${gl.code} — ${gl.name}? This cannot be undone.`,
      async () => {
        try {
          await apiCall(`/api/gl-accounts/${gl.id}`, 'DELETE')
          setGLs(prev => prev.filter(g => g.id !== gl.id))
          showToast(`GL Account ${gl.code} deleted`)
        } catch (e: any) {
          showToast(e.message, false)
        }
        setConfirmModal(null)
      }
    )
  }

  function toggleExtraEntity (id: string) {
    setInviteForm(prev => ({
      ...prev,
      extraEntityIds: prev.extraEntityIds.includes(id)
        ? prev.extraEntityIds.filter(x => x !== id)
        : [...prev.extraEntityIds, id]
    }))
  }

  async function sendInvite (e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteMsg('')
    try {
      await apiCall('/api/users/invite', 'POST', inviteForm)
      setInviteMsg(`✅ Invitation sent to ${inviteForm.email}`)
      setInviteForm(prev => ({
        ...prev,
        email: '',
        name: '',
        extraEntityIds: []
      }))
    } catch (err: any) {
      setInviteMsg(`❌ ${err.message}`)
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className='flex gap-6 items-start'>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold border animate-fade-in ${
            toast.ok
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
          }`}
        >
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {confirmModal && (
        <div className='fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl'>
            <h3 className='font-bold text-foreground mb-2'>Confirm Action</h3>
            <p className='text-sm text-muted-foreground mb-5'>
              {confirmModal.message}
            </p>
            <div className='flex gap-3 justify-end'>
              <button
                onClick={() => setConfirmModal(null)}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className='px-4 py-2 text-sm rounded-xl bg-red-600 text-white font-bold hover:bg-red-700'
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {userModal.open && (
        <div className='fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl'>
            <h3 className='font-bold text-foreground mb-4'>
              Edit User — {userModal.data?.name}
            </h3>
            <div className='space-y-3'>
              {[{ label: 'Full Name', key: 'name', type: 'text' }].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input
                    type={f.type}
                    className={inputCls}
                    value={(userForm as any)[f.key]}
                    onChange={e =>
                      setUserForm(p => ({ ...p, [f.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div>
                <label className={labelCls}>Role</label>
                <select
                  className={inputCls}
                  value={userForm.roleId}
                  onChange={e =>
                    setUserForm(p => ({ ...p, roleId: e.target.value }))
                  }
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Primary Entity</label>

                <select
                  className={inputCls}
                  value={userForm.entityId}
                  onChange={e =>
                    setUserForm(p => ({
                      ...p,
                      entityId: e.target.value
                    }))
                  }
                >
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Additional Entity Access</label>

                <p className='text-xs text-muted-foreground mb-2'>
                  User can access transactions for these entities too.
                </p>

                <div className='space-y-2 bg-muted/30 rounded-xl p-3 border border-border max-h-52 overflow-y-auto'>
                  {entities
                    .filter(e => e.id !== userForm.entityId)
                    .map(e => (
                      <label
                        key={e.id}
                        className='flex items-center gap-3 cursor-pointer text-sm text-foreground'
                      >
                        <input
                          type='checkbox'
                          checked={userForm.extraEntityIds.includes(e.id)}
                          onChange={() => toggleUserEntity(e.id)}
                          className='accent-[#FFB800] w-4 h-4'
                        />

                        <span>{e.name}</span>

                        <Badge variant='gray'>{e.code}</Badge>
                      </label>
                    ))}
                </div>
              </div>

              {userModal.data?.id && (
                <UserMfaPanel userId={userModal.data.id} onToast={showToast} />
              )}
            </div>
            <div className='flex gap-3 justify-end mt-5'>
              <button
                onClick={() => setUserModal({ open: false })}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={saveUser}
                disabled={loading}
                className='px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {entityModal.open && (
        <div className='fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl'>
            <h3 className='font-bold text-foreground mb-4'>
              {entityModal.data ? 'Edit Entity' : 'New Entity'}
            </h3>
            <div className='space-y-3'>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Entity Name</label>
                  <input
                    className={inputCls}
                    value={entityForm.name}
                    onChange={e =>
                      setEntityForm(p => ({ ...p, name: e.target.value }))
                    }
                    placeholder='Addosser Finance Ltd'
                  />
                </div>
                <div>
                  <label className={labelCls}>Code</label>
                  <input
                    className={inputCls}
                    value={entityForm.code}
                    onChange={e =>
                      setEntityForm(p => ({
                        ...p,
                        code: e.target.value.toUpperCase()
                      }))
                    }
                    placeholder='AFL'
                    maxLength={10}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select
                  className={inputCls}
                  value={entityForm.type}
                  onChange={e =>
                    setEntityForm(p => ({ ...p, type: e.target.value }))
                  }
                >
                  {[
                    'Bank',
                    'Finance',
                    'Investment',
                    'Properties',
                    'Insurance',
                    'Leasing',
                    'Other'
                  ].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              {[
                {
                  label: 'Address',
                  key: 'address',
                  placeholder: '123 Marina, Lagos'
                },
                {
                  label: 'Phone',
                  key: 'phone',
                  placeholder: '+234 800 000 0000'
                },
                {
                  label: 'Email',
                  key: 'email',
                  placeholder: 'info@addosser.com'
                }
              ].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input
                    className={inputCls}
                    value={(entityForm as any)[f.key]}
                    onChange={e =>
                      setEntityForm(p => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
            <div className='flex gap-3 justify-end mt-5'>
              <button
                onClick={() => setEntityModal({ open: false })}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={saveEntity}
                disabled={loading}
                className='px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading
                  ? 'Saving…'
                  : entityModal.data
                  ? 'Update Entity'
                  : 'Create Entity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {branchModal.open && (
        <div className='fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl'>
            <h3 className='font-bold text-foreground mb-4'>
              {branchModal.data ? 'Edit Branch' : 'New Branch'}
            </h3>
            <div className='space-y-3'>
              <div>
                <label className={labelCls}>Entity</label>
                <select
                  className={inputCls}
                  value={branchForm.entityId}
                  onChange={e =>
                    setBranchForm(p => ({ ...p, entityId: e.target.value }))
                  }
                  disabled={!!branchModal.data}
                >
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Branch Name</label>
                  <input
                    className={inputCls}
                    value={branchForm.name}
                    onChange={e =>
                      setBranchForm(p => ({ ...p, name: e.target.value }))
                    }
                    placeholder='e.g. Ikeja'
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Code{' '}
                    <span className='normal-case font-normal'>(optional)</span>
                  </label>
                  <input
                    className={inputCls}
                    value={branchForm.code}
                    onChange={e =>
                      setBranchForm(p => ({
                        ...p,
                        code: e.target.value.toUpperCase()
                      }))
                    }
                    placeholder='IKJ'
                    maxLength={10}
                  />
                </div>
              </div>
              {[
                {
                  label: 'Address',
                  key: 'address',
                  placeholder: '45 Allen Ave, Ikeja'
                },
                {
                  label: 'Phone',
                  key: 'phone',
                  placeholder: '+234 800 000 0001'
                },
                {
                  label: 'Manager',
                  key: 'manager',
                  placeholder: 'Branch Manager Name'
                }
              ].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>
                    {f.label}{' '}
                    <span className='normal-case font-normal'>(optional)</span>
                  </label>
                  <input
                    className={inputCls}
                    value={(branchForm as any)[f.key]}
                    onChange={e =>
                      setBranchForm(p => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
            <div className='flex gap-3 justify-end mt-5'>
              <button
                onClick={() => setBranchModal({ open: false })}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={saveBranch}
                disabled={loading}
                className='px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading
                  ? 'Saving…'
                  : branchModal.data
                  ? 'Update Branch'
                  : 'Create Branch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {glModal.open && (
        <div className='fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl'>
            <h3 className='font-bold text-foreground mb-4'>
              {glModal.data ? 'Edit GL Account' : 'New GL Account'}
            </h3>
            <div className='space-y-3'>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>GL Code</label>
                  <input
                    className={inputCls}
                    value={glForm.code}
                    onChange={e =>
                      setGLForm(p => ({ ...p, code: e.target.value }))
                    }
                    placeholder='e.g. 5116'
                    disabled={!!glModal.data}
                  />
                </div>
                <div>
                  <label className={labelCls}>Account Name</label>
                  <input
                    className={inputCls}
                    value={glForm.name}
                    onChange={e =>
                      setGLForm(p => ({ ...p, name: e.target.value }))
                    }
                    placeholder='e.g. Staff Insurance'
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <input
                  className={inputCls}
                  value={glForm.category}
                  onChange={e =>
                    setGLForm(p => ({ ...p, category: e.target.value }))
                  }
                  list='gl-cats'
                  placeholder='e.g. Human Resources'
                />
                <datalist id='gl-cats'>
                  {[
                    'Repair & Maintenance',
                    'Fuel & Lubricants',
                    'Administrative',
                    'Utilities',
                    'Human Resources',
                    'Technology',
                    'Marketing',
                    'Professional Services',
                    'Insurance',
                    'Occupancy',
                    'Facility',
                    'Other'
                  ].map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>
                  Description{' '}
                  <span className='normal-case font-normal'>(optional)</span>
                </label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={glForm.description}
                  onChange={e =>
                    setGLForm(p => ({ ...p, description: e.target.value }))
                  }
                  placeholder='What expenses does this GL account cover?'
                />
              </div>
            </div>
            <div className='flex gap-3 justify-end mt-5'>
              <button
                onClick={() => setGLModal({ open: false })}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={saveGL}
                disabled={loading}
                className='px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading
                  ? 'Saving…'
                  : glModal.data
                  ? 'Update GL Account'
                  : 'Create GL Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleModal && (
        <div className='fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl'>
            <h3 className='font-bold text-foreground mb-4'>Create New Role</h3>
            <div className='space-y-3'>
              <div>
                <label className={labelCls}>Role Name</label>
                <input
                  className={inputCls}
                  value={roleForm.name}
                  onChange={e =>
                    setRoleForm(p => ({ ...p, name: e.target.value }))
                  }
                  placeholder='e.g. Branch Manager'
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input
                  className={inputCls}
                  value={roleForm.description}
                  onChange={e =>
                    setRoleForm(p => ({ ...p, description: e.target.value }))
                  }
                  placeholder='Brief description of this role'
                />
              </div>
            </div>
            <p className='text-xs text-muted-foreground mt-3'>
              You can configure permissions after creating the role.
            </p>
            <div className='flex gap-3 justify-end mt-4'>
              <button
                onClick={() => setRoleModal(false)}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={createRole}
                disabled={loading || !roleForm.name.trim()}
                className='px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading ? 'Creating…' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRoleModal.open && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-card rounded-2xl p-6 w-full max-w-md'>
            <h3 className='font-bold text-foreground mb-4'>Edit Role</h3>
            <div className='space-y-3'>
              <div>
                <label className={labelCls}>Role Name</label>
                <input
                  className={inputCls}
                  value={editRoleForm.name}
                  onChange={e => setEditRoleForm(p => ({ ...p, name: e.target.value }))}
                  placeholder='e.g. Branch Manager'
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input
                  className={inputCls}
                  value={editRoleForm.description}
                  onChange={e => setEditRoleForm(p => ({ ...p, description: e.target.value }))}
                  placeholder='Brief description of this role'
                />
              </div>
            </div>
            <div className='flex gap-3 justify-end mt-4'>
              <button
                onClick={() => setEditRoleModal({ open: false })}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={saveEditRole}
                disabled={loading || !editRoleForm.name.trim()}
                className='px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRoleModal.open && deleteRoleModal.role && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-card rounded-2xl p-6 w-full max-w-md'>
            <h3 className='font-bold text-foreground mb-2'>Delete Role</h3>
            {(deleteRoleModal.role._count?.users ?? 0) > 0 ? (
              <>
                <p className='text-sm text-muted-foreground mb-4'>
                  <strong className='text-foreground'>"{deleteRoleModal.role.name}"</strong> is currently
                  assigned to <strong className='text-foreground'>{deleteRoleModal.role._count.users}</strong> user{deleteRoleModal.role._count.users === 1 ? '' : 's'}.
                  Reassign {deleteRoleModal.role._count.users === 1 ? 'this user' : 'these users'} to another
                  role before deleting, or pick a replacement role below.
                </p>
                {roles.filter(r => r.id !== deleteRoleModal.role.id).length > 0 ? (
                  <div>
                    <label className={labelCls}>Reassign affected users to</label>
                    <select
                      className={inputCls}
                      value={deleteRoleModal.reassignTo}
                      onChange={e => setDeleteRoleModal(p => ({ ...p, reassignTo: e.target.value }))}
                    >
                      <option value=''>— Select replacement role —</option>
                      {roles.filter(r => r.id !== deleteRoleModal.role.id).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className='text-xs text-amber-600'>No other role exists to reassign these users to — create one first.</p>
                )}
              </>
            ) : (
              <p className='text-sm text-muted-foreground mb-4'>
                Are you sure you want to delete <strong className='text-foreground'>"{deleteRoleModal.role.name}"</strong>?
                This action cannot be undone.
              </p>
            )}
            <div className='flex gap-3 justify-end mt-4'>
              <button
                onClick={() => setDeleteRoleModal({ open: false, reassignTo: '' })}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRole}
                disabled={loading || ((deleteRoleModal.role._count?.users ?? 0) > 0 && !deleteRoleModal.reassignTo)}
                className='px-5 py-2 text-sm rounded-xl font-bold text-white disabled:opacity-60 bg-red-600 hover:bg-red-700'
              >
                {loading ? 'Deleting…' : (deleteRoleModal.role._count?.users ?? 0) > 0 ? 'Reassign Users & Delete' : 'Delete Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      <aside
        className={`flex-shrink-0 bg-card border border-border rounded-2xl p-2 sticky top-4 transition-all ${
          navCollapsed ? 'w-14' : 'w-56'
        }`}
      >
        <button
          onClick={() => setNavCollapsed(v => !v)}
          className='w-full flex items-center justify-center py-2 mb-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
          title={navCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {navCollapsed ? '»' : '« Collapse'}
        </button>
        <nav className='space-y-1'>
          {TABS.map(t => {
            const [icon, ...labelParts] = t.label.split(' ')
            const text = labelParts.join(' ')
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={navCollapsed ? text : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  navCollapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-[#1B2A8A] text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span className='text-base leading-none'>{icon}</span>
                {!navCollapsed && <span>{text}</span>}
              </button>
            )
          })}
        </nav>

        <div className='mt-3 pt-3 border-t border-border'>
          <button
            onClick={sendTestEmail}
            disabled={testEmailState.status === 'sending'}
            title={navCollapsed ? 'Send Test Email' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
              navCollapsed ? 'justify-center' : ''
            } bg-[#FFB800]/10 text-[#8a6400] hover:bg-[#FFB800]/20 dark:text-[#FFB800]`}
          >
            <span>{testEmailState.status === 'sending' ? '⏳' : '📧'}</span>
            {!navCollapsed && (
              <span>
                {testEmailState.status === 'sending' ? 'Sending…' : 'Send Test Email'}
              </span>
            )}
          </button>
          {!navCollapsed && testEmailState.status !== 'idle' && testEmailState.status !== 'sending' && (
            <p
              className={`mt-2 text-[11px] leading-snug px-1 ${
                testEmailState.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {testEmailState.status === 'success' ? '✅ ' : '❌ '}
              {testEmailState.message}
            </p>
          )}
        </div>
      </aside>

      <div className='flex-1 min-w-0 space-y-6'>

      {tab === 'users' && (
        <div className='space-y-6'>
        <SecurityAdminPanel />
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3'>
            <h2 className='font-bold text-foreground flex items-center gap-2'>
              All Users ({filteredUsers.length})
              {users.filter((u: any) => u.pendingName).length > 0 && (
                <span className='text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5'>
                  {users.filter((u: any) => u.pendingName).length} pending name change
                  {users.filter((u: any) => u.pendingName).length > 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <SearchInput
              value={userSearch}
              onChange={setUserSearch}
              placeholder='Search name, email or role…'
            />
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted/40'>
                  {[
                    'User',
                    'Email',
                    'Role',
                    'Entity',
                    'Status',
                    'Last Login',
                    'Actions'
                  ].map(h => (
                    <th
                      key={h}
                      className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground'
                    >
                      {h}
                    </th>
=======
        canApprove: !!permissions[selectedRole.id]?.[`${app.slug}:canApprove`],
      }));
      await fetch(`/api/roles/${selectedRole.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permsPayload }),
      });
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg("");
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      setInviteMsg(res.ok ? `✅ Invitation sent to ${inviteForm.email}` : `❌ ${data.error}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "users", label: "👥 Users" },
    { id: "roles", label: "🛡️ Roles & Permissions" },
    { id: "entities", label: "🏦 Entities" },
    { id: "gl", label: "📋 GL Accounts" },
    { id: "invite", label: "✉️ Invite User" },
  ];

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-card border border-border rounded-xl w-fit mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.id ? "bg-[#1B2A8A] text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── USERS ── */}
      {tab === "users" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="font-bold text-foreground">All Users ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["User", "Email", "Role", "Entity", "Status", "Last Login", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                  ))}
                </tr>
              </thead>
              <tbody>
<<<<<<< HEAD
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className='px-4 py-10 text-center text-muted-foreground text-sm'
                    >
                      No users match "{userSearch}"
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr
                      key={u.id}
                      className='border-t border-border hover:bg-accent/20'
                    >
                      <td className='px-4 py-3.5'>
                        <div className='flex items-center gap-3'>
                          <div className='w-8 h-8 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold flex-shrink-0'>
                            {u.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className='font-semibold text-sm text-foreground block'>
                              {u.name}
                            </span>
                            {u.pendingName && (
                              <div className='flex items-center gap-1.5 mt-1'>
                                <span className='text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5 whitespace-nowrap'>
                                  → "{u.pendingName}"
                                </span>
                                <button
                                  onClick={() => handleNameChangeAction(u, 'approve')}
                                  title='Approve name change'
                                  className='text-[10px] font-bold text-green-700 dark:text-green-400 hover:underline'
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => handleNameChangeAction(u, 'reject')}
                                  title='Reject name change'
                                  className='text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline'
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className='px-4 py-3.5 text-sm text-muted-foreground'>
                        {u.email}
                      </td>
                      <td className='px-4 py-3.5'>
                        <Badge variant='blue'>{u.role?.name}</Badge>
                      </td>
                      <td className='px-4 py-3.5'>
                        <div className='flex flex-wrap gap-1.5 max-w-[260px]'>
                          {u.entityAccess?.length > 0 ? (
                            <>
                              {u.entityAccess.map((access: any) => {
                                const isPrimary = access.entityId === u.entityId

                                return (
                                  <div
                                    key={access.entityId}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${
                                      isPrimary
                                        ? 'bg-[#1B2A8A]/10 text-[#1B2A8A] border-[#1B2A8A]/20 dark:text-blue-300'
                                        : 'bg-muted text-muted-foreground border-border'
                                    }`}
                                  >
                                    <span>{access.entity?.code}</span>

                                    {isPrimary && (
                                      <span className='text-[9px] uppercase tracking-wide opacity-70'>
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </>
                          ) : (
                            <span className='text-sm text-muted-foreground'>
                              {u.entity?.code ?? '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className='px-4 py-3.5'>
                        <Switch
                          checked={u.isActive}
                          onChange={() => toggleUserActive(u)}
                        />
                      </td>
                      <td className='px-4 py-3.5 text-xs text-muted-foreground'>
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString('en-NG')
                          : 'Never'}
                      </td>
                      <td className='px-4 py-3.5'>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => openEditUser(u)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent border border-border text-foreground hover:bg-muted'
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100'
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
=======
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                          {u.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-sm text-foreground">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3.5"><Badge variant="blue">{u.role?.name}</Badge></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{u.entity?.code}</td>
                    <td className="px-4 py-3.5"><Badge variant={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-NG") : "Never"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent border border-border text-foreground hover:bg-muted transition-colors">Edit</button>
                        <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">Disable</button>
                      </div>
                    </td>
                  </tr>
                ))}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
              </tbody>
            </table>
          </div>
        </div>
<<<<<<< HEAD
        </div>
      )}

      {tab === 'roles' && (
        <div className='grid grid-cols-[280px_1fr] gap-4'>
          <div className='bg-card border border-border rounded-2xl overflow-hidden'>
            <div className='px-5 py-4 border-b border-border font-bold text-sm text-foreground'>
              Roles ({roles.length})
            </div>
            {roles.map(role => (
=======
      )}

      {/* ── ROLES & PERMISSIONS ── */}
      {tab === "roles" && (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          {/* Role list */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border font-bold text-sm text-foreground">Custom Roles</div>
            {roles.map((role) => (
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left px-5 py-3.5 border-b border-border transition-colors ${
<<<<<<< HEAD
                  selectedRole?.id === role.id
                    ? 'bg-[#1B2A8A] text-white'
                    : 'hover:bg-accent/40 text-foreground'
                }`}
              >
                <div className='font-semibold text-sm'>{role.name}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedRole?.id === role.id
                      ? 'text-white/60'
                      : 'text-muted-foreground'
                  }`}
                >
                  {role._count?.users ?? 0} users{' '}
                  {role.isSystem && '• System Role'}
                </div>
              </button>
            ))}
            <div className='p-4'>
              <button
                onClick={() => setRoleModal(true)}
                className='w-full py-2 rounded-xl text-xs font-bold border-2 border-dashed border-border text-muted-foreground hover:border-[#FFB800] hover:text-[#FFB800]'
              >
=======
                  selectedRole?.id === role.id ? "bg-[#1B2A8A] text-white" : "hover:bg-accent/40 text-foreground"
                }`}
              >
                <div className="font-semibold text-sm">{role.name}</div>
                <div className={`text-xs mt-0.5 ${selectedRole?.id === role.id ? "text-white/60" : "text-muted-foreground"}`}>
                  {role._count?.users ?? 0} users {role.isSystem && "• System Role"}
                </div>
              </button>
            ))}
            <div className="p-4">
              <button className="w-full py-2 rounded-xl text-sm font-bold border-2 border-dashed border-border text-muted-foreground hover:border-[#FFB800] hover:text-[#FFB800] transition-colors">
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                + Create Role
              </button>
            </div>
          </div>

<<<<<<< HEAD
          <div className='bg-card border border-border rounded-2xl p-6'>
            {selectedRole ? (
              <>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h2 className='font-bold text-foreground text-lg'>
                      {selectedRole.name}
                    </h2>
                    <p className='text-sm text-muted-foreground mt-0.5'>
                      {selectedRole.description ?? 'Configure module access'}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    {!selectedRole.isSystem && (
                      <button
                        onClick={() => {
                          setEditRoleForm({ name: selectedRole.name, description: selectedRole.description ?? '' })
                          setEditRoleModal({ open: true, role: selectedRole })
                        }}
                        className='px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-accent'
                      >
                        Edit
                      </button>
                    )}
                    {!selectedRole.isSystem && (
                      <button
                        onClick={() => setDeleteRoleModal({ open: true, role: selectedRole, reassignTo: '' })}
                        className='px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                      >
                        Delete
                      </button>
                    )}
                    {!selectedRole.isSystem && (
                      <button
                        onClick={savePermissions}
                        disabled={savingPerms}
                        className='px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60'
                        style={{ background: '#FFB800', color: '#1B2A8A' }}
                      >
                        {savingPerms ? 'Saving…' : 'Save Permissions'}
                      </button>
                    )}
                  </div>
                </div>
                <p className='text-[12px] text-muted-foreground mb-4'>
                  Access is controlled page by page under{' '}
                  <strong className='text-foreground'>Granular Permissions</strong> below. Use{' '}
                  <strong className='text-foreground'>Select All</strong> on a module to grant
                  everything in it, or tick individual pages and actions.
                </p>

                {!selectedRole.isSystem && (
                  <div className='mt-6'>
                    <GranularPermissionsAccordion roleId={selectedRole.id} />
                  </div>
                )}
              </>
            ) : (
              <div className='flex flex-col items-center justify-center h-64 text-muted-foreground'>
                <span className='text-4xl mb-3'>🛡️</span>
                <span className='font-semibold'>
                  Select a role to configure permissions
                </span>
=======
          {/* Permissions matrix */}
          <div className="bg-card border border-border rounded-2xl p-6">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-foreground text-lg">{selectedRole.name}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedRole.description ?? "Configure module access below"}</p>
                  </div>
                  {!selectedRole.isSystem && (
                    <button
                      onClick={savePermissions}
                      disabled={saving}
                      className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60 transition-all"
                      style={{ background: "#FFB800", color: "#1B2A8A" }}
                    >
                      {saving ? "Saving..." : "Save Permissions"}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Module</th>
                        {PERM_KEYS.map((k) => (
                          <th key={k} className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {k.replace("can", "")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apps.map((app) => (
                        <tr key={app.id} className="border-t border-border">
                          <td className="px-4 py-3 text-sm font-semibold text-foreground">
                            <span className="mr-2">{app.icon}</span>{app.name}
                          </td>
                          {PERM_KEYS.map((key) => {
                            const checked = selectedRole.isSystem || !!permissions[selectedRole.id]?.[`${app.slug}:${key}`];
                            return (
                              <td key={key} className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={selectedRole.isSystem}
                                  onChange={() => togglePerm(selectedRole.id, app.slug, key)}
                                  className="w-4 h-4 accent-[#FFB800] cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <span className="text-4xl mb-3">🛡️</span>
                <span className="font-semibold">Select a role to configure permissions</span>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
              </div>
            )}
          </div>
        </div>
      )}

<<<<<<< HEAD
      {tab === 'entities' && (
        <div>
          <div className='flex justify-end mb-4'>
            <button
              onClick={() => openEntityModal()}
              className='px-5 py-2.5 rounded-xl text-sm font-bold'
              style={{ background: '#FFB800', color: '#1B2A8A' }}
            >
              + New Entity
            </button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {entities.map(ent => (
              <div
                key={ent.id}
                className={`bg-card border rounded-2xl p-5 transition-opacity ${
                  ent.isActive ? 'border-border' : 'border-border opacity-60'
                }`}
              >
                <div className='flex items-start justify-between mb-3'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-[#1B2A8A] text-white flex items-center justify-center font-extrabold text-xs'>
                      {ent.code}
                    </div>
                    <div>
                      <div className='font-bold text-foreground text-sm'>
                        {ent.name}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {ent.type}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-muted-foreground mr-1'>
                      {ent.isActive ? 'Active' : 'Disabled'}
                    </span>
                    <Switch
                      checked={ent.isActive}
                      onChange={() => toggleEntity(ent)}
                    />
                  </div>
                </div>
                <div className='flex gap-2 text-xs mb-4'>
                  <Badge variant='blue'>{ent._count?.users ?? 0} users</Badge>
                  <Badge variant='navy'>
                    {ent._count?.branches ?? 0} branches
                  </Badge>
                  <Badge variant='gray'>{ent._count?.assets ?? 0} assets</Badge>
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={() => openEntityModal(ent)}
                    className='flex-1 py-2 rounded-xl text-xs font-semibold border border-border bg-accent text-foreground hover:bg-muted'
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => router.push(`/budgeting?entity=${ent.id}`)}
                    className='flex-1 py-2 rounded-xl text-xs font-semibold border border-border bg-accent text-foreground hover:bg-muted'
                  >
                    View Budgets
                  </button>
                  <button
                    onClick={() => deleteEntity(ent)}
                    className='px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100'
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'branches' && (
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3'>
            <h2 className='font-bold text-foreground'>
              Branches ({filteredBranches.length})
            </h2>
            <div className='flex items-center gap-3'>
              <SearchInput
                value={branchSearch}
                onChange={setBranchSearch}
                placeholder='Search branch name or entity…'
              />
              <button
                onClick={() => openBranchModal()}
                className='px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                + New Branch
              </button>
            </div>
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted/40'>
                  {[
                    'Branch',
                    'Code',
                    'Entity',
                    'Address',
                    'Manager',
                    'Budgets',
                    'Assets',
                    'Active',
                    'Actions'
                  ].map(h => (
                    <th
                      key={h}
                      className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBranches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className='px-4 py-10 text-center text-muted-foreground text-sm'
                    >
                      {branchSearch
                        ? `No branches match "${branchSearch}"`
                        : 'No branches created yet. Click + New Branch to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredBranches.map(b => (
                    <tr
                      key={b.id}
                      className={`border-t border-border hover:bg-accent/20 ${
                        !b.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <td className='px-4 py-3.5 font-semibold text-sm text-foreground'>
                        {b.name}
                      </td>
                      <td className='px-4 py-3.5'>
                        {b.code && (
                          <code className='bg-muted px-2 py-0.5 rounded text-xs font-bold text-foreground'>
                            {b.code}
                          </code>
                        )}
                      </td>
                      <td className='px-4 py-3.5 text-sm text-muted-foreground'>
                        {b.entity?.code}
                      </td>
                      <td className='px-4 py-3.5 text-xs text-muted-foreground max-w-[140px] truncate'>
                        {b.address ?? '—'}
                      </td>
                      <td className='px-4 py-3.5 text-sm text-muted-foreground'>
                        {b.manager ?? '—'}
                      </td>
                      <td className='px-4 py-3.5 text-sm text-center text-muted-foreground'>
                        {b._count?.budgets ?? 0}
                      </td>
                      <td className='px-4 py-3.5 text-sm text-center text-muted-foreground'>
                        {b._count?.assets ?? 0}
                      </td>
                      <td className='px-4 py-3.5'>
                        <Switch
                          checked={b.isActive}
                          onChange={() => toggleBranch(b)}
                        />
                      </td>
                      <td className='px-4 py-3.5'>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => openBranchModal(b)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent border border-border text-foreground hover:bg-muted'
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteBranch(b)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'gl' && (
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3'>
            <h2 className='font-bold text-foreground'>
              GL Accounts ({filteredGLs.length})
            </h2>
            <div className='flex items-center gap-3'>
              <select
                value={glEntityFilter}
                onChange={e => setGLEntityFilter(e.target.value)}
                className='px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm'
              >
                <option value=''>All Entities</option>
                {entities.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.code}</option>
                ))}
              </select>
              <SearchInput
                value={glSearch}
                onChange={setGLSearch}
                placeholder='Search code, name or category…'
              />
              <button
                onClick={() => router.push('/admin/gl-accounts/import')}
                className='px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap border border-border bg-card text-foreground hover:bg-accent'
              >
                📥 Import Accounts
              </button>
              <button
                onClick={() => openGLModal()}
                className='px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                + New GL Account
              </button>
            </div>
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted/40'>
                  {[
                    'Code',
                    'Account Name',
                    'Category',
                    'Entities',
                    'Description',
                    'Active',
                    'Actions'
                  ].map(h => (
                    <th
                      key={h}
                      className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGLs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className='px-4 py-10 text-center text-muted-foreground text-sm'
                    >
                      No GL accounts match "{glSearch}"
                    </td>
                  </tr>
                ) : (
                  filteredGLs.map(gl => (
                    <tr
                      key={gl.id}
                      className={`border-t border-border hover:bg-accent/20 ${
                        !gl.isActive ? 'opacity-50' : ''
                      }`}
                    >
                      <td className='px-4 py-3.5'>
                        <code className='bg-muted px-2.5 py-1 rounded-lg text-xs font-bold text-[#1B2A8A] dark:text-blue-300'>
                          {gl.code}
                        </code>
                      </td>
                      <td className='px-4 py-3.5 font-semibold text-sm text-foreground'>
                        {gl.name}
                      </td>
                      <td className='px-4 py-3.5'>
                        <Badge variant='blue'>{gl.category}</Badge>
                      </td>
                      <td className='px-4 py-3.5'>
                        <div className='flex flex-wrap gap-1'>
                          {(gl.entityAccounts ?? []).length === 0 ? (
                            <span className='text-xs text-muted-foreground'>Not linked</span>
                          ) : (
                            (gl.entityAccounts ?? []).map((ea: any) => (
                              <span key={ea.id} className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground'>
                                {ea.entity?.code}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className='px-4 py-3.5 text-xs text-muted-foreground max-w-[180px] truncate'>
                        {gl.description ?? '—'}
                      </td>
                      <td className='px-4 py-3.5'>
                        <Switch
                          checked={gl.isActive}
                          onChange={() => toggleGL(gl)}
                        />
                      </td>
                      <td className='px-4 py-3.5'>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => router.push(`/admin/gl-accounts/${gl.id}`)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent border border-border text-foreground hover:bg-muted'
                          >
                            View
                          </button>
                          <button
                            onClick={() => openGLModal(gl)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent border border-border text-foreground hover:bg-muted'
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteGL(gl)}
                            className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'workflows' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='font-bold text-foreground'>Approval Workflows</h2>
              <p className='text-sm text-muted-foreground mt-0.5'>
                Configure sequential approval chains for Assets, Invoices and
                other modules.
              </p>
            </div>
            <button
              onClick={() => {
                setWorkflowForm({
                  name: '',
                  entityIds: [],
                  module: 'invoice',
                  actions: ['SUBMIT'],
                  description: '',
                  steps: [
                    {
                      userId: '',
                      stepNumber: 1,
                      approvalLimitAmount: '',
                      isExceptionalApprover: false
                    }
                  ]
                })

                setWorkflowModal({
                  open: true,
                  editing: undefined
                })
              }}
              className='px-4 py-2 rounded-xl text-sm font-bold'
              style={{ background: '#FFB800', color: '#1B2A8A' }}
            >
              + New Workflow
            </button>
          </div>

          <div className='grid gap-4'>
            {workflows.length === 0 ? (
              <div className='bg-card border border-border rounded-2xl py-12 flex flex-col items-center gap-3 text-muted-foreground'>
                <span className='text-4xl'>⚙️</span>
                <span className='font-semibold'>No approval workflows yet</span>
                <p className='text-sm text-center max-w-md'>
                  Create workflows to control how assets and invoices get
                  approved. Each workflow can have multiple sequential
                  approvers.
                </p>
                <button
                  onClick={() => setWorkflowModal({ open: true })}
                  className='mt-2 px-5 py-2.5 rounded-xl text-sm font-bold border-2 border-dashed border-[#FFB800] text-[#FFB800] hover:bg-[#FFB800]/10'
                >
                  + Create First Workflow
                </button>
              </div>
            ) : (
              workflows.map((wf: any) => (
                <div
                  key={wf.id}
                  className='bg-card border border-border rounded-2xl p-5'
                >
                  <div className='flex items-start justify-between mb-3'>
                    <div>
                      <div className='flex items-center gap-2 mb-1'>
                        <span className='font-bold text-foreground'>
                          {wf.name}
                        </span>
                        <Badge variant={wf.isActive ? 'green' : 'red'}>
                          {wf.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant='blue'>{wf.module.toUpperCase()}</Badge>
                        {wf.action && <Badge variant='gray'>{wf.action}</Badge>}
                        {wf.entity && (
                          <Badge variant='navy'>{wf.entity.code}</Badge>
                        )}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {wf.description ?? 'No description'}
                      </p>
                    </div>
                    <div className='flex gap-2'>
                      <button
                        onClick={() => {
                          setWorkflowForm({
                            name: wf.name,
                            entityIds: wf.entityId ? [wf.entityId] : [],
                            module: wf.module,
                            actions: wf.action ? [wf.action] : (MODULE_ACTIONS[wf.module]?.[0] ? [MODULE_ACTIONS[wf.module][0].value] : []),
                            description: wf.description ?? '',
                            steps: (wf.steps ?? [])
                              .sort(
                                (a: any, b: any) => a.stepNumber - b.stepNumber
                              )
                              .map((s: any) => ({
                                userId: s.userId || s.user?.id || '',
                                stepNumber: s.stepNumber,
                                approvalLimitAmount: s.approvalLimitAmount ?? '',
                                isExceptionalApprover: s.isExceptionalApprover ?? false
                              }))
                          })
                          setWorkflowModal({ open: true, editing: wf })
                        }}
                        className='px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-accent text-foreground hover:bg-muted'
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() =>
                          apiCall(`/api/approval-workflows/${wf.id}`, 'PATCH', {
                            isActive: !wf.isActive
                          }).then(() =>
                            setWorkflows((p: any[]) =>
                              p.map(x =>
                                x.id === wf.id
                                  ? { ...x, isActive: !x.isActive }
                                  : x
                              )
                            )
                          )
                        }
                        className='px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-accent text-foreground hover:bg-muted'
                      >
                        {wf.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete workflow "${wf.name}"? This action is permanent.`
                            )
                          )
                            return
                          try {
                            await apiCall(
                              `/api/approval-workflows/${wf.id}`,
                              'DELETE'
                            )
                            showToast('Workflow Deleted successfully', true)
                          } catch (err: any) {
                            if (err.message.includes('active approval')) {
                              showToast(err.message, false)
                              return
                            }

                            showToast(err.message, false)
                          }
                          setWorkflows((p: any[]) =>
                            p.filter(x => x.id !== wf.id)
                          )
                          showToast('Workflow deleted')
                        }}
                        className='px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100'
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>

                  <div className='flex items-center gap-2 flex-wrap mt-3'>
                    {(wf.steps ?? [])
                      .sort((a: any, b: any) => a.stepNumber - b.stepNumber)
                      .map((step: any, i: number) => (
                        <div key={step.id} className='flex items-center gap-2'>
                          <div className='flex items-center gap-2 bg-[#1B2A8A]/10 dark:bg-[#1B2A8A]/20 border border-[#1B2A8A]/20 rounded-xl px-3 py-2'>
                            <div className='w-5 h-5 rounded-full bg-[#FFB800] text-[#1B2A8A] flex items-center justify-center text-xs font-extrabold'>
                              {step.stepNumber}
                            </div>
                            <div>
                              <div className='text-xs font-bold text-foreground'>
                                {step.user?.name ?? step.role?.name ?? step.roleName ?? 'Unassigned'}
                                {step.isExceptionalApprover && (
                                  <span className='ml-1 text-[9px] text-amber-600 dark:text-amber-400'>
                                    ⚠︎
                                  </span>
                                )}
                              </div>
                              {step.approvalLimitAmount && (
                                <div className='text-[10px] text-muted-foreground'>
                                  Limit: ₦
                                  {Number(
                                    step.approvalLimitAmount
                                  ).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                          {i < (wf.steps ?? []).length - 1 && (
                            <span className='text-muted-foreground text-sm font-bold'>
                              →
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {workflowModal.open && (
            <div
              className='fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4'
            >
              <div
                className='bg-card border border-border rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto'
              >
                <h3 className='font-bold text-foreground text-lg mb-5'>
                  {workflowModal.editing
                    ? 'Edit Workflow'
                    : 'Create Approval Workflow'}
                </h3>
                <div className='space-y-4'>
                  <div>
                    <label className={labelCls}>Workflow Name *</label>
                    <input
                      type='text'
                      className={inputCls}
                      placeholder='e.g. Asset Registration Approval'
                      value={workflowForm.name}
                      onChange={e =>
                        setWorkflowForm(p => ({ ...p, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='relative'>
                      <label className={labelCls}>
                        Entities *{' '}
                        <span className='text-muted-foreground font-normal normal-case'>
                          (select all that apply)
                        </span>
                      </label>
                      <button
                        type='button'
                        onClick={() => setEntityPickerOpen(o => !o)}
                        className={`${inputCls} text-left flex items-center justify-between min-h-[42px]`}
                      >
                        {workflowForm.entityIds.length === 0 ? (
                          <span className='text-muted-foreground'>Select entities…</span>
                        ) : (
                          <span className='flex flex-wrap gap-1'>
                            {workflowForm.entityIds.map(id => {
                              const ent = entities.find((e: any) => e.id === id)
                              return (
                                <span
                                  key={id}
                                  className='inline-flex items-center gap-1 bg-[#1B2A8A]/10 text-[#1B2A8A] dark:text-[#8ea1ff] text-[11px] font-bold px-2 py-0.5 rounded-full'
                                >
                                  {ent?.code ?? '?'}
                                  <span
                                    role='button'
                                    onClick={e => {
                                      e.stopPropagation()
                                      setWorkflowForm(p => ({
                                        ...p,
                                        entityIds: p.entityIds.filter(x => x !== id)
                                      }))
                                    }}
                                    className='hover:text-red-500'
                                  >
                                    ✕
                                  </span>
                                </span>
                              )
                            })}
                          </span>
                        )}
                      </button>
                      {entityPickerOpen && (
                        <div className='absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto'>
                          {entities.map((ent: any) => {
                            const checked = workflowForm.entityIds.includes(ent.id)
                            return (
                              <label
                                key={ent.id}
                                className='flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer'
                              >
                                <input
                                  type='checkbox'
                                  checked={checked}
                                  onChange={() =>
                                    setWorkflowForm(p => ({
                                      ...p,
                                      entityIds: checked
                                        ? p.entityIds.filter(x => x !== ent.id)
                                        : [...p.entityIds, ent.id]
                                    }))
                                  }
                                  className='w-3.5 h-3.5 accent-[#FFB800] cursor-pointer'
                                />
                                <span className='text-foreground'>
                                  {ent.name} ({ent.code})
                                </span>
                              </label>
                            )
                          })}
                          <div className='p-2 border-t border-border sticky bottom-0 bg-card'>
                            <button
                              type='button'
                              onClick={() => setEntityPickerOpen(false)}
                              className='w-full text-xs font-bold text-[#FFB800] hover:underline py-1'
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                      {workflowForm.entityIds.length > 1 && (
                        <p className='text-[10px] text-muted-foreground mt-1'>
                          Creates one workflow per selected entity (same approvers/steps in each).
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Application Module *</label>
                      <select
                        className={inputCls}
                        value={workflowForm.module}
                        onChange={e => {
                          const mod = e.target.value
                          const firstAction = MODULE_ACTIONS[mod]?.[0]?.value
                          setWorkflowForm(p => ({
                            ...p,
                            module: mod,
                            actions: firstAction ? [firstAction] : []
                          }))
                        }}
                      >
                        {MODULE_OPTIONS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Action(s) *</label>
                      <div className='space-y-1.5 bg-muted/30 rounded-xl p-3 border border-border max-h-40 overflow-y-auto'>
                        {(MODULE_ACTIONS[workflowForm.module] ?? []).map(a => {
                          const checked = workflowForm.actions.includes(a.value)
                          return (
                            <label
                              key={a.value}
                              className='flex items-center gap-2.5 text-sm text-foreground cursor-pointer'
                            >
                              <input
                                type='checkbox'
                                checked={checked}
                                onChange={() =>
                                  setWorkflowForm(p => ({
                                    ...p,
                                    actions: checked
                                      ? p.actions.filter(x => x !== a.value)
                                      : [...p.actions, a.value]
                                  }))
                                }
                                className='accent-[#FFB800] w-3.5 h-3.5 cursor-pointer'
                              />
                              {a.label}
                            </label>
                          )
                        })}
                      </div>
                      {workflowForm.actions.length > 1 && (
                        <p className='text-[10px] text-muted-foreground mt-1'>
                          Creates one workflow per selected action (same approvers/steps in each) — the approver is notified separately for each action they need to approve.
                        </p>
                      )}
                      {MODULE_ACTIONS[workflowForm.module]?.length === 1 && (
                        <p className='text-[10px] text-muted-foreground mt-1'>
                          This module doesn't distinguish between actions yet — any submission for it uses this one approval chain.
                        </p>
                      )}
                      {MODULES_NOT_YET_WIRED.has(workflowForm.module) && (
                        <p className='text-[10px] text-amber-600 dark:text-amber-400 mt-1'>
                          ⚠ Not yet wired to a live trigger in the app — creating this workflow won't be picked up by anything until that module's code is built to look it up.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      className={inputCls}
                      rows={2}
                      placeholder='What does this workflow approve?'
                      value={workflowForm.description}
                      onChange={e =>
                        setWorkflowForm(p => ({
                          ...p,
                          description: e.target.value
                        }))
                      }
                    />
                  </div>

                  <div>
                    <div className='flex items-center justify-between mb-2'>
                      <label className={labelCls}>
                        Approval Steps (Sequential)
                      </label>
                      <button
                        type='button'
                        onClick={() =>
                          setWorkflowForm(p => ({
                            ...p,
                            steps: [
                              ...p.steps,
                              {
                                userId: '',
                                stepNumber: p.steps.length + 1,
                                approvalLimitAmount: '',
                                isExceptionalApprover: false
                              }
                            ]
                          }))
                        }
                        className='text-xs font-bold text-[#FFB800] hover:underline'
                      >
                        + Add Step
                      </button>
                    </div>
                    <p className='text-xs text-muted-foreground mb-2'>
                      Multiple rows can share the same Step # — that means
                      more than one eligible approver at that sequence
                      position, from which the requester picks one.
                    </p>
                    <div className='space-y-2'>
                      {workflowForm.steps.map((step, i) => {
                        const eligibleUsers = users.filter((u: any) => {
                          if (!workflowForm.entityIds.length) return true
                          return (
                            workflowForm.entityIds.includes(u.entityId) ||
                            u.entityAccess?.some((ea: any) =>
                              workflowForm.entityIds.includes(ea.entityId)
                            )
                          )
                        })
                        const search = (workflowApproverSearch[i] ?? '').toLowerCase()
                        const filteredUsers = eligibleUsers.filter(
                          (u: any) =>
                            !search ||
                            u.name?.toLowerCase().includes(search) ||
                            u.email?.toLowerCase().includes(search)
                        )
                        return (
                        <div
                          key={i}
                          className='flex items-start gap-2 bg-muted/40 rounded-xl p-3 border border-border'
                        >
                          <input
                            type='number'
                            min='1'
                            title='Step #'
                            value={step.stepNumber}
                            onChange={e =>
                              setWorkflowForm(p => ({
                                ...p,
                                steps: p.steps.map((s, j) =>
                                  j === i
                                    ? { ...s, stepNumber: Number(e.target.value) || 1 }
                                    : s
                                )
                              }))
                            }
                            className='w-14 flex-shrink-0 px-2 py-2 rounded-lg border border-border bg-background text-foreground text-sm text-center font-extrabold focus:outline-none'
                          />
                          <div className='flex-1 space-y-1.5'>
                            <input
                              type='text'
                              placeholder='Search approver by name or email…'
                              className='w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none'
                              value={workflowApproverSearch[i] ?? ''}
                              onChange={e =>
                                setWorkflowApproverSearch(prev => ({
                                  ...prev,
                                  [i]: e.target.value
                                }))
                              }
                            />
                            <select
                              className='w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none'
                              value={step.userId}
                              onChange={e =>
                                setWorkflowForm(p => ({
                                  ...p,
                                  steps: p.steps.map((s, j) =>
                                    j === i
                                      ? { ...s, userId: e.target.value }
                                      : s
                                  )
                                }))
                              }
                            >
                              <option value=''>Select approver…</option>
                              {filteredUsers.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                            </select>

                            {workflowForm.module === 'invoice' && (
                              <div className='flex items-center gap-2'>
                                <input
                                  type='number'
                                  min='0'
                                  placeholder='Approval limit ₦ (blank = No Limit)'
                                  className='flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none'
                                  value={step.approvalLimitAmount ?? ''}
                                  onChange={e =>
                                    setWorkflowForm(p => ({
                                      ...p,
                                      steps: p.steps.map((s, j) =>
                                        j === i
                                          ? {
                                              ...s,
                                              approvalLimitAmount: e.target.value
                                            }
                                          : s
                                      )
                                    }))
                                  }
                                />
                                <label className='flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap cursor-pointer'>
                                  <input
                                    type='checkbox'
                                    checked={step.isExceptionalApprover}
                                    onChange={e =>
                                      setWorkflowForm(p => ({
                                        ...p,
                                        steps: p.steps.map((s, j) =>
                                          j === i
                                            ? {
                                                ...s,
                                                isExceptionalApprover: e.target.checked
                                              }
                                            : s
                                        )
                                      }))
                                    }
                                    className='w-3.5 h-3.5 accent-[#FFB800] cursor-pointer'
                                  />
                                  Exceptional Approver
                                </label>
                              </div>
                            )}
                          </div>
                          {workflowForm.steps.length > 1 && (
                            <button
                              type='button'
                              onClick={() =>
                                setWorkflowForm(p => ({
                                  ...p,
                                  steps: p.steps.filter((_, j) => j !== i)
                                }))
                              }
                              className='text-red-500 hover:text-red-700 text-sm font-bold px-2'
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className='flex gap-3 pt-2'>
                    <button
                      onClick={async () => {
                        if (!workflowForm.name || !workflowForm.module) {
                          showToast('Name and module are required', false)
                          return
                        }
                        if (!workflowForm.entityIds.length) {
                          showToast('At least one entity is required', false)
                          return
                        }
                        if (!workflowForm.actions.length) {
                          showToast('At least one action is required', false)
                          return
                        }
                        if (workflowForm.steps.some(s => !s.userId)) {
                          showToast('Every step needs an approver selected', false)
                          return
                        }

                        const stepsPayload = workflowForm.steps.map(s => ({
                          userId: s.userId,
                          stepNumber: s.stepNumber,
                          approvalLimitAmount:
                            workflowForm.module === 'invoice' && s.approvalLimitAmount
                              ? Number(s.approvalLimitAmount)
                              : undefined,
                          isExceptionalApprover:
                            workflowForm.module === 'invoice'
                              ? s.isExceptionalApprover
                              : false
                        }))

                        const actionLabel = (val: string) =>
                          (MODULE_ACTIONS[workflowForm.module] ?? []).find(a => a.value === val)?.label ?? val
                        const nameFor = (entId: string, actionVal: string) => {
                          let n = workflowForm.name
                          if (workflowForm.entityIds.length > 1) {
                            const ent = entities.find((e: any) => e.id === entId)
                            n += ` (${ent?.code ?? entId})`
                          }
                          if (workflowForm.actions.length > 1) {
                            n += ` — ${actionLabel(actionVal)}`
                          }
                          return n
                        }

                        const combos: { entId: string; actionVal: string }[] = []
                        for (const entId of workflowForm.entityIds) {
                          for (const actionVal of workflowForm.actions) {
                            combos.push({ entId, actionVal })
                          }
                        }

                        try {
                          const created: any[] = []
                          const failed: string[] = []

                          if (workflowModal.editing?.id) {
                            const [first, ...rest] = combos

                            const data = await apiCall(
                              `/api/approval-workflows/${workflowModal.editing.id}`,
                              'PATCH',
                              {
                                name: nameFor(first.entId, first.actionVal),
                                entityId: first.entId,
                                module: workflowForm.module,
                                action: first.actionVal,
                                description: workflowForm.description,
                                isActive: true,
                                steps: stepsPayload
                              }
                            )
                            created.push(data.data)

                            for (const { entId, actionVal } of rest) {
                              try {
                                const extra = await apiCall(
                                  '/api/approval-workflows',
                                  'POST',
                                  {
                                    name: nameFor(entId, actionVal),
                                    entityId: entId,
                                    module: workflowForm.module,
                                    action: actionVal,
                                    description: workflowForm.description,
                                    isActive: true,
                                    steps: stepsPayload
                                  }
                                )
                                created.push(extra.data)
                              } catch (e: any) {
                                failed.push(`${nameFor(entId, actionVal)}: ${e.message}`)
                              }
                            }

                            setWorkflows((prev: any[]) => {
                              const withoutEdited = prev.filter(
                                w => w.id !== workflowModal.editing.id
                              )
                              return [...withoutEdited, ...created]
                            })

                            showToast(
                              rest.length
                                ? `Workflow updated — ${created.length} of ${combos.length} workflow(s) saved${failed.length ? `. ${failed.length} failed.` : ''}`
                                : 'Workflow updated',
                              failed.length === 0
                            )
                          }

                          else {
                            for (const { entId, actionVal } of combos) {
                              try {
                                const data = await apiCall(
                                  '/api/approval-workflows',
                                  'POST',
                                  {
                                    name: nameFor(entId, actionVal),
                                    entityId: entId,
                                    module: workflowForm.module,
                                    action: actionVal,
                                    description: workflowForm.description,
                                    isActive: true,
                                    steps: stepsPayload
                                  }
                                )
                                created.push(data.data)
                              } catch (e: any) {
                                failed.push(`${nameFor(entId, actionVal)}: ${e.message}`)
                              }
                            }

                            setWorkflows((prev: any[]) => [...prev, ...created])

                            if (failed.length) {
                              showToast(
                                `${created.length} of ${combos.length} workflow(s) created. Failed: ${failed.join(' | ')}`,
                                false
                              )
                            } else {
                              showToast(
                                created.length > 1
                                  ? `${created.length} workflows created`
                                  : 'Workflow created'
                              )
                            }
                          }

                          if (failed.length === 0) {
                            setWorkflowModal({ open: false })

                            setWorkflowForm({
                              name: '',
                              entityIds: [],
                              module: 'invoice',
                              actions: ['SUBMIT'],
                              description: '',
                              steps: [
                                {
                                  userId: '',
                                  stepNumber: 1,
                                  approvalLimitAmount: '',
                                  isExceptionalApprover: false
                                }
                              ]
                            })
                          }
                        } catch (err: any) {
                          showToast(err.message, false)
                        }
                      }}
                      className='px-5 py-2.5 rounded-xl text-sm font-bold'
                      style={{ background: '#FFB800', color: '#1B2A8A' }}
                    >
                      {workflowModal.editing
                        ? 'Update Workflow'
                        : 'Create Workflow'}
                    </button>

                    <button
                      onClick={() => setWorkflowModal({ open: false })}
                      className='px-5 py-2.5 rounded-xl text-sm font-bold border border-border bg-card text-muted-foreground hover:bg-accent'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'invite' && (
        <div className='max-w-lg'>
          <div className='bg-card border border-border rounded-2xl p-8'>
            <h2 className='font-bold text-foreground text-lg mb-1'>
              Invite New User
            </h2>
            <p className='text-sm text-muted-foreground mb-6'>
              An invitation link will be emailed via Resend. Expires in 7 days.
            </p>

            {inviteMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-sm font-medium border ${
                  inviteMsg.startsWith('✅')
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
                }`}
              >
=======
      {/* ── ENTITIES ── */}
      {tab === "entities" && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entities.map((ent) => (
              <div key={ent.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1B2A8A] text-white flex items-center justify-center font-extrabold text-xs">{ent.code}</div>
                  <div>
                    <div className="font-bold text-foreground text-sm">{ent.name}</div>
                    <div className="text-xs text-muted-foreground">{ent.type}</div>
                  </div>
                  <Badge variant={ent.isActive ? "green" : "red"} className="ml-auto">{ent.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="blue">{ent._count?.users ?? 0} users</Badge>
                  <Badge variant="navy">{ent._count?.budgets ?? 0} budgets</Badge>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border bg-accent text-foreground hover:bg-muted transition-colors">Edit</button>
                  <button className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border bg-accent text-foreground hover:bg-muted transition-colors">View Budgets</button>
                </div>
              </div>
            ))}
            <button className="border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-[#FFB800] hover:text-[#FFB800] transition-colors min-h-[120px]">
              <span className="text-2xl">+</span>
              <span className="text-sm font-semibold">Add Entity</span>
            </button>
          </div>
        </div>
      )}

      {/* ── GL ACCOUNTS ── */}
      {tab === "gl" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="font-bold text-foreground">GL Accounts ({glAccounts.length})</h2>
            <button className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: "#FFB800", color: "#1B2A8A" }}>+ New GL Account</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Code", "Account Name", "Category", "Description", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {glAccounts.map((gl) => (
                  <tr key={gl.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-bold text-[#1B2A8A] dark:text-blue-300">{gl.code}</code>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-sm text-foreground">{gl.name}</td>
                    <td className="px-4 py-3.5"><Badge variant="blue">{gl.category}</Badge></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground max-w-xs truncate">{gl.description ?? "—"}</td>
                    <td className="px-4 py-3.5"><Badge variant={gl.isActive ? "green" : "red"}>{gl.isActive ? "Active" : "Inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── INVITE USER ── */}
      {tab === "invite" && (
        <div className="max-w-lg">
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="font-bold text-foreground text-lg mb-1">Invite New User</h2>
            <p className="text-sm text-muted-foreground mb-6">An email invitation will be sent via Resend. Link expires in 7 days.</p>

            {inviteMsg && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${inviteMsg.startsWith("✅") ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"}`}>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                {inviteMsg}
              </div>
            )}

<<<<<<< HEAD
            <form onSubmit={sendInvite} className='space-y-4'>
              {[
                {
                  label: 'Full Name',
                  type: 'text',
                  key: 'name',
                  placeholder: 'e.g. Adaeze Okonkwo'
                },
                {
                  label: 'Email Address',
                  type: 'email',
                  key: 'email',
                  placeholder: 'user@addosser.com'
                }
              ].map(f => (
=======
            <form onSubmit={sendInvite} className="space-y-4">
              {[
                { label: "Full Name", type: "text", key: "name", placeholder: "e.g. Adaeze Okonkwo" },
                { label: "Email Address", type: "email", key: "email", placeholder: "user@addosser.com" },
              ].map((f) => (
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(inviteForm as any)[f.key]}
<<<<<<< HEAD
                    onChange={e =>
                      setInviteForm(p => ({ ...p, [f.key]: e.target.value }))
                    }
=======
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                    required
                    className={inputCls}
                  />
                </div>
              ))}

              <div>
                <label className={labelCls}>Assign Role</label>
<<<<<<< HEAD
                <select
                  className={inputCls}
                  value={inviteForm.roleId}
                  onChange={e =>
                    setInviteForm(p => ({ ...p, roleId: e.target.value }))
                  }
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
=======
                <select className={inputCls} value={inviteForm.roleId} onChange={(e) => setInviteForm((p) => ({ ...p, roleId: e.target.value }))}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                </select>
              </div>

              <div>
<<<<<<< HEAD
                <label className={labelCls}>Primary Entity</label>
                <select
                  className={inputCls}
                  value={inviteForm.entityId}
                  onChange={e =>
                    setInviteForm(p => ({ ...p, entityId: e.target.value }))
                  }
                >
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  Additional Entity Access{' '}
                  <span className='normal-case font-normal'>(optional)</span>
                </label>
                <p className='text-xs text-muted-foreground mb-2'>
                  User can view and approve transactions for these entities too.
                </p>
                <div className='space-y-2 bg-muted/30 rounded-xl p-3 border border-border'>
                  {entities
                    .filter(e => e.id !== inviteForm.entityId)
                    .map(e => (
                      <label
                        key={e.id}
                        className='flex items-center gap-3 cursor-pointer text-sm text-foreground'
                      >
                        <input
                          type='checkbox'
                          checked={inviteForm.extraEntityIds.includes(e.id)}
                          onChange={() => toggleExtraEntity(e.id)}
                          className='accent-[#FFB800] w-4 h-4'
                        />
                        <span>{e.name}</span>
                        <Badge variant='gray'>{e.code}</Badge>
                      </label>
                    ))}
                </div>
              </div>

              <button
                type='submit'
                disabled={inviteLoading}
                className='w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60 mt-2'
                style={{ background: '#1B2A8A', color: '#fff' }}
              >
                {inviteLoading ? 'Sending…' : '📧 Send Invitation'}
=======
                <label className={labelCls}>Assign Entity</label>
                <select className={inputCls} value={inviteForm.entityId} onChange={(e) => setInviteForm((p) => ({ ...p, entityId: e.target.value }))}>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60 transition-all mt-2"
                style={{ background: "#1B2A8A", color: "#fff" }}
              >
                {inviteLoading ? "Sending..." : "📧 Send Invitation"}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
              </button>
            </form>
          </div>
        </div>
      )}
<<<<<<< HEAD
      </div>
    </div>
  )
=======
    </div>
  );
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
