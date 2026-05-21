-- Student Management: leaves, inter-school transfers, issued certificates log

CREATE TABLE IF NOT EXISTS "student_leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "review_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "student_leave_requests_tenant_idx" ON "student_leave_requests" ("tenant_id", "student_id");

CREATE TABLE IF NOT EXISTS "student_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "direction" text NOT NULL DEFAULT 'outbound',
  "destination_school" text NOT NULL,
  "destination_branch" text,
  "reason" text,
  "effective_date" timestamp,
  "status" text NOT NULL DEFAULT 'pending',
  "tc_issued_at" timestamp,
  "processed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "student_transfers_tenant_idx" ON "student_transfers" ("tenant_id");

CREATE TABLE IF NOT EXISTS "student_certificates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "cert_type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "issued_at" timestamp DEFAULT now() NOT NULL,
  "issued_by" uuid REFERENCES "users"("id") ON DELETE set null
);
