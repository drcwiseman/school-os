-- Tickets, staff hostel, utilities permissions

CREATE TABLE IF NOT EXISTS school_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  category text NOT NULL DEFAULT 'maintenance',
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS school_tickets_number_idx ON school_tickets(tenant_id, ticket_number);
CREATE INDEX IF NOT EXISTS school_tickets_tenant_status_idx ON school_tickets(tenant_id, status);

CREATE TABLE IF NOT EXISTS staff_hostel_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_hostel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES staff_hostel_blocks(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_hostel_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES staff_hostel_rooms(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  from_date timestamptz NOT NULL DEFAULT now(),
  to_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_hostel_alloc_tenant_idx ON staff_hostel_allocations(tenant_id);

INSERT INTO permissions (code, description, module)
VALUES
  ('ticket.view', 'View facility support tickets', 'ticket'),
  ('ticket.manage', 'Create and resolve support tickets', 'ticket'),
  ('staff_hostel.view', 'View staff hostel housing', 'staff_hostel'),
  ('staff_hostel.manage', 'Manage staff hostel allocations', 'staff_hostel')
ON CONFLICT (code) DO NOTHING;
