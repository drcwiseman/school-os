# SchoolOS — Multi-Tenant Architecture

SchoolOS is a **multi-tenant education ERP SaaS**. Three **separate security domains** must never be mixed:

| Domain | Who | Database identity | Session cookie | Login URL |
|--------|-----|-------------------|----------------|-----------|
| **Platform** | SchoolOS company (SaaS operator) | `platform_admins` — **no `tenant_id`** | `platform_session_token` | `/platform/login` → `/platform/dashboard` |
| **Tenant staff** | School employees (admin, teacher, bursar, …) | `users` — **always has `tenant_id`** | `session_token` | `/s/:schoolSlug/login` → `/s/:schoolSlug/dashboard` |
| **Portal** | Parents & students only | `parent_accounts` / `student_accounts` — **tenant-scoped, not staff** | `portal_session_token` | `/s/:schoolSlug/portal/login` → `/s/:schoolSlug/portal/dashboard` |

> **Platform users ≠ Tenant users ≠ Portal users.**  
> They use different tables, cookies, middleware, and authorization models.

---

## A. Platform layer (global SaaS)

**Purpose:** Provision schools, plans, billing, feature toggles, suspension, support.

**Tables (no tenant_id):**

- `platform_admins`
- `platform_sessions`
- `plans` (global catalog)

**Cross-tenant reads** (analytics only) are allowed for platform admins; **writes** to tenant data go through explicit provisioning APIs that create rows with the correct `tenant_id`.

**NOT allowed:**

- Platform admins in `users`
- Reusing tenant `roles` / `permissions` for platform auth
- Staff `session_token` on `/api/platform/*`

---

## B. Tenant layer (one school)

**Purpose:** All school operations — students, finance, exams, HR, etc.

**Rule:** Every business row includes `tenant_id UUID NOT NULL`.

**Staff auth:**

```
/s/:slug/login → resolveTenant → users (tenant_id) → RBAC → dashboard
```

**RBAC:**

- `permissions` — global catalog of atomic codes (`students.view`, `finance.invoice.create`, …)
- `roles` — **per tenant** (`tenant_id`)
- `role_permissions`, `user_roles` — **per tenant**

Roles are **permission bundles only**. Example bundles:

| Role | Typical permissions |
|------|---------------------|
| **Tenant Admin** | Broad school ops + `rbac.manage.*` + `settings.manage` — **not** platform access |
| **Bursar** | `finance.*`, `reports.view` |
| **Teacher** | `attendance.*`, `exams.enter_marks`, `students.view`, `academics.view` |
| **HR Manager** | `hr.*`, `payroll.view` |
| **Librarian** | `library.*` only |
| **Nurse** | `health.*` only |
| **Transport Officer** | `transport.*` only |
| **Deputy Admin** | School ops modules, no `rbac.*` |
| **Receptionist** | `admissions.*`, `students.view`, `messaging.*` |

**Tenant Admin cannot:**

- Access platform console
- Bypass `tenant_id` filters
- Change SaaS plan limits (platform-only)

**Query rule:** All tenant queries use `WHERE tenant_id = ctx.tenantId` via `getTenantId(req)` / `tenantScope(req)`.

---

## C. Portal layer (ownership, not RBAC)

**Purpose:** Parents see linked children; students see own records.

**Tables:**

- `parent_accounts` + `parent_sessions` — guardian-linked
- `student_accounts` + `student_sessions` — single-student linked

**Authorization model:** **Ownership-based access control (OBAC)**, not staff RBAC.

- **Parent:** only students linked via `student_guardians` → `guardian_id`
- **Student:** only `student_accounts.student_id`

Parents/students **never** receive `students.view` or other staff permissions.

```
/s/:slug/portal/login → parent_accounts | student_accounts → portal_session → OBAC checks on each API
```

---

## Feature flags (relational)

Do not rely on `tenant_settings.feature_flags_json` for new work.

**Canonical:**

- `features` — global catalog (`code`, `name`)
- `tenant_features` — `tenant_id`, `feature_id`, `enabled`

Legacy JSON is synced for backward compatibility during migration.

Plan enforcement: `plans.features_json` + `tenant_plans` + `tenant_features`.

---

## Soft delete

Critical entities use `deleted_at` / `deleted_by` instead of hard delete:

- `users`, `students`, `invoices`, `payments`

List endpoints filter `deleted_at IS NULL` by default. Soft-delete / void APIs:

| Entity | Endpoint | Notes |
|--------|----------|--------|
| Students | `DELETE /s/:slug/api/students/:id` | Sets `deleted_at` |
| Staff users | `DELETE /s/:slug/api/admin/users/:id` | Sets `deleted_at` |
| Invoices | `DELETE /s/:slug/api/finance/invoices/:id` | Sets `deleted_at` |
| Payments | `POST /s/:slug/api/finance/payments/:id/void` | Reverses invoice allocation + soft-delete |
| Exam marks | `DELETE /s/:slug/api/exams/marks/:id` | Sets `deleted_at` |
| Payroll runs | `DELETE /s/:slug/api/payroll/runs/:id` | Draft/pending only; voids line items |

`audit_logs` are **append-only** (DB triggers block UPDATE/DELETE).

### Platform feature API

- `GET /api/platform/features` — global catalog
- `GET /api/platform/tenants/:slug/features` — per-tenant toggles
- `PATCH /api/platform/tenants/:slug/features` — body `{ features: [{ code, enabled }] }`

New tenants provisioned via platform get all catalog features enabled by default.

---

## Module boundaries (operations)

**Do not** grant one “operations” super-permission.

Separate permission modules:

- `discipline.*`
- `health.*`
- `library.*`
- `inventory.*`
- `transport.*`
- `boarding.*`

UI sidebar exposes each module independently (permission-gated).

---

## Audit

- **HTTP logs:** stdout / PM2 (`[timestamp] METHOD url status ms`)
- **Marketing leads:** `[LEAD]` on stdout
- **Audit trail:** `audit_logs` table — **append-only**, viewed under **Users & Roles → Audit Log**

---

## File uploads

```
/uploads/{tenantId}/...
```

Never a shared flat upload root across tenants.

---

## Role hierarchy (target)

```
PLATFORM
└── Super Admin (platform_admins)

TENANT (staff — users table)
├── Tenant Admin
├── Deputy Admin
├── Academic Head
├── Bursar
├── HR Manager
├── Teacher
├── Librarian
├── Nurse
├── Transport Officer
├── Boarding Master
└── Receptionist

PORTAL (parent_accounts, student_accounts)
├── Parent
└── Student
```

---

## API map

| Area | Prefix |
|------|--------|
| Health | `GET /api/health` |
| Marketing | `POST /api/public/leads` |
| Platform | `/api/platform/*` |
| Staff (per school) | `/s/:schoolSlug/api/*` |
| Portal (per school) | `/s/:schoolSlug/api/portal/*` |

---

## Demo credentials (after `npm run db:seed`)

See [README](../README.md#logging-in).

---

## Implementation phases (summary)

| Phase | Focus |
|-------|--------|
| **1–2** | Core ERP modules, tenant RBAC, operations split |
| **3** | Payment void, mark/payroll soft delete, append-only `audit_logs`, relational platform feature flags |
| **4** | Extended soft delete (assessments, fee structures, staff), plan ↔ feature enforcement, platform role permissions, staff UI for void/delete |
| **5** | Tenant suspend/activate, staff user status, portal dashboard enrichment, students/users/fee-structure UI |
| **6** | Portal PDF downloads (OBAC), settings↔feature sync, marks entry UI, audit actor names, sidebar portal link |
| **7** | Finance collect payment, admissions pipeline stages, exam class roster, audit filter, platform tenant audit |

### Phase 4 details

**Soft delete** (sets `deleted_at`, never hard-deletes business rows):

- Assessments, fee structures, staff (migration `0007`)
- Existing: invoices, payments (void), users, students, payroll runs, marks

**Plan & tenant features**

- `plans.features_json` uses catalog codes: `messaging_enabled`, `portal_enabled`, …
- `tenant_features` overrides per school; `requireTenantFeature()` middleware gates routes
- `GET /s/:slug/api/auth/me` returns `modules: { messaging_enabled, portal_enabled }` for sidebar gating

**Platform permissions**

- Beyond `super_admin` string: `platform-permissions.ts` + `requirePlatformPermission()` on `/api/platform/*`

**Staff UI**

- Finance: void payments, remove invoices
- Exams: remove assessments
- Payroll: remove draft runs
- HR: remove staff (via ModuleCrud)

### Phase 5 details

**Tenant lifecycle (platform)**

- `PATCH /api/platform/tenants/:slug/status` — `active` | `suspended` | `trial` (permission: `tenants.suspend`)
- Suspended schools are blocked at `resolveTenant` for staff and portal routes

**Staff account lifecycle**

- `PATCH /s/:slug/api/admin/users/:userId/status` — activate, suspend, disable (not soft-delete)
- Soft-delete remains `DELETE .../admin/users/:userId`
- Sessions only validate `status === active`

**Portal (OBAC)**

- Parent dashboard: children, fee statements (non-deleted invoices), report cards, attendance, announcements
- Student dashboard: profile, assignments, report card, attendance

**Staff UI (remaining soft-delete / admin)**

- Students: remove (soft-delete)
- Users & Roles: suspend / disable / remove
- Finance: fee structures tab with remove

### Phase 6 details

**Portal PDFs (ownership-checked)**

- `GET /s/:slug/api/portal/pdf/report-card/:id` — published card, `results_visible` + optional `fees_must_be_clear`
- `GET /s/:slug/api/portal/pdf/receipt/:id` — receipt for linked child/student only

**Settings ↔ relational features**

- `PATCH /api/settings` syncs `featureFlagsJson` to `tenant_features` via `setTenantFeaturesBulk`
- `GET /api/settings` merges relational flags into response

**Staff UI**

- Exams: marks entry tab, publish report cards, staff PDF export
- Audit log: shows actor email (joined from `users`)
- Sidebar: Parent portal link when `portal_enabled`

### Phase 7 details

**Finance collections**

- **Collect** tab: record payment against unpaid invoice (creates receipt, updates invoice balance)

**Admissions pipeline**

- Stage dropdown per applicant: inquiry → interview → offered → rejected → enrolled

**Exams**

- Class/subject pickers from academics API
- `GET /exams/assessments/:id/roster` — class enrollment + existing marks for marks entry

**Audit**

- `GET /admin/audit-logs?action=...` — partial match filter
- Platform tenant suspend/activate writes `tenant.status.update` to school audit log
