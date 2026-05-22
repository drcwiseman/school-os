import {
  BarChart3,
  Bell,
  BookOpen,
  Bus,
  Calculator,
  Calendar,
  ClipboardList,
  FileText,
  GraduationCap,
  Headphones,
  Library,
  Monitor,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  Video,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const MEGA_MENU = [
  {
    title: "Academics Suite",
    href: "/features#academics",
    icon: GraduationCap,
    description: "Timetables, exams, report cards, and room management in one flow.",
  },
  {
    title: "Financial Engine",
    href: "/features#finance",
    icon: Wallet,
    description: "Sequential billing, bulk invoicing, receipts, and debtor tracking.",
  },
  {
    title: "Operations & HR",
    href: "/features#operations",
    icon: Bus,
    description: "Payroll, transport, boarding, library, inventory, and discipline.",
  },
] as const;

export const FEATURE_TABS: {
  id: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  metric: { value: string; label: string };
  icon: LucideIcon;
}[] = [
  {
    id: "academics",
    label: "Academics & Exams",
    title: "Academic excellence, orchestrated",
    description:
      "From subject catalogs to moderated marks and branded PDF report cards — every academic workflow respects tenant boundaries.",
    bullets: [
      "Dynamic timetables & room allocation",
      "Assignment lifecycle with due-date tracking",
      "Exam sessions, grading scales & moderation queues",
      "One-click report card generation (Phase 7)",
    ],
    metric: { value: "12 sec", label: "Average report card batch for 400 students" },
    icon: BookOpen,
  },
  {
    id: "finance",
    label: "Financial Suite",
    title: "Revenue operations without spreadsheets",
    description:
      "Fee structures, sequential invoice runs, and parent-facing balances — built for finance teams who cannot afford reconciliation errors.",
    bullets: [
      "Fee structures & billing cycles",
      "Bulk sequential invoice generation",
      "Receipt posting & debtor aging",
      "Finance reports export-ready",
    ],
    metric: { value: "5,000+", label: "Sequential student invoices in under 12 seconds" },
    icon: Calculator,
  },
  {
    id: "hr",
    label: "HR & Payroll",
    title: "People operations with compliance in mind",
    description:
      "Staff records, leave policies, and payslip runs — all audited and scoped to your institution.",
    bullets: [
      "Staff profiles & contract metadata",
      "Leave types, balances & approvals",
      "Payroll runs with line-item payslips",
      "Immutable audit on structural changes",
    ],
    metric: { value: "100%", label: "Payslip runs tied to audit actor & timestamp" },
    icon: Users,
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    title: "Campus life beyond the classroom",
    description:
      "Transport routes, boarding, library circulation, inventory, health visits, and discipline — unified under one operations layer.",
    bullets: [
      "Transport routes & student assignments",
      "Boarding houses & room allocation",
      "Library check-out & catalog search",
      "Inventory, health & discipline modules",
    ],
    metric: { value: "15+", label: "Operational modules in a single tenant workspace" },
    icon: Library,
  },
];

export const PRICING_TIERS = [
  {
    name: "Foundation Academy",
    audience: "Single campus, up to 300 students",
    monthly: 149,
    annual: 1430,
    highlight: false,
    features: [
      "Core RBAC & staff portals",
      "Parent & student portals",
      "Attendance & admissions",
      "Exams & report cards",
      "Localized database backup",
    ],
  },
  {
    name: "Enterprise School OS",
    audience: "Growing institutions & multi-campus",
    monthly: 349,
    annual: 3350,
    highlight: true,
    features: [
      "Everything in Foundation",
      "Bulk invoice engine",
      "Payroll runs & payslips",
      "SMS & email campaigns",
      "Advanced reporting & PDF exports",
    ],
  },
  {
    name: "Consortium / Districts",
    audience: "Government bodies & large networks",
    monthly: null,
    annual: null,
    highlight: false,
    features: [
      "Custom SLA & onboarding",
      "Dedicated instance provisioning",
      "Unrestricted platform console",
      "Multi-tenant governance tools",
      "Priority support & training",
    ],
  },
] as const;

export const NO_HIDDEN_FEES = [
  "Unlimited parent portal accounts",
  "Strict per-school data isolation (tenant_id)",
  "Encryption in transit & at rest",
  "Immutable audit trails on structural changes",
  "CSV import for students & staff",
  "No per-SMS markup on Enterprise",
] as const;

export const FAQ_ITEMS = [
  {
    q: "How long does onboarding take?",
    a: "Most single-campus schools go live in 2–4 weeks: discovery, data import, staff training, and a soft launch with parent portals.",
  },
  {
    q: "Can we import existing student records from CSV?",
    a: "Yes. Admissions and student modules support CSV import with field mapping. We provide templates and validation reports before commit.",
  },
  {
    q: "Is our data isolated from other schools?",
    a: "Absolutely. Every query is scoped by tenant_id. Your database rows never leak across institutions — multi-tenancy is architectural, not cosmetic.",
  },
  {
    q: "Do you offer on-premise deployment?",
    a: "Enterprise and Consortium tiers support dedicated instances and custom hosting arrangements. Contact us for architecture review.",
  },
] as const;

export const SOCIAL_PROOF = [
  "Greenfield Academy",
  "Sunridge High",
  "Lakeside Preparatory",
  "Northgate District",
  "Heritage Collegiate",
] as const;

export const ACADEMIC_LEARNING = {
  eyebrow: "Academic & Learning",
  title: "Explore a new era of learning",
  subtitle:
    "Smarter tools, real-time insights, and a connected community for every educator.",
  modules: [
    {
      title: "Online Live Classes",
      description: "Conduct interactive virtual sessions with attendance and performance tracking.",
    },
    {
      title: "Study Material",
      description: "Upload, organize, and share digital notes, PDFs, and media resources.",
    },
    {
      title: "Class Timetable",
      description: "Create, edit, and manage class schedules across subjects and sections.",
    },
    {
      title: "Subjects (Class-wise)",
      description: "Assign subjects to specific classes with linked teachers and resources.",
    },
    {
      title: "Homework Management",
      description: "Assign, collect, and evaluate homework submissions efficiently.",
    },
    {
      title: "Lesson Management",
      description: "Structure lessons and maintain progress tracking for each subject.",
    },
    {
      title: "Attendance",
      description: "Mark daily attendance and generate reports for students and staff.",
    },
    {
      title: "Events",
      description: "Plan and share details of academic and cultural events with stakeholders.",
    },
  ],
} as const;

/** TSMS-style “Why unique” trio */
export const UNIQUE_OFFERING = {
  eyebrow: "Smart Solution",
  title: "Why SchoolOS is unique in offerings",
  subtitle:
    "Built for schools and academy networks — admissions, operations, finance, and automation under one roof. No more juggling separate apps.",
  items: [
    {
      title: "Smart Analytics",
      description: "Track progress and performance with live dashboards and export-ready reports.",
      icon: BarChart3,
      illustration: "analytics" as const,
    },
    {
      title: "Automation",
      description: "Save time with automated workflows, fee reminders, and scheduled announcements.",
      icon: Zap,
      illustration: "automation" as const,
    },
    {
      title: "Secure & Reliable",
      description: "Tenant-isolated data, audit trails, and encryption in transit and at rest.",
      icon: ShieldCheck,
      illustration: "security" as const,
    },
  ],
} as const;

/** Role-based feature grid (theschool-management.com pattern) */
export const ROLE_FEATURES = [
  { role: "School Admin", description: "Manage all activities across modules.", icon: Shield, tone: "from-blue-500 to-indigo-600" },
  { role: "Head Teacher", description: "Oversee academics, staff, and school performance.", icon: GraduationCap, tone: "from-violet-500 to-purple-600" },
  { role: "Teacher", description: "Manage classes, marks, homework, and attendance.", icon: BookOpen, tone: "from-sky-500 to-blue-600" },
  { role: "Bursar", description: "Fees, invoices, payments, and expenses in one place.", icon: Wallet, tone: "from-emerald-500 to-teal-600" },
  { role: "Receptionist", description: "Front office, admissions, and visitor management.", icon: UserCheck, tone: "from-amber-500 to-orange-500" },
  { role: "Parent", description: "Monitor fees, results, and announcements.", icon: Users, tone: "from-rose-500 to-pink-600" },
  { role: "Student", description: "Timetable, homework, and portal resources.", icon: GraduationCap, tone: "from-cyan-500 to-blue-500" },
  { role: "Librarian", description: "Books, cards, loans, and reservations.", icon: Library, tone: "from-indigo-500 to-blue-700" },
  { role: "Transport", description: "Routes, vehicles, and student assignments.", icon: Bus, tone: "from-lime-600 to-green-600" },
  { role: "Exam Officer", description: "Schedules, marks, admit cards, and reports.", icon: ClipboardList, tone: "from-fuchsia-500 to-violet-600" },
  { role: "Online Classes", description: "Virtual sessions with attendance tracking.", icon: Video, tone: "from-blue-600 to-cyan-500" },
  { role: "IT Support", description: "Users, roles, and technical configuration.", icon: Headphones, tone: "from-slate-600 to-slate-800" },
] as const;

/** Compact feature grid for home */
export const POWERFUL_FEATURES = [
  { title: "Classes & Sections", description: "Create and manage multiple classes and streams.", icon: GraduationCap },
  { title: "Subjects", description: "Organize subjects per class with teacher assignments.", icon: BookOpen },
  { title: "Study Materials", description: "Upload and distribute resources to students.", icon: FileText },
  { title: "Attendance", description: "Daily student and staff attendance with reports.", icon: Calendar },
  { title: "Class Timetable", description: "Generate and manage schedules seamlessly.", icon: Calendar },
  { title: "Noticeboard", description: "Publish announcements to staff and parents.", icon: Bell },
  { title: "Homework", description: "Assign, track, and review submissions.", icon: ClipboardList },
  { title: "Live Classes", description: "Online sessions with integrated attendance.", icon: Monitor },
] as const;

export const HOME_MODULE_TABS = [
  { id: "academic", label: "Academic", features: ["Classes & streams", "Subjects & timetable", "Study materials", "Homework"] },
  { id: "admin", label: "Administration", features: ["Staff & roles", "Admissions", "Noticeboard", "Events"] },
  { id: "finance", label: "Accounting", features: ["Fee structures", "Invoices & receipts", "Expenses", "Reports"] },
  { id: "exams", label: "Examination", features: ["Exam groups", "Marks entry", "Report cards", "Admit cards"] },
] as const;

export const PILLARS = [
  {
    icon: Shield,
    title: "Absolute Data Isolation",
    body: "Every school operates in a cryptographically separated tenant workspace. No shared rows, no cross-school queries.",
  },
  {
    icon: FileText,
    title: "Flawless Auditing",
    body: "Structural changes capture actor, timestamp, and before/after state — built for boards, regulators, and internal review.",
  },
  {
    icon: GraduationCap,
    title: "All-In-One Operations",
    body: "Academics, finance, HR, messaging, and logistics in one coherent system — fewer integrations, fewer failure points.",
  },
] as const;
