/**
 * Tables from migrations 0033–0035 (not in drizzle journal). Applied at boot via vps-schema-patch.
 */
export const FACILITIES_OPERATIONS_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS library_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    card_number text NOT NULL,
    member_type text NOT NULL DEFAULT 'student',
    student_id uuid REFERENCES students(id) ON DELETE SET NULL,
    staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active',
    issued_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS library_cards_number_idx ON library_cards(tenant_id, card_number)`,
  `CREATE INDEX IF NOT EXISTS library_cards_tenant_idx ON library_cards(tenant_id)`,
  `ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES staff(id) ON DELETE SET NULL`,
  `ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS library_card_id uuid REFERENCES library_cards(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS library_fines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    loan_id uuid NOT NULL REFERENCES library_loans(id) ON DELETE NO ACTION,
    amount integer NOT NULL,
    paid boolean NOT NULL DEFAULT false
  )`,
  `CREATE INDEX IF NOT EXISTS library_fines_tenant_idx ON library_fines(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS facility_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    room_type text NOT NULL DEFAULT 'general',
    building text,
    floor text,
    capacity integer,
    status text NOT NULL DEFAULT 'available',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS facility_rooms_tenant_idx ON facility_rooms(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS facility_room_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES facility_rooms(id) ON DELETE CASCADE,
    title text NOT NULL,
    booked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    status text NOT NULL DEFAULT 'confirmed',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS facility_room_bookings_tenant_idx ON facility_room_bookings(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS route_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    route_id uuid NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    stop_id uuid REFERENCES transport_stops(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS route_assignments_tenant_idx ON route_assignments(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS boarding_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES boarding_rooms(id) ON DELETE NO ACTION,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE NO ACTION,
    from_date timestamptz NOT NULL DEFAULT now(),
    to_date timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS boarding_alloc_tenant_idx ON boarding_allocations(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS gate_passes (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS gate_passes_number_idx ON gate_passes(tenant_id, pass_number)`,
  `CREATE INDEX IF NOT EXISTS gate_passes_tenant_date_idx ON gate_passes(tenant_id, pass_date)`,
  `CREATE INDEX IF NOT EXISTS gate_passes_student_idx ON gate_passes(tenant_id, student_id)`,
  `CREATE TABLE IF NOT EXISTS school_tickets (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS school_tickets_number_idx ON school_tickets(tenant_id, ticket_number)`,
  `CREATE INDEX IF NOT EXISTS school_tickets_tenant_status_idx ON school_tickets(tenant_id, status)`,
  `CREATE TABLE IF NOT EXISTS staff_hostel_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS staff_hostel_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    block_id uuid NOT NULL REFERENCES staff_hostel_blocks(id) ON DELETE CASCADE,
    name text NOT NULL,
    capacity integer NOT NULL DEFAULT 2,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS staff_hostel_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES staff_hostel_rooms(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    from_date timestamptz NOT NULL DEFAULT now(),
    to_date timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS staff_hostel_alloc_tenant_idx ON staff_hostel_allocations(tenant_id)`,
  `INSERT INTO permissions (code, description, module)
   VALUES
     ('gate_pass.view', 'View gate passes and visitors', 'gate_pass'),
     ('gate_pass.manage', 'Create and manage gate passes', 'gate_pass'),
     ('ticket.view', 'View facility support tickets', 'ticket'),
     ('ticket.manage', 'Create and resolve support tickets', 'ticket'),
     ('staff_hostel.view', 'View staff hostel housing', 'staff_hostel'),
     ('staff_hostel.manage', 'Manage staff hostel allocations', 'staff_hostel')
   ON CONFLICT (code) DO NOTHING`,
];

export async function applyFacilitiesOperationsTables(
  run: (sql: string) => Promise<void>,
): Promise<void> {
  for (const stmt of FACILITIES_OPERATIONS_SQL) {
    await run(stmt);
  }
}
