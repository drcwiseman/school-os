/** Operations tables from 0026 — ensure on VPS before API use. */
export const OPERATIONS_BASE_TABLES_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS discipline_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE NO ACTION,
    incident_date timestamptz NOT NULL DEFAULT now(),
    category text NOT NULL,
    description text NOT NULL,
    severity text NOT NULL DEFAULT 'minor',
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS discipline_inc_tenant_idx ON discipline_incidents(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS discipline_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    incident_id uuid NOT NULL REFERENCES discipline_incidents(id) ON DELETE CASCADE,
    action text NOT NULL,
    action_date timestamptz NOT NULL DEFAULT now(),
    notes text
  )`,
  `CREATE INDEX IF NOT EXISTS discipline_act_tenant_idx ON discipline_actions(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS sickbay_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE NO ACTION,
    visit_date timestamptz NOT NULL DEFAULT now(),
    complaint text NOT NULL,
    treatment text,
    discharged_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sickbay_tenant_idx ON sickbay_visits(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS health_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE NO ACTION,
    flag text NOT NULL,
    notes text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS health_flags_tenant_idx ON health_flags(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku text NOT NULL,
    name text NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    unit text DEFAULT 'pcs',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inventory_sku_idx ON inventory_items(tenant_id, sku)`,
  `CREATE TABLE IF NOT EXISTS inventory_stock_moves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES inventory_items(id),
    delta integer NOT NULL,
    reason text,
    moved_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS stock_moves_tenant_idx ON inventory_stock_moves(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS suppliers_tenant_idx ON inventory_suppliers(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS purchase_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id uuid REFERENCES inventory_suppliers(id),
    item_name text NOT NULL,
    quantity integer NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS purchase_req_tenant_idx ON purchase_requests(tenant_id)`,
];
