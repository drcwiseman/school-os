# Multi-Tenant School Management System

A full-stack, enterprise-grade multi-tenant SaaS application designed to manage school operations. 

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Strict HTTP-only Session Cookies
- **Validation**: Zod
- **Queue/PDF**: In-process queue with DB-backed jobs, pdf-lib (Phase 12)

## Architectural Constraints
- **Multi-Tenancy**: Every tenant-owned DB query MUST be scoped via `tenant_id`. Handled automatically via Express URL routing `/s/:schoolSlug/*`.
- **RBAC**: Fine-grained atomic permissions (e.g., `students.create`). Checked via `requirePermission` middleware.
- **Audit Logging**: Any destructive or mutating action captures the Actor, Action, Entity, IP, and Before/After JSON states.

---

## Getting Started

### 1. Database Setup
Ensure you have PostgreSQL running. Create a local database named `school_os` or modify the `DATABASE_URL` inside `/server/.env`.
```bash
createdb school_os
```

### 2. Backend Initialization
```bash
cd server
npm install

# Generate and run Drizzle Migrations
npm run db:generate
npm run db:migrate

# Seed Demo Data (Tenants, Roles, Permissions, Users)
npm run db:seed

# Start the dev server
npm run dev
```
The server runs on `http://localhost:5000`.

### 3. Frontend Initialization
```bash
cd client
npm install

# Start Vite dev server
npm run dev
```

### 4. Logging In

SchoolOS has **three separate security domains** (different tables, cookies, and login URLs). See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** and **[docs/DEMO.md](docs/DEMO.md)** (all demo logins and URL paths).

**Development:** use the Vite app on port **5173** (not 5000):

| Who | URL | Demo login |
|-----|-----|------------|
| **Platform operator** (SaaS) | `/platform/login` → `/platform/dashboard` | `platform@schoolos.local` / `Platform123!` |
| **School administrator** (ERP — tenant = school) | `/s/school-a/login` | `admin@school-a.com` / `Password123!` |
| **Parent portal** | `/s/school-a/portal/login` | `parent@school-a.com` / `Parent123!` |
| **Student portal** | `/s/school-a/portal/login` | `student@school-a.com` / `Student123!` |

Port 5000 is the API only in dev. After `npm run build`, a single server on 5000 serves both UI and API.

---

## Root scripts (monorepo)

From the repo root after `npm install`:

```bash
npm run dev          # server + client concurrently
npm run check        # typecheck both packages
npm run test         # server tests (tenant tests skip if DB unavailable)
npm run build        # production build
npm run db:migrate   # apply Drizzle migrations
npm run db:seed      # demo tenants, roles, students, classes
```

## Implementation status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 | Done | Health, errors, logging, README |
| 1 | Done | Tenants, sessions, `/s/:schoolSlug`, seed users |
| 2 | Done | RBAC tables, middleware, **Admin UI** (users/roles/audit) |
| 3 | Done | Students CRUD, guardians, promote, documents, CSV import/export |
| 4 | Done | Admissions pipeline + enroll |
| 5 | Done | Attendance API + UI with class picker from academics |
| 6 | Done | Subjects, rooms, timetables, assignments API + Academics UI |
| 7 | Done | Assessments, marks, moderation, report cards API + Exams UI |
| 8 | Done | Fee structures, bulk invoices, receipts (sequential), debtors, expenses |
| 9 | Done | Staff, leave, payroll runs, payslips API + HR/Payroll UI |
| 10 | Done | Discipline, health, library, inventory, transport, boarding APIs + Operations UI |
| 11 | Done | Messaging templates, announcements, campaigns, delivery logs, job queue |
| 12 | Done | PDF reports (invoice, receipt, report card, payslip), summary APIs |
| 13 | Done | Parent/student portal auth + dashboards |
| 14 | Done | Platform admin auth, plans, tenant list, feature flags |
| 15 | Done | Rate limiting, upload validation, PDF tests, health test |

### Portal & platform logins

- **Parent portal (school-a):** `/s/school-a/portal/login` — `parent@school-a.com` / `Parent123!`
- **Student portal (school-a):** `student@school-a.com` / `Student123!`
- **Platform console:** `/platform/login` — `platform@schoolos.local` / `Platform123!`

### Deployment & hosting

See **[docs/HOSTING.md](docs/HOSTING.md)** for the full migration strategy, Docker Compose, PaaS/VPS options, and production checklist.

**InMotion VPS (SSH):** see **[docs/INMOTION.md](docs/INMOTION.md)** and run `scripts/deploy-inmotion.sh` on the server.

**CWP subdomain `school.bclimaxtech.com` (bishopcl):** see **[docs/CWP-SCHOOL-BCLIMax.md](docs/CWP-SCHOOL-BCLIMax.md)**.

Quick commands:

```bash
npm run db:migrate                  # incremental migrations (upgrades)
npm run db:build-full-migration     # generates full_schema.sql for empty DBs
npm run docker:up                   # Postgres + API (after setting SESSION_SECRET)
```

## Project Structure
- `/server/src/db`: Drizzle schema, migrations, and seed logic.
- `/server/src/routes`: Express API controllers.
- `/server/src/middleware`: Auth, Tenancy, RBAC, and Error Handling.
- `/client/src/app`: React UI layout, context state, and pages.
- `/client/src/styles`: Custom Tailwind configuration and glassmorphism design tokens.
