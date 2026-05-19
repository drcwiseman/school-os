CREATE TABLE IF NOT EXISTS "student_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "document_type" text NOT NULL,
  "file_name" text NOT NULL,
  "file_path" text NOT NULL,
  "mime_type" text,
  "uploaded_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "student_docs_tenant_idx" ON "student_documents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "student_docs_student_idx" ON "student_documents" ("student_id");
