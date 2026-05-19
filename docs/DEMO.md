# SchoolOS — Demo logins & URLs

Use this after `npm run db:seed` (local or VPS). **Change all passwords in production.**

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| **Local dev (UI)** | `http://localhost:5173` |
| **Local prod-style** | `http://localhost:5000` (after `npm run build`) |
| **VPS (CWP)** | `https://school.bclimaxtech.com` |
| **VPS (IP)** | `http://173.231.241.161` (only if Apache proxies to Node on 5000) |

In development, use port **5173** for the React app. Port **5000** is API-only unless you built and run production mode.

---

## Three login systems (do not mix)

| Who | Login URL | After login |
|-----|-----------|-------------|
| **Platform operator** (SaaS) | `/platform/login` | `/platform/dashboard` |
| **School administrators & ERP users** (not all employees) | `/s/{schoolSlug}/login` | `/s/{schoolSlug}/dashboard` |
| **Parent or student** (portal) | `/s/{schoolSlug}/portal/login` | `/s/{schoolSlug}/portal/dashboard` |

Replace `{schoolSlug}` with `school-a` or `school-b`.

---

## Demo credentials (from seed)

| Role | Email | Password | Tenant |
|------|-------|----------|--------|
| Platform admin | `platform@schoolos.local` | `Platform123!` | — |
| School administrator (Greenfield, Uganda demo) | `admin@school-a.com` | `Password123!` | `school-a` |
| School administrator (Sunridge) | `admin@school-b.com` | `Password123!` | `school-b` |

**Staff (headteacher, teachers, secretaries)** are stored under **HR → Staff** in the ERP. They only use `/s/.../login` if you create a linked ERP account and role for them.
| Parent portal | `parent@school-a.com` | `Parent123!` | `school-a` only |
| Student portal | `student@school-a.com` | `Student123!` | `school-a` only |

Portal logins exist only for **school-a** in the seed data.

---

## Full link map (production base: `https://school.bclimaxtech.com`)

### Public marketing

| Page | Path |
|------|------|
| Home | `/` |
| Features | `/features` |
| Pricing | `/pricing` |
| About | `/about` |
| Contact | `/contact` |

### Platform (SaaS operator)

| Page | Path |
|------|------|
| Login | `/platform/login` |
| Console | `/platform/dashboard` |

### Staff ERP — school-a (Greenfield Academy)

| Module | Path |
|--------|------|
| Login | `/s/school-a/login` |
| Dashboard | `/s/school-a/dashboard` |
| Students | `/s/school-a/students` |
| Admissions | `/s/school-a/admissions` |
| Attendance | `/s/school-a/attendance` |
| Academics | `/s/school-a/academics` |
| Exams | `/s/school-a/exams` |
| Finance | `/s/school-a/finance` |
| HR | `/s/school-a/hr` |
| Payroll | `/s/school-a/payroll` |
| Operations | `/s/school-a/ops/discipline` (also health, library, inventory, transport, boarding) |
| Messaging | `/s/school-a/messaging` |
| Reports | `/s/school-a/reports` |
| Admin (users/roles/audit) | `/s/school-a/admin` |
| Settings | `/s/school-a/settings` |

Same paths work for **school-b** — use `admin@school-b.com` / `Password123!`.

### Parent / student portal — school-a

| Page | Path |
|------|------|
| Login | `/s/school-a/portal/login` |
| Dashboard | `/s/school-a/portal/dashboard` |

---

## Implementation phases completed (staff UI + API hardening)

Phases **1–15** in `docs/ARCHITECTURE.md` — latest highlights:

| Phase | What you can try in the UI |
|-------|----------------------------|
| 8–9 | Live dashboard, billing, student detail/edit, fee structures |
| 10–11 | Guardians, CSV import, admissions enroll, applicant timeline, documents |
| 12 | Leave approve/reject, student/parent portal accounts, campaign audiences |
| 13 | Leave calendar, announcement audience/publish, doc verify, staff contracts |
| 14 | Payroll line items, announcement edit/delete, leave conflict warnings |
| 15 | Payslip PDF, mark payroll paid, schedule announcements, edit contract salary |

---

## VPS deploy (after `git pull`)

```bash
cd /root/school-os   # or /home/bishopcl/school-os
git pull
npm run db:migrate   # includes migration 0008 (announcement publish_at)
npm run build
pm2 restart school-os --update-env
```

If `git pull` fails on `package-lock.json`: `rm package-lock.json && git pull && npm install`

If seed was never run: `npm run db:seed` (demo logins only).

### Platform login shows "Internal Server Error"

Logs often show `column "role" does not exist` on `platform_admins`. Migrations **0004–0005** did not finish (PostgreSQL blocks `ALTER TYPE … ADD VALUE` inside a transaction on older PG).

```bash
cd /root/school-os
rm -f package-lock.json    # only if git pull complains about untracked lockfile
git pull && npm install
npm run db:repair          # applies 0004–0008 SQL without transactions (safe to re-run)
npm run db:migrate         # PG10-safe migrator (no single transaction wrap)
npm run db:ensure-platform
npm run db:seed
npm run build
pm2 restart school-os --update-env
```

Diagnose DB without guessing: `npm run db:doctor` (checks `platform_admins.role`, password hash, `features` table).

After deploy, the server also runs **startup schema repair** (adds `platform_admins.role`, `features`, etc.) before accepting traffic — but you still need `db:seed` once for demo data.

If `db:migrate` still fails on an enum value “already exists”, that is OK — continue with `db:seed`.

Then sign in at `/platform/login` with `platform@schoolos.local` / `Platform123!`.
