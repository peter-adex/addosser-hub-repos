# 🏦 Addosser Enterprise Hub

A full-stack enterprise management platform for **Addosser Microfinance Bank Ltd** and its subsidiaries — built with **Next.js 14**, **TypeScript**, **MySQL/Prisma**, **Shadcn/UI**, **Cloudinary**, and **Resend**.

---

## 📦 Modules

| Module | Description |
|---|---|
| 📊 **Budgeting** | GL account budgets per entity, monthly breakdown, YTD tracking, approval workflow |
| 🏗️ **Asset Management** | Register and track assets with GL-linked maintenance costs |
| 🏢 **Facility Management** | Facilities, work orders and maintenance costs |
| 🧾 **Invoice Processing** | Submit, review and approve vendor invoices |
| 🚗 **Fleet Management** | Vehicles, fuel and repair logs linked to GL accounts |
| ⚙️ **Admin Panel** | Users, roles, entities, GL accounts and permissions |

---

## 🔐 Role-Based Access Control (RBAC)

Every module has **5 granular permissions** per role — **no hardcoding**:

- `canView` — see the module and its data
- `canCreate` — add new records
- `canEdit` — modify existing records
- `canDelete` — remove records
- `canApprove` — approve/reject workflows (budgets, invoices)

Permissions are stored in the `role_permissions` table and resolved dynamically at runtime.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | MySQL via Prisma ORM |
| UI Library | Shadcn/UI + Tailwind CSS |
| Auth | NextAuth.js v4 (credentials + JWT) |
| Media | Cloudinary |
| Email | Resend + React Email |
| Charts | Recharts |

---

## 🚀 Quick Start

### 1. Clone and install

```bash
# Install dependencies
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
# Fill in your MySQL connection string, Cloudinary, Resend keys
```

### 3. Setup the database

```bash
# Push schema to MySQL
npx prisma db push

# Seed with default data (entities, roles, GL accounts, admin user)
npm run db:seed
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Admin Credentials
- **Email:** `admin@addosser.com`
- **Password:** `Admin@1234`

> ⚠️ Change this immediately after first login!

---

## 📁 Project Structure

```
addosser-hub/
├── app/
│   ├── (auth)/          # Login, accept invite pages
│   ├── (hub)/           # All authenticated app pages
│   │   ├── dashboard/
│   │   ├── budgeting/
│   │   ├── assets/
│   │   ├── facility/
│   │   ├── fleet/
│   │   ├── invoice/
│   │   └── admin/
│   └── api/             # All API routes
├── components/
│   ├── layout/          # Sidebar, Header
│   ├── budgeting/       # Budget-specific components
│   ├── admin/           # Admin panel components
│   ├── charts/          # Recharts wrappers
│   └── shared/          # StatCard, Badge, DataTable, etc.
├── lib/                 # Prisma, Auth, Budget utils, Cloudinary, Resend
├── hooks/               # usePermission, useCurrentUser
├── types/               # TypeScript type definitions
├── emails/              # React Email templates
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

---

## 🌍 Entities Seeded by Default

| Code | Name | Type |
|---|---|---|
| AMFB | Addosser Microfinance Bank Ltd | Bank |
| AFL | Addosser Finance Ltd | Finance |
| AIL | Addosser Investment Ltd | Investment |
| APL | Addosser Properties Ltd | Properties |

---

## 📋 Default GL Accounts

| Code | Name | Category |
|---|---|---|
| 5101 | R/M Motor | Repair & Maintenance |
| 5102 | Fuel Motor | Fuel & Lubricants |
| 5103 | R/M Building | Repair & Maintenance |
| 5104 | Office Supplies | Administrative |
| 5105 | Electricity | Utilities |
| 5106 | Generator Fuel | Fuel & Lubricants |
| 5107 | Staff Training | Human Resources |
| 5108 | IT Equipment | Technology |
| 5109 | Internet & Connectivity | Technology |
| 5110 | Staff Welfare | Human Resources |
| 5111 | Marketing & Advertising | Marketing |
| 5112 | Legal & Professional | Professional Services |
| 5113 | Insurance Premium | Insurance |
| 5114 | Rent & Rates | Occupancy |
| 5115 | Cleaning & Sanitation | Facility |

---

## 🔗 Budget Integration

Every module links its costs to the Budgeting module via GL account codes. Use the shared helper:

```typescript
import { getEntityGLBudgets } from "@/lib/budget";

// Fleet fetching fuel + R/M budgets
const budgets = await getEntityGLBudgets(entityId, ["5101", "5102"], 2025);
```

---

## 📧 Email Notifications

Powered by **Resend** + **React Email**:
- ✉️ User invitation emails
- ✅ Budget approval / ❌ rejection notifications
- 🧾 Invoice status updates

---

## 🎨 Theme

- **Primary colour:** `#FFB800` (Addosser Gold)
- **Navy:** `#1B2A8A`
- Supports **light and dark mode** via `next-themes`
- Custom Tailwind tokens for brand colours

---

## 📜 Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio (DB GUI)
npm run db:generate  # Regenerate Prisma client
```

---

## 🛡️ Security Notes

- Passwords are hashed with **bcryptjs** (12 rounds)
- JWT sessions expire after **8 hours**
- Invitation tokens expire after **7 days**
- All API routes validate permissions server-side
- Audit logs record every create/update/delete/approval action
- Approved budgets are locked from edits/deletes

---

*Built for Addosser Microfinance Bank Ltd — Enterprise Hub v1.0*
