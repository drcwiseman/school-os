# SchoolOS — Multi-Tenant Architecture

SchoolOS is a **multi-tenant education ERP SaaS**. Three **separate security domains** must never be mixed:

| Domain | Who | Database identity | Session cookie | Login URL |
|--------|-----|-------------------|----------------|-----------|
| **Platform** | SchoolOS company (SaaS operator) | `platform_admins` — **no `tenant_id`** | `platform_session_token` | `/platform/login` → `/platform/dashboard` |
| **Tenant staff** | School employees (admin, teacher, bursar, …) | `users` — **always has `tenant_id`** | `session_token` | `/s/:schoolSlug/login` → `/s/:schoolSlug/dashboard` |
| **Portal** | Parents & students only | `portal_accounts` — **tenant-scoped, not staff** | `portal_session_token` | `/s/:schoolSlug/portal/login` → `/s/:schoolSlug/portal/dashboard` |

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

**Tenant Admin cannot:**

- Access platform console
- Bypass `tenant_id` filters
- Change SaaS plan limits (platform-only)

**Query rule:** All tenant queries use `WHERE tenant_id = ctx.tenantId` via `getTenantId(req)` / `tenantScope(req)`.

---

## C. Portal layer (ownership, not RBAC)

**Purpose:** Parents see linked children; students see own records.

**Tables:**

- `portal_accounts` (type `parent` | `student`) — separate from `users`
- `portal_sessions`

**Authorization model:** **Ownership-based access control (OBAC)**, not staff RBAC.

- **Parent:** only students linked via `student_guardians` → `guardian_id`
- **Student:** only `portal_accounts.student_id`

Parents/students **never** receive `students.view` or other staff permissions.

```
/s/:slug/portal/login → portal_accounts → portal_session → OBAC checks on each API
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

List endpoints filter `deleted_at IS NULL` by default.

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

PORTAL (portal_accounts)
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
