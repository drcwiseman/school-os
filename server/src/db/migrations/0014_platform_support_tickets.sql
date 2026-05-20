CREATE TABLE IF NOT EXISTS "platform_support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL,
  "subject" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "priority" text NOT NULL DEFAULT 'normal',
  "category" text NOT NULL DEFAULT 'general',
  "requester_name" text,
  "requester_email" text,
  "assigned_admin_id" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "created_by_admin_id" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_support_tickets_status_idx" ON "platform_support_tickets" ("status");
CREATE INDEX IF NOT EXISTS "platform_support_tickets_tenant_idx" ON "platform_support_tickets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "platform_support_tickets_updated_idx" ON "platform_support_tickets" ("updated_at");

CREATE TABLE IF NOT EXISTS "platform_support_ticket_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "platform_support_tickets"("id") ON DELETE CASCADE,
  "platform_admin_id" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "is_internal" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_support_ticket_messages_ticket_idx" ON "platform_support_ticket_messages" ("ticket_id");
