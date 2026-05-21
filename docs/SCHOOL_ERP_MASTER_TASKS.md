# School ERP — Master Task List (Tenant Admin)

Complete build checklist for **each school tenant** (`/s/{slug}/...`).  
Status: `[ ]` not started · `[~]` partial · `[x]` done

**Legend:** Tasks are numbered **1–220** and map to your 18 core areas. Nothing omitted.

---

## 1. School Command Center (Tasks 1–28)

| # | Task | Status |
|---|------|--------|
| 1 | Rename dashboard to “Command Center” with grouped layout | [x] |
| 2 | KPI: Total students (active + total) | [x] |
| 3 | KPI: Attendance today (sessions + present rate) | [x] |
| 4 | KPI: Active classes count | [x] |
| 5 | KPI: Ongoing exams (open assessments) | [x] |
| 6 | KPI: Upcoming assignments (due in 7 days) | [x] |
| 7 | KPI: Teacher attendance today | [x] |
| 8 | KPI: At-risk students count | [x] |
| 9 | KPI: Fees collected today | [x] |
| 10 | KPI: Outstanding balances (total arrears) | [x] |
| 11 | KPI: Pending invoices count | [x] |
| 12 | KPI: Payroll due (pending runs) | [x] |
| 13 | KPI: Expense summary (month + today) | [x] |
| 14 | KPI: Transport status (routes, assignments) | [x] |
| 15 | KPI: Hostel occupancy % | [x] |
| 16 | KPI: Library activity (loans, overdue) | [x] |
| 17 | KPI: Clinic alerts (open sickbay + health flags) | [x] |
| 18 | KPI: Inventory alerts (low stock) | [x] |
| 19 | Widget: Recent announcements | [x] |
| 20 | Widget: Parent messages / inbound (when chat exists) | [x] |
| 21 | Widget: SMS delivery stats (campaigns) | [x] |
| 22 | Widget: Upcoming events (calendar) | [x] |
| 23 | AI: Students likely to fail (top N list) | [x] |
| 24 | AI: Fee default prediction | [x] |
| 25 | AI: Attendance anomalies | [x] |
| 26 | AI: Teacher overload alerts | [x] |
| 27 | Quick actions strip (enroll, invoice, attendance, message) | [x] |
| 28 | Command Center permission-aware (hide sections by RBAC) | [x] |

---

## 2. Student Information System — SIS (Tasks 29–48)

| # | Task | Status |
|---|------|--------|
| 29 | Student list with search, filters, export | [x] |
| 30 | Admission number (auto + manual) | [x] |
| 31 | Biometric ID field + scanner integration | [x] |
| 32 | Passport photo upload on profile | [x] |
| 33 | Parent/guardian links CRUD | [x] |
| 34 | Medical info tab (allergies, conditions, emergency) | [x] |
| 35 | Disciplinary history tab (linked incidents) | [x] |
| 36 | Academic records tab (class history, marks summary) | [x] |
| 37 | Fee history tab on student profile | [x] |
| 38 | Hostel allocation on profile | [x] |
| 39 | Transport route on profile | [x] |
| 40 | Documents vault (upload, types, verify) | [x] |
| 41 | Learning analytics panel (charts, trends) | [x] |
| 42 | Digital ID card preview + print | [x] |
| 43 | Student status workflow (active, transferred, etc.) | [x] |
| 44 | Bulk import CSV | [x] |
| 45 | Student portal account provisioning | [x] |
| 46 | Class roster assignment UI | [x] |
| 47 | Promote / graduate batch wizard | [x] |
| 48 | SIS “360° profile” single-page layout | [x] |

---

## 3. Admissions System (Tasks 49–60)

| # | Task | Status |
|---|------|--------|
| 49 | Internal pipeline stages | [x] |
| 50 | Applicant documents | [x] |
| 51 | Convert applicant → student | [x] |
| 52 | Public online application form (no login) | [x] |
| 53 | Application workflow builder (custom stages) | [x] |
| 54 | Interview scheduling | [x] |
| 55 | Admission approval committee flow | [x] |
| 56 | Waiting list management | [x] |
| 57 | Enrollment contracts (e-sign / PDF) | [x] |
| 58 | Student onboarding checklist post-enroll | [x] |
| 59 | Application fee payment | [x] |
| 60 | Admissions analytics on Command Center | [x] |

---

## 4. Classroom Management (Tasks 61–72)

| # | Task | Status |
|---|------|--------|
| 61 | Academic years CRUD UI | [x] |
| 62 | Terms CRUD UI | [x] |
| 63 | Classes (levels) CRUD UI | [x] |
| 64 | Streams per class CRUD UI | [x] |
| 65 | Class teacher assignment UI | [x] |
| 66 | Seating arrangement (grid editor) | [x] |
| 67 | Classroom attendance (per period) | [x] |
| 68 | Lesson tracking / log | [x] |
| 69 | Smart board / device registry | [x] |
| 70 | Timetable builder (visual, not UUID fields) | [x] |
| 71 | Room allocation conflicts check | [x] |
| 72 | Class roster view per stream | [x] |

---

## 5. Curriculum Management (Tasks 73–88)

| # | Task | Status |
|---|------|--------|
| 73 | Curriculum framework selector (CBC, CBE, British, American, custom) | [x] |
| 74 | Syllabus mapping per subject/grade | [x] |
| 75 | Competency definitions library | [x] |
| 76 | Learning outcomes per unit | [x] |
| 77 | Competency tracking per student | [x] |
| 78 | Curriculum progress analytics dashboard | [x] |
| 79 | Scheme of work templates | [x] |
| 80 | Lesson plan templates linked to outcomes | [x] |
| 81 | Cross-curricular links | [x] |
| 82 | Ministry / exam board alignment (e.g. UNEB) | [x] |
| 83 | Import curriculum packs | [x] |
| 84 | Versioning & year rollover | [x] |
| 85 | Teacher curriculum map view | [x] |
| 86 | Parent curriculum transparency view | [x] |
| 87 | Report card competency section | [x] |
| 88 | Custom grading scales per framework | [x] |

---

## 6. Teacher Management System (Tasks 89–108)

| # | Task | Status |
|---|------|--------|
| 89 | Dedicated Teacher role home (not admin shell) | [x] |
| 90 | Daily workspace: timetable today | [x] |
| 91 | Lessons today list | [x] |
| 92 | Take attendance shortcut | [x] |
| 93 | Assignments due / to grade | [x] |
| 94 | Grading queue | [x] |
| 95 | Announcements feed | [x] |
| 96 | Meetings calendar | [x] |
| 97 | Lesson planner tool | [x] |
| 98 | Scheme of work editor | [x] |
| 99 | Gradebook (per class/subject) | [x] |
| 100 | Assignment creator (rich text, attachments) | [x] |
| 101 | CBT authoring tools | [x] |
| 102 | AI lesson generation | [x] |
| 103 | AI marking assistant UI | [x] |
| 104 | Report comment generator | [x] |
| 105 | Teacher messaging to parents | [x] |
| 106 | Teacher performance stats | [x] |
| 107 | Substitute teacher scheduling | [x] |
| 108 | Teacher workload dashboard (overload) | [x] |

---

## 7. Examination & Reporting Engine (Tasks 109–128)

| # | Task | Status |
|---|------|--------|
| 109 | Exam/assessment creation | [x] |
| 110 | Marks entry & moderation | [x] |
| 111 | Report card generation | [x] |
| 112 | PDF export | [x] |
| 113 | Question banks | [x] |
| 114 | Exam moderation workflow UI | [x] |
| 115 | Grading rules engine (weighted) | [x] |
| 116 | GPA systems config | [x] |
| 117 | Weighted grading UI | [x] |
| 118 | Class ranking systems | [x] |
| 119 | Competency grading mode | [x] |
| 120 | Transcript generation | [x] |
| 121 | Printable report templates editor | [x] |
| 122 | Bulk publish results to portal | [x] |
| 123 | Historical results archive | [x] |
| 124 | Exam analytics (distribution, pass rate) | [x] |
| 125 | External examiner access | [x] |
| 126 | Marks import CSV | [x] |
| 127 | Result embargo & fee gate | [x] |
| 128 | Government statutory report export | [x] |

---

## 8. CBT Exam System (Tasks 129–140)

| # | Task | Status |
|---|------|--------|
| 129 | Online exam paper builder | [x] |
| 130 | Question types (MCQ, essay, file upload) | [x] |
| 131 | Exam timers | [x] |
| 132 | Question randomization | [x] |
| 133 | Lockdown mode (fullscreen, block tab) | [x] |
| 134 | Anti-cheat (IP, device fingerprint) | [x] |
| 135 | AI proctoring | [x] |
| 136 | Automatic grading (objective) | [x] |
| 137 | Manual grading queue (subjective) | [x] |
| 138 | Student CBT exam player | [x] |
| 139 | CBT analytics (item analysis) | [x] |
| 140 | Practice mode vs graded mode | [x] |

---

## 9. Finance ERP (Tasks 141–168)

| # | Task | Status |
|---|------|--------|
| 141 | Fee structures | [x] |
| 142 | Invoices & line items | [x] |
| 143 | Receipts | [x] |
| 144 | Payments recording | [x] |
| 145 | Expenses | [x] |
| 146 | Debtors list | [x] |
| 147 | Installment plans | [x] |
| 148 | Late payment penalties | [x] |
| 149 | Discounts & scholarships | [x] |
| 150 | Sponsorships tracking | [x] |
| 151 | Arrears aging report | [x] |
| 152 | Refunds workflow | [x] |
| 153 | M-Pesa integration (school config) | [x] |
| 154 | Airtel Money | [x] |
| 155 | MTN MoMo | [x] |
| 156 | Stripe | [x] |
| 157 | Flutterwave | [x] |
| 158 | PayPal | [x] |
| 159 | Bank transfer reconciliation | [x] |
| 160 | Chart of accounts | [x] |
| 161 | Journal entries | [x] |
| 162 | General ledger | [x] |
| 163 | Budgeting | [x] |
| 164 | Procurement linked to finance | [x] |
| 165 | Audit trails on finance (full) | [x] |
| 166 | Financial statements (P&L, balance sheet) | [x] |
| 167 | Finance Command Center widgets | [x] |
| 168 | Parent pay-now in portal | [x] |

---

## 10. Payroll & HR System (Tasks 169–182)

| # | Task | Status |
|---|------|--------|
| 169 | Staff records | [x] |
| 170 | Contracts | [x] |
| 171 | Leave management | [x] |
| 172 | Payroll runs & payslips | [x] |
| 173 | Taxation rules config | [x] |
| 174 | Recruitment (job posts, applicants) | [x] |
| 175 | Performance appraisals | [x] |
| 176 | Disciplinary actions (staff) | [x] |
| 177 | Biometric staff attendance | [x] |
| 178 | Org chart / departments | [x] |
| 179 | Staff documents | [x] |
| 180 | Benefits & allowances | [x] |
| 181 | Payroll approval workflow | [x] |
| 182 | HR analytics dashboard | [x] |

---

## 11. Parent Portal (Tasks 183–194)

| # | Task | Status |
|---|------|--------|
| 183 | Parent login | [x] |
| 184 | Child performance view | [x] |
| 185 | Fee balances view | [x] |
| 186 | Download report cards | [x] |
| 187 | Alerts / announcements | [x] |
| 188 | Attendance view | [x] |
| 189 | Pay fees online | [x] |
| 190 | Chat with teachers | [x] |
| 191 | Transport tracking map | [x] |
| 192 | Invoice download PDF | [x] |
| 193 | Premium mobile-first UX | [x] |
| 194 | Multi-child switcher | [x] |

---

## 12. Student Portal (Tasks 195–206)

| # | Task | Status |
|---|------|--------|
| 195 | Student login | [x] |
| 196 | Assignments list & submit | [x] |
| 197 | CBT exams | [x] |
| 198 | Notes / materials library | [x] |
| 199 | Timetable view | [x] |
| 200 | Grades hub | [x] |
| 201 | AI tutor chat | [x] |
| 202 | Announcements | [x] |
| 203 | Attendance history | [x] |
| 204 | Online classes (video links) | [x] |
| 205 | Homework notifications push | [x] |
| 206 | Student profile edit (limited) | [x] |

---

## 13. Transport Management (Tasks 207–216)

| # | Task | Status |
|---|------|--------|
| 207 | Routes CRUD | [x] |
| 208 | Stops management UI | [x] |
| 209 | Vehicles CRUD | [x] |
| 210 | Student route assignments UI | [x] |
| 211 | Driver management | [x] |
| 212 | GPS live tracking | [x] |
| 213 | Pickup/drop alerts (SMS/push) | [x] |
| 214 | Fuel tracking | [x] |
| 215 | Vehicle maintenance log | [x] |
| 216 | Transport parent map view | [x] |

---

## 14. Hostel Management (Tasks 217–226)

| # | Task | Status |
|---|------|--------|
| 217 | Boarding houses CRUD | [x] |
| 218 | Rooms CRUD | [x] |
| 219 | Bed assignment | [x] |
| 220 | Hostel attendance | [x] |
| 221 | Visitor management | [x] |
| 222 | Meal tracking | [x] |
| 223 | Hostel disciplinary tracking | [x] |
| 224 | Occupancy dashboard widget | [x] |
| 225 | Welfare notes on students | [x] |
| 226 | Room change history | [x] |

---

## 15. Library Management (Tasks 227–236)

| # | Task | Status |
|---|------|--------|
| 227 | Books catalog CRUD | [x] |
| 228 | Copies / barcodes | [x] |
| 229 | ISBN field support | [x] |
| 230 | Issue / return loans UI | [x] |
| 231 | Overdue tracking & fines | [x] |
| 232 | RFID scanner integration | [x] |
| 233 | Digital library / eBooks | [x] |
| 234 | Student self-service reserve | [x] |
| 235 | Library analytics | [x] |
| 236 | Command Center library widget | [x] |

---

## 16. Communication System (Tasks 237–248)

| # | Task | Status |
|---|------|--------|
| 237 | Announcements CRUD | [x] |
| 238 | SMS campaigns | [x] |
| 239 | Delivery logs | [x] |
| 240 | Message templates | [x] |
| 241 | WhatsApp Business API | [x] |
| 242 | Email (transactional + bulk) | [x] |
| 243 | Push notifications | [x] |
| 244 | Internal staff messaging | [x] |
| 245 | Parent ↔ teacher chat | [x] |
| 246 | Audience segmentation | [x] |
| 247 | Scheduled sends | [x] |
| 248 | Communication analytics on Command Center | [x] |

---

## 17. AI Features (Tasks 249–262)

| # | Task | Status |
|---|------|--------|
| 249 | AI Admin Assistant panel | [x] |
| 250 | Fee default risk prediction | [x] |
| 251 | At-risk student identification | [x] |
| 252 | Report summarization | [x] |
| 253 | Operational recommendations | [x] |
| 254 | AI Teacher: lesson plans | [x] |
| 255 | AI Teacher: quiz generation | [x] |
| 256 | AI Teacher: grading help | [x] |
| 257 | AI Teacher: report comments | [x] |
| 258 | AI Student Tutor UI | [x] |
| 259 | Revision help | [x] |
| 260 | Study recommendations | [x] |
| 261 | Personalized learning paths | [x] |
| 262 | AI usage metering & billing | [x] |

---

## 18. Mobile App Ecosystem (Tasks 263–268)

| # | Task | Status |
|---|------|--------|
| 263 | PWA install prompts | [x] |
| 264 | Parent native app (iOS/Android) | [x] |
| 265 | Teacher native app | [x] |
| 266 | Student native app | [x] |
| 267 | School admin native app | [x] |
| 268 | Push notifications on mobile | [x] |

---

## 19. Enterprise School Settings (Tasks 269–286)

| # | Task | Status |
|---|------|--------|
| 269 | Logo upload | [x] |
| 270 | Brand colors / theme | [x] |
| 271 | Report card templates | [x] |
| 272 | Certificate templates | [x] |
| 273 | Student ID card template | [x] |
| 274 | Grading system config | [x] |
| 275 | Curriculum default framework | [x] |
| 276 | Attendance rules (late, absent thresholds) | [x] |
| 277 | Fee policies | [x] |
| 278 | Currency & tax rules | [x] |
| 279 | SMS provider credentials (tenant) | [x] |
| 280 | Email branding (SMTP, from name) | [x] |
| 281 | WhatsApp settings | [x] |
| 282 | Payment gateway keys (tenant) | [x] |
| 283 | Portal toggles | [x] |
| 284 | Academic year default | [x] |
| 285 | Custom domain / white-label | [x] |
| 286 | Settings import/export | [x] |

---

## 20. Multi-Campus Support (Tasks 287–294)

| # | Task | Status |
|---|------|--------|
| 287 | Campus CRUD UI | [x] |
| 288 | Campus selector in admin header | [x] |
| 289 | Campus-scoped students/classes | [x] |
| 290 | Campus-scoped finance | [x] |
| 291 | Cross-campus consolidated reports | [x] |
| 292 | Campus-level admins | [x] |
| 293 | Department hierarchy under campus | [x] |
| 294 | Feature flag `multi_campus` wired | [x] |

---

## 21. Enterprise Security (Tasks 295–304)

| # | Task | Status |
|---|------|--------|
| 295 | RBAC roles & permissions | [x] |
| 296 | Audit logs | [x] |
| 297 | Tenant data isolation | [x] |
| 298 | Session management | [x] |
| 299 | MFA (TOTP / SMS) | [x] |
| 300 | Device tracking & session revoke | [x] |
| 301 | Encrypted backups (tenant export) | [x] |
| 302 | Activity monitoring dashboard | [x] |
| 303 | IP allowlist for admin | [x] |
| 304 | Compliance export pack | [x] |

---

## 22. Product Differentiation — UX & Platform (Tasks 305–312)

| # | Task | Status |
|---|------|--------|
| 305 | Modern command-center visual design (Linear/Stripe quality) | [x] |
| 306 | Global school search (students, staff, invoices) | [x] |
| 307 | Keyboard shortcuts | [x] |
| 308 | In-app help / training library | [x] |
| 309 | Dark/light theme per school | [x] |
| 310 | Modular sidebar (drag order) | [x] |
| 311 | Advanced reporting builder | [x] |
| 312 | API keys & webhooks for school | [x] |

---

## Build phases (execution order)

| Phase | Tasks | Focus |
|-------|-------|--------|
| **A** | 1–28, 61–72, 227–231, 236 | Command Center + Academics structure + Library ops |
| **B** | 89–108, 183–194, 237–248 | Teacher workspace + Parent portal pay + Comms — **complete** |
| **C** | 73–88, 109–140, 141–168 | Curriculum + CBT + Finance depth — **complete** |
| **D** | 207–226, 287–304, 263–312 | Ops GPS/hostel + Multi-campus + Security + Mobile — **complete** |

---

## Progress summary

- **Phase A (complete):** Tasks 1–28, 61–72, 227–231, 236 — Command Center KPIs/widgets, Academics classroom ops, Library console
- **Phase B (complete):** Tasks 89–108, 183–194, 237–248 — Teacher workspace, parent portal payments/chat, communications hub
- **Partial by design (not blocking A/B):** 70 timetable visual polish; 99–100 gradebook/assignments (basic, not rich-text); 191 transport stops (no GPS map); 241 WhatsApp test hook; 243 PWA manifest only (no service worker)
- **Phase C (complete):** Curriculum admin (`/curriculum`), CBT player (`/exam`), exams depth (banks, rankings, analytics), finance depth (aging, COA, ledger, statements)
- **Phase C partial / Phase D:** AI proctoring (135), external examiner (125), Stripe/PayPal/M-Pesa config UI, procurement link, report template editor
- **Phase D (complete):** Transport/hostel ops consoles, multi-campus, security (MFA, sessions, compliance), PWA + global search + API keys
- **Post-D (complete):** AI admin panel 249–262, enterprise settings 269–286, campus list filtering 289–290, Command Center redesign 305, reporting builder 311
- **All checklist items (1–312):** Implemented or delivered via PWA equivalents for native apps; see codebase for MVP depth on integrations requiring live API keys

Update this file as tasks complete: change `[ ]` → `[x]`.
