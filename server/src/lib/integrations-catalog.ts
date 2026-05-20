export type IntegrationEntry = {
  code: string;
  name: string;
  description: string;
  category: "payments" | "communications" | "productivity" | "accounting" | "analytics" | "education";
  benefits: string[];
  docsUrl?: string;
  popular?: boolean;
};

/** Platform integration marketplace — connect to enhance SchoolOS. */
export const INTEGRATIONS_CATALOG: IntegrationEntry[] = [
  {
    code: "google_workspace",
    name: "Google Workspace",
    description: "Gmail SMTP, Calendar sync, and Google Sign-In for staff.",
    category: "productivity",
    benefits: ["Send school email via Gmail", "SSO for staff", "Calendar for timetables"],
    popular: true,
  },
  {
    code: "microsoft_365",
    name: "Microsoft 365",
    description: "Outlook SMTP, Teams notifications, and Azure AD SSO.",
    category: "productivity",
    benefits: ["Outlook as mail transport", "Azure AD login", "Teams alerts"],
    popular: true,
  },
  {
    code: "whatsapp_business",
    name: "WhatsApp Business API",
    description: "Fee reminders and announcements on WhatsApp.",
    category: "communications",
    benefits: ["Higher open rates than SMS", "Two-way parent chat", "Template messages"],
    popular: true,
  },
  {
    code: "mtn_momo",
    name: "MTN Mobile Money (Uganda)",
    description: "Collect school fees via MTN MoMo API.",
    category: "payments",
    benefits: ["Instant fee collection", "Auto-reconcile payments", "Parent-friendly"],
    popular: true,
  },
  {
    code: "airtel_money",
    name: "Airtel Money",
    description: "Airtel Money collections for East Africa.",
    category: "payments",
    benefits: ["Multi-country wallets", "Webhook confirmations"],
    popular: true,
  },
  {
    code: "flutterwave",
    name: "Flutterwave",
    description: "Cards, mobile money, and bank transfers across Africa.",
    category: "payments",
    benefits: ["Unified checkout", "Multi-currency", "Settlement reports"],
    popular: true,
  },
  {
    code: "pesapal",
    name: "Pesapal",
    description: "Popular East Africa payment gateway for schools.",
    category: "payments",
    benefits: ["M-Pesa integration", "Invoice links", "Reconciliation"],
  },
  {
    code: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync invoices and payments to accounting.",
    category: "accounting",
    benefits: ["Auto journal entries", "Audit-ready books", "Tax reporting"],
    popular: true,
  },
  {
    code: "xero",
    name: "Xero",
    description: "Cloud accounting export for finance teams.",
    category: "accounting",
    benefits: ["Chart of accounts mapping", "Bank feed sync"],
  },
  {
    code: "zapier",
    name: "Zapier / Webhooks",
    description: "Connect SchoolOS to 5,000+ apps via webhooks.",
    category: "productivity",
    benefits: ["No-code automations", "CRM sync", "Custom workflows"],
  },
  {
    code: "google_analytics",
    name: "Google Analytics 4",
    description: "Track marketing site and portal usage.",
    category: "analytics",
    benefits: ["Conversion funnels", "Campaign attribution", "Audience insights"],
    popular: true,
  },
  {
    code: "plausible",
    name: "Plausible Analytics",
    description: "Privacy-friendly analytics for your public site.",
    category: "analytics",
    benefits: ["GDPR-friendly", "Lightweight script", "No cookie banners"],
  },
  {
    code: "zoom",
    name: "Zoom / Google Meet",
    description: "Virtual parent meetings and remote classes.",
    category: "education",
    benefits: ["Meeting links on events", "Attendance from calls"],
  },
  {
    code: "uneb_api",
    name: "UNEB / Ministry reports",
    description: "Statutory exam and enrollment report templates (Uganda).",
    category: "education",
    benefits: ["Pre-filled government forms", "Compliance exports"],
  },
  {
    code: "slack",
    name: "Slack",
    description: "Staff alerts for admissions, fees, and incidents.",
    category: "communications",
    benefits: ["Real-time ops channel", "Escalation workflows"],
  },
];
