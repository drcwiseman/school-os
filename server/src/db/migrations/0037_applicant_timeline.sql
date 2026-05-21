-- Applicant timeline: notes/events and document uploads

CREATE TABLE IF NOT EXISTS applicant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_docs_tenant_idx ON applicant_documents(tenant_id);
CREATE INDEX IF NOT EXISTS app_docs_applicant_idx ON applicant_documents(applicant_id);

CREATE TABLE IF NOT EXISTS applicant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date timestamptz,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_events_tenant_idx ON applicant_events(tenant_id);
CREATE INDEX IF NOT EXISTS app_events_applicant_idx ON applicant_events(applicant_id);
