# SchoolOS — Multi-Tenant Architecture

SchoolOS is a **multi-tenant education ERP SaaS**. For the **enterprise SaaS ecosystem blueprint** (auto-provision, domains, add-ons, usage billing, multi-campus, AI, mobile) and competitive positioning, see **[SAAS-ECOSYSTEM.md](./SAAS-ECOSYSTEM.md)**.

Three **separate security domains** must never be mixed:

| Domain | Who | Database identity | Session cookie | Login URL |
|--------|-----|-------------------|----------------|-----------|
| **Platform** | SchoolOS company (SaaS operator) | `platform_admins` — **no `tenant_id`** | `platform_session_token` | `/platform/login` → `/platform/dashboard` |
| **School ERP users** | School **administrators** and delegated operators (bursar, deputy, HR manager with login) — **not** every teacher | `users` — **always has `tenant_id`** | `session_token` | `/s/:schoolSlug/login` → `/s/:schoolSlug/dashboard` |
| **Portal** | Parents & students only | `parent_accounts` / `student_accounts` — **tenant-scoped, not staff** | `portal_session_token` | `/s/:schoolSlug/portal/login` → `/s/:schoolSlug/portal/dashboard` |

> **Platform users ≠ School ERP users ≠ Portal users.**  
> They use different tables, cookies, middleware, and authorization models.

### Terminology (schools in Uganda & East Africa)

| Term in SchoolOS | Meaning | Database |
|------------------|---------|----------|
| **Tenant** | One **school** (organisation), e.g. *St. Mary's SS Kampala* | `tenants` |
| **School administrator** | Person who runs the ERP (often bursar or IT; may be headteacher) | `users` + role e.g. *School Administrator* |
| **Employee / staff** | People employed by the school: **headteacher, teachers, secretaries**, drivers, etc. | `staff` (HR) — may have **no** login |
| **Teacher (with login)** | Employee who is also given an ERP account for attendance/marks | `staff` + optional `users.user_id` link |

**Important:** `/s/:schoolSlug/login` is for **school ERP accounts** (`users`), not for every employee. Teachers and secretaries appear in **HR → Staff**; only assign a `users` account when they need system access.

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
In product language: **tenant = school**; **tenant admin = school administrator** (ERP operator), not the whole teaching staff.

**Rule:** Every business row includes `tenant_id UUID NOT NULL`.

**School ERP login** (administrators & delegated operators — not every employee):

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
| **School Administrator** | Broad school ops + `rbac.manage.*` + `settings.manage` — **not** platform access (legacy role name: *Tenant Admin*) |
| **Headteacher** | School leadership: wide ops, typically no `rbac.*` (same bundle as Deputy Admin in seed) |
| **Bursar** | `finance.*`, `reports.view` |
| **Teacher** | `attendance.*`, `exams.enter_marks`, `students.view`, `academics.view` |
| **HR Manager** | `hr.*`, `payroll.view` |
| **Librarian** | `library.*` only |
| **Nurse** | `health.*` only |
| **Transport Officer** | `transport.*` only |
| **Deputy Admin** | School ops modules, no `rbac.*` |
| **Receptionist** | `admissions.*`, `students.view`, `messaging.*` |

**School Administrator cannot:**

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

TENANT (school — ERP users table, not all employees)
├── School Administrator
├── Headteacher
├── Deputy Admin
├── Bursar
├── HR Manager
├── Teacher (ERP login when assigned)
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
| **8** | Live tenant dashboard API, finance billing UI, report card generation UI, add-student form |
| **9** | Permission-scoped dashboard, student detail/edit, fee heads & structures UI, platform stats enrichment |
| **10** | Student guardians, CSV import/export, admissions enroll UI, fee structure line preview |
| **11** | Applicant timeline, student documents, parent portal linking, HR CSV import/export |
| **12** | Leave approve/reject, student portal accounts, applicant documents, campaign audience picker |
| **13** | Leave calendar, announcement audience + publish, applicant doc verify/reject, staff contracts UI |
| **14** | Payroll run detail, announcement edit/delete, contract end-date, leave conflict checks |
| **15** | Payslip PDF, mark payroll paid, announcement scheduling, contract salary edit |

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

### Phase 8 details

**Tenant dashboard**

- `GET /s/:slug/api/dashboard` — active/total students, unpaid invoices, admissions pipeline count, today’s attendance sessions, last 8 audit events (with actor email)

**Finance billing**

- **Billing** tab: create single invoice (student, amount, optional term/due date)
- Bulk invoices: term + class + fee structure → one invoice per enrolled student

**Exams**

- **Reports** tab: generate report cards for term + class (`POST /exams/report-cards/generate`)

**Students**

- **Add student** form on list page (`POST /students`)

### Phase 9 details

**Tenant dashboard (RBAC-scoped)**

- `GET /s/:slug/api/dashboard` — any authenticated staff; metrics and audit feed filtered by permission (`students.view`, `finance.view`, `admissions.view`, `attendance.view`, `audit.view`)

**Students**

- `GET/PATCH /students/:id` — detail page with edit form and class promotion

**Finance fee setup**

- **Fee structures** tab: create fee heads, build fee structures with line items (amounts in cents)

**Platform analytics**

- `GET /api/platform/stats` — adds `activeTenants`, `suspendedTenants`; console shows staff users and tenant status summary

### Phase 10 details

**Students**

- **Guardians** on student detail: list + add (`GET/POST /students/:id/guardians`)
- **CSV export** (`GET /students/export/csv`) and **import** (`POST /students/import/csv`) UI on students list

**Admissions**

- **Enroll** panel with admission number (replaces browser prompt); link to new student record; enrolled rows link to student profile

**Finance**

- `GET /finance/fee-structures/:id` — structure with line items and total; **View lines** on fee structures tab

### Phase 11 details

**Admissions timeline**

- `GET/POST /admissions/:id/events` — list pipeline events (with actor email) and add notes
- **Timeline** panel per applicant in admissions UI

**Students**

- **Documents**: list, upload (base64), download on student detail
- **Parent portal**: `POST /students/:id/guardians/:guardianId/parent-portal` — create `parent_accounts` linked to guardian; guardians list shows portal email when provisioned

**HR**

- Staff **CSV export/import** (`GET/POST /hr/staff/export|import/csv`) on HR staff tab

### Phase 12 details

**HR leave**

- Leave list includes staff name; **Approve** / **Reject** for pending requests (`PATCH /hr/leave/:id`)
- Submit new leave request from UI

**Student portal**

- `POST /students/:id/student-portal` — create `student_accounts` for active students
- Student detail shows portal email when provisioned

**Admissions documents**

- `GET/POST /admissions/:id/documents` + file download (same upload pattern as student docs)
- Upload/list in applicant **Timeline** panel

**Messaging campaigns**

- Campaign create form: audience **parents**, **parents_of_class** (with class picker), or **staff**
- Worker respects `audienceFilter.classId` for class-scoped parent campaigns

### Phase 13 details

**HR**

- **Leave calendar** — month grid of approved leave on the Leave tab (list/calendar toggle)
- **Staff contracts** — `GET/POST /hr/staff/:id/contracts`; UI to list and add contracts (salary in cents)

**Messaging announcements**

- `POST /announcements` — `audience` (`all` | `parents` | `staff`), optional `published` (draft vs publish)
- `PATCH /announcements/:id` — publish draft or change audience
- Announcements tab: audience picker, save draft / publish now, publish button on drafts

**Admissions documents**

- `PATCH /admissions/:id/documents/:docId` — set status `pending` | `verified` | `rejected`
- Verify / Reject actions in applicant Timeline panel

### Phase 14 details

**Payroll**

- `GET /payroll/runs/:id` — run with line items (staff names, gross/deductions/net in cents)
- `GET /payroll/payslips` — joined with staff; UI expands draft runs and shows payslip amounts

**Messaging announcements**

- `PATCH /announcements/:id` — also `title`, `body`
- `DELETE /announcements/:id`
- UI: edit inline, delete

**HR contracts**

- `PATCH /hr/staff/:staffId/contracts/:contractId` — `endDate`, optional `salary`
- UI: set end date on open contracts

**HR leave conflicts**

- `GET /hr/leave/check?staffId&startDate&endDate` — overlap detection
- POST leave and PATCH approve reject overlapping pending/approved leave
- Calendar highlights days with same-staff overlaps; leave form uses staff picker + live warning

### Phase 15 details

**Payroll**

- `POST /payroll/runs/:id/mark-paid` — approved runs → `paid` (audit: `payroll.mark_paid`)
- `GET /payroll/payslips/:id/pdf` — payslip PDF download (`payroll.view`)
- Payroll UI: **Mark paid** on approved runs; **PDF** per payslip row

**Announcements scheduling**

- Migration `0008`: `announcements.publish_at`
- `POST/PATCH` accept optional `publishAt`; future time keeps draft until due
- `promoteScheduledAnnouncements()` on staff list + portal dashboard reads
- UI: datetime picker, **Schedule** button, scheduled status badge

**HR contracts**

- UI: **Update salary** on open contracts (uses existing `PATCH` salary field)

### Phase 16 — Domains & routing

- Migration `0010`: `tenants.subdomain`, `custom_domain`, `domain_verified`, `ssl_config`
- `server/src/services/tenant-resolve.ts` — resolve tenant by verified custom domain or subdomain/slug
- `server/src/middleware/host-tenant.ts` — attach tenant from `Host`; optional redirect to `/s/:slug/…`
- Platform: `PATCH /api/platform/tenants/:slug/domain`, `POST …/domain/verify`
- UI: **Tenant detail** — custom domain + DNS TXT instructions

**Env:** `USE_SUBDOMAIN=true`, `PLATFORM_DOMAIN=school.bclimaxtech.com`, `CLIENT_ORIGIN` for impersonation URLs.

### Phase 17 — Platform ops (impersonation & audit)

- `platform_audit_logs`, `platform_impersonation_tokens`, `sessions.metadata` (impersonation + read-only flag)
- `POST /api/platform/tenants/:slug/impersonate` → one-time URL
- `GET /s/:slug/api/auth/impersonate?token=` — exchange token, set `session_token`
- `blockWriteIfImpersonationReadOnly` on school mutating APIs
- `GET /api/platform/audit-logs` — combined school + platform feed
- UI: Command Center **Shadow**, **Audit Trail**, read-only banner in school ERP

### Phase 18 — Add-on marketplace

- Tables: `addon_features`, `tenant_addons`; seed: `ai_homework`, `white_label`, `multi_campus`
- `plan-features` merges active add-ons into feature checks
- Platform: `GET/POST /api/platform/tenants/:slug/addons`
- UI: toggles on tenant detail

### Phase 19 — Usage billing

- `tenant_billing_usage`, `usage_billing_thresholds`, `saas_billing_lines`
- `incrementUsage`, `checkUsageAllowed`, `generateBillingLines`
- SMS campaigns increment `sms_volume` in `campaign-worker`
- Platform: usage + `POST …/usage/generate-lines`
- UI: usage meters and billing lines on tenant detail
