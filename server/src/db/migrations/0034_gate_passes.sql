-- SM Gate passes / visitor management

CREATE TABLE IF NOT EXISTS gate_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pass_number text NOT NULL,
  visitor_name text NOT NULL,
  visitor_mobile text,
  relation_to_student text,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  pass_date date NOT NULL DEFAULT CURRENT_DATE,
  in_time timestamptz NOT NULL DEFAULT now(),
  out_time timestamptz,
  authorized_by_staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  purpose text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gate_passes_number_idx ON gate_passes(tenant_id, pass_number);
CREATE INDEX IF NOT EXISTS gate_passes_tenant_date_idx ON gate_passes(tenant_id, pass_date);
CREATE INDEX IF NOT EXISTS gate_passes_student_idx ON gate_passes(tenant_id, student_id);

INSERT INTO permissions (code, description, module)
VALUES
  ('gate_pass.view', 'View gate passes and visitors', 'gate_pass'),
  ('gate_pass.manage', 'Create and manage gate passes', 'gate_pass')
ON CONFLICT (code) DO NOTHING;
