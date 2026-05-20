/** Global SaaS feature catalog — synced to DB via migrations / ensureRuntimeSchema. */
export type FeatureCatalogEntry = {
  code: string;
  name: string;
  description: string;
  category: FeatureCategory;
};

export type FeatureCategory =
  | "modules"
  | "portal"
  | "communications"
  | "platform"
  | "support"
  | "success"
  | "integrations";

export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  modules: "ERP modules",
  portal: "Portal & mobile",
  communications: "Email & messaging",
  platform: "Platform & scale",
  support: "Support & SLA",
  success: "Training & onboarding",
  integrations: "Integrations",
};

/** Features enabled by default when provisioning a new school (not plan-gated extras). */
export const DEFAULT_TENANT_FEATURE_CODES = new Set([
  "students",
  "admissions",
  "staff_hr",
  "timetable",
  "attendance",
  "exams_results",
  "finance_fees",
  "messaging_enabled",
  "portal_enabled",
  "results_visible",
  "fees_must_be_clear",
]);

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  // ERP modules
  { code: "students", name: "Student management", description: "Student records, classes, guardians, and documents", category: "modules" },
  { code: "admissions", name: "Admissions", description: "Applications, enrollment pipeline, and intake forms", category: "modules" },
  { code: "staff_hr", name: "HR & payroll", description: "Staff directory, contracts, leave, and payroll", category: "modules" },
  { code: "timetable", name: "Timetable", description: "Periods, rooms, and class schedules", category: "modules" },
  { code: "attendance", name: "Attendance", description: "Daily attendance registers and summaries", category: "modules" },
  { code: "exams_results", name: "Exams & results", description: "Assessments, grading, and report cards", category: "modules" },
  { code: "finance_fees", name: "Finance & fees", description: "Fee structures, invoices, receipts, and payments", category: "modules" },
  { code: "library", name: "Library", description: "Catalog, lending, and overdue tracking", category: "modules" },
  { code: "transport", name: "Transport", description: "Routes, vehicles, and student transport assignments", category: "modules" },
  { code: "inventory", name: "Inventory & assets", description: "Stock, assets, and maintenance requests", category: "modules" },
  { code: "hostel", name: "Hostel / boarding", description: "Boarding houses, rooms, and allocations", category: "modules" },
  { code: "cafeteria", name: "Cafeteria", description: "Meal plans, menus, and cafeteria billing", category: "modules" },
  // Portal
  { code: "portal_enabled", name: "Parent/student portal", description: "Portal logins for parents and students", category: "portal" },
  { code: "results_visible", name: "Results on portal", description: "Published results visible to portal users", category: "portal" },
  { code: "fees_must_be_clear", name: "Fees gate on results", description: "Block results until fees are cleared", category: "portal" },
  { code: "mobile_app", name: "Mobile app access", description: "PWA / mobile-optimized portal experience", category: "portal" },
  // Communications
  { code: "messaging_enabled", name: "Messaging hub", description: "Announcements, SMS campaigns, and delivery logs", category: "communications" },
  { code: "custom_smtp", name: "Custom SMTP email", description: "Send mail via the school's own SMTP server and sender addresses", category: "communications" },
  { code: "bulk_email", name: "Bulk email", description: "Email campaigns to parents, staff, and segments", category: "communications" },
  { code: "sms_gateway", name: "SMS gateway", description: "Transactional and bulk SMS via configured provider", category: "communications" },
  { code: "whatsapp_notifications", name: "WhatsApp notifications", description: "WhatsApp Business API for alerts and campaigns", category: "communications" },
  // Platform
  { code: "white_label", name: "White-label branding", description: "Custom domain, logo, and branded login experience", category: "platform" },
  { code: "multi_campus", name: "Multi-campus", description: "Multiple branches under one school account", category: "platform" },
  { code: "ai_homework", name: "AI homework assistant", description: "AI-assisted homework and grading workflows", category: "platform" },
  { code: "document_storage", name: "Extended storage", description: "Higher document and attachment storage limits", category: "platform" },
  { code: "advanced_reporting", name: "Advanced reporting", description: "Custom reports, exports, and analytics dashboards", category: "platform" },
  { code: "audit_compliance", name: "Audit & compliance", description: "Extended audit trails and compliance export packs", category: "platform" },
  { code: "api_access", name: "API & webhooks", description: "REST API keys and outbound webhooks for integrations", category: "platform" },
  // Support SLA
  { code: "support_standard", name: "Standard support", description: "Email support — business hours (Mon–Fri, 9–17)", category: "support" },
  { code: "support_extended", name: "Extended support (12h)", description: "12-hour coverage window including weekends", category: "support" },
  { code: "support_24x7", name: "24/7 priority support", description: "Round-the-clock priority tickets and phone escalation", category: "support" },
  { code: "dedicated_account_manager", name: "Dedicated success manager", description: "Named customer success contact for your school", category: "support" },
  // Training & onboarding
  { code: "onboarding_training", name: "Live onboarding", description: "Live onboarding sessions with a SchoolOS specialist", category: "success" },
  { code: "training_library", name: "Training library", description: "Self-paced guides, videos, and in-app help center", category: "success" },
  { code: "implementation_assisted", name: "Assisted implementation", description: "Data migration and configuration assistance", category: "success" },
  { code: "quarterly_reviews", name: "Quarterly business reviews", description: "Scheduled reviews of usage, goals, and roadmap", category: "success" },
  // Integrations
  { code: "sso_saml", name: "SSO / SAML", description: "Single sign-on with Google, Microsoft, or SAML IdP", category: "integrations" },
  { code: "ldap_sync", name: "LDAP / Active Directory", description: "Directory sync for staff user provisioning", category: "integrations" },
  { code: "payment_gateways", name: "Payment gateways", description: "Mobile money and card payments for school fees", category: "integrations" },
  { code: "accounting_export", name: "Accounting export", description: "Exports for QuickBooks, Xero, and similar systems", category: "integrations" },
  { code: "government_reports", name: "Government reports", description: "Statutory and ministry report templates (e.g. UNEB)", category: "integrations" },
];
