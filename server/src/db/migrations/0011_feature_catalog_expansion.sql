-- Expanded SaaS feature catalog (Odoo-class modules, SMTP, support SLAs, training)
ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'modules';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "smtp_settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
INSERT INTO "features" ("code", "name", "description", "category") VALUES
  ('students', 'Student management', 'Student records, classes, guardians, and documents', 'modules'),
  ('admissions', 'Admissions', 'Applications, enrollment pipeline, and intake forms', 'modules'),
  ('staff_hr', 'HR & payroll', 'Staff directory, contracts, leave, and payroll', 'modules'),
  ('timetable', 'Timetable', 'Periods, rooms, and class schedules', 'modules'),
  ('attendance', 'Attendance', 'Daily attendance registers and summaries', 'modules'),
  ('exams_results', 'Exams & results', 'Assessments, grading, and report cards', 'modules'),
  ('finance_fees', 'Finance & fees', 'Fee structures, invoices, receipts, and payments', 'modules'),
  ('library', 'Library', 'Catalog, lending, and overdue tracking', 'modules'),
  ('transport', 'Transport', 'Routes, vehicles, and student transport assignments', 'modules'),
  ('inventory', 'Inventory & assets', 'Stock, assets, and maintenance requests', 'modules'),
  ('hostel', 'Hostel / boarding', 'Boarding houses, rooms, and allocations', 'modules'),
  ('cafeteria', 'Cafeteria', 'Meal plans, menus, and cafeteria billing', 'modules'),
  ('mobile_app', 'Mobile app access', 'PWA / mobile-optimized portal experience', 'portal'),
  ('custom_smtp', 'Custom SMTP email', 'Send mail via the school''s own SMTP server and sender addresses', 'communications'),
  ('bulk_email', 'Bulk email', 'Email campaigns to parents, staff, and segments', 'communications'),
  ('sms_gateway', 'SMS gateway', 'Transactional and bulk SMS via configured provider', 'communications'),
  ('whatsapp_notifications', 'WhatsApp notifications', 'WhatsApp Business API for alerts and campaigns', 'communications'),
  ('document_storage', 'Extended storage', 'Higher document and attachment storage limits', 'platform'),
  ('advanced_reporting', 'Advanced reporting', 'Custom reports, exports, and analytics dashboards', 'platform'),
  ('audit_compliance', 'Audit & compliance', 'Extended audit trails and compliance export packs', 'platform'),
  ('api_access', 'API & webhooks', 'REST API keys and outbound webhooks for integrations', 'platform'),
  ('support_standard', 'Standard support', 'Email support — business hours (Mon–Fri, 9–17)', 'support'),
  ('support_extended', 'Extended support (12h)', '12-hour coverage window including weekends', 'support'),
  ('support_24x7', '24/7 priority support', 'Round-the-clock priority tickets and phone escalation', 'support'),
  ('dedicated_account_manager', 'Dedicated success manager', 'Named customer success contact for your school', 'support'),
  ('onboarding_training', 'Live onboarding', 'Live onboarding sessions with a SchoolOS specialist', 'success'),
  ('training_library', 'Training library', 'Self-paced guides, videos, and in-app help center', 'success'),
  ('implementation_assisted', 'Assisted implementation', 'Data migration and configuration assistance', 'success'),
  ('quarterly_reviews', 'Quarterly business reviews', 'Scheduled reviews of usage, goals, and roadmap', 'success'),
  ('sso_saml', 'SSO / SAML', 'Single sign-on with Google, Microsoft, or SAML IdP', 'integrations'),
  ('ldap_sync', 'LDAP / Active Directory', 'Directory sync for staff user provisioning', 'integrations'),
  ('payment_gateways', 'Payment gateways', 'Mobile money and card payments for school fees', 'integrations'),
  ('accounting_export', 'Accounting export', 'Exports for QuickBooks, Xero, and similar systems', 'integrations'),
  ('government_reports', 'Government reports', 'Statutory and ministry report templates (e.g. UNEB)', 'integrations')
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category";
--> statement-breakpoint
UPDATE "features" SET "category" = 'portal' WHERE "code" IN ('portal_enabled', 'results_visible', 'fees_must_be_clear');
UPDATE "features" SET "category" = 'communications' WHERE "code" = 'messaging_enabled';
UPDATE "features" SET "category" = 'platform' WHERE "code" IN ('white_label', 'multi_campus', 'ai_homework');
--> statement-breakpoint
UPDATE "plans" SET "features_json" = '{
  "students":true,"admissions":true,"staff_hr":true,"timetable":true,"attendance":true,"exams_results":true,"finance_fees":true,
  "messaging_enabled":true,"portal_enabled":false,"results_visible":true,"fees_must_be_clear":false,
  "support_standard":true,"training_library":true
}'::jsonb WHERE "code" = 'starter';
--> statement-breakpoint
UPDATE "plans" SET "features_json" = '{
  "students":true,"admissions":true,"staff_hr":true,"timetable":true,"attendance":true,"exams_results":true,"finance_fees":true,
  "library":true,"transport":true,"messaging_enabled":true,"portal_enabled":true,"results_visible":true,"fees_must_be_clear":false,
  "custom_smtp":true,"bulk_email":true,"mobile_app":true,"white_label":true,"multi_campus":true,"ai_homework":true,
  "advanced_reporting":true,"api_access":true,"support_extended":true,"onboarding_training":true,"training_library":true,"implementation_assisted":true,
  "payment_gateways":true,"accounting_export":true
}'::jsonb WHERE "code" = 'pro';
