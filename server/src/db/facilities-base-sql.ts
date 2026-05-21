/**
 * Tables that live in 0026_lean_shadow_king.sql but are referenced by journal migrations
 * 0022–0024 before 0026 runs. Applied via vps-schema-patch and prepended to 0022_phase_d.sql.
 */
export const FACILITIES_BASE_TABLES_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "transport_routes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "transport_routes_tenant_idx" ON "transport_routes" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "transport_stops" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "route_id" uuid NOT NULL REFERENCES "transport_routes"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "order_no" integer DEFAULT 0 NOT NULL,
    "lat" text,
    "lng" text
  )`,
  `CREATE INDEX IF NOT EXISTS "transport_stops_tenant_idx" ON "transport_stops" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "transport_vehicles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "route_id" uuid REFERENCES "transport_routes"("id"),
    "registration" text NOT NULL,
    "capacity" integer
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_reg_idx" ON "transport_vehicles" ("tenant_id", "registration")`,
  `CREATE TABLE IF NOT EXISTS "library_books" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "isbn" text,
    "title" text NOT NULL,
    "author" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "library_books_tenant_idx" ON "library_books" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "library_copies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "book_id" uuid NOT NULL REFERENCES "library_books"("id") ON DELETE cascade,
    "barcode" text NOT NULL,
    "status" text DEFAULT 'available' NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "library_copies_barcode_idx" ON "library_copies" ("tenant_id", "barcode")`,
  `CREATE TABLE IF NOT EXISTS "library_loans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "copy_id" uuid NOT NULL REFERENCES "library_copies"("id"),
    "student_id" uuid REFERENCES "students"("id"),
    "staff_id" uuid REFERENCES "staff"("id") ON DELETE set null,
    "library_card_id" uuid,
    "loaned_at" timestamp DEFAULT now() NOT NULL,
    "due_at" timestamp,
    "returned_at" timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "library_loans_tenant_idx" ON "library_loans" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "boarding_houses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "boarding_houses_tenant_idx" ON "boarding_houses" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "boarding_rooms" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "house_id" uuid NOT NULL REFERENCES "boarding_houses"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "capacity" integer DEFAULT 4 NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "boarding_rooms_tenant_idx" ON "boarding_rooms" ("tenant_id")`,
];

export async function applyFacilitiesBaseTables(
  run: (sql: string) => Promise<void>,
): Promise<void> {
  for (const stmt of FACILITIES_BASE_TABLES_SQL) {
    await run(stmt);
  }
}
