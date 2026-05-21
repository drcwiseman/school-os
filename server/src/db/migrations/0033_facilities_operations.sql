-- Facilities & Operations: library cards, staff loans, campus rooms, bookings

CREATE TABLE IF NOT EXISTS library_cards (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS library_cards_number_idx ON library_cards(tenant_id, card_number);
CREATE INDEX IF NOT EXISTS library_cards_tenant_idx ON library_cards(tenant_id);

ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS library_card_id uuid REFERENCES library_cards(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS facility_rooms (
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
);
CREATE INDEX IF NOT EXISTS facility_rooms_tenant_idx ON facility_rooms(tenant_id);

CREATE TABLE IF NOT EXISTS facility_room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES facility_rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  booked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS facility_room_bookings_tenant_idx ON facility_room_bookings(tenant_id);
