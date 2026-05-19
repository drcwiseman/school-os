import {
  BookOpen,
  Bus,
  Calculator,
  FileText,
  GraduationCap,
  Library,
  Shield,
  Users,
  Wallet,
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
