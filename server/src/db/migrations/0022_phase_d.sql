-- Phase D: Transport/hostel depth, multi-campus, security, API keys

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id");
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id");
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id");
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "security_json" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "branding_extended_json" jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "transport_drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "phone" text,
  "license_no" text,
  "vehicle_id" uuid REFERENCES "transport_vehicles"("id"),
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vehicle_gps_pings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "vehicle_id" uuid NOT NULL REFERENCES "transport_vehicles"("id") ON DELETE cascade,
  "lat" numeric(10,7) NOT NULL,
  "lng" numeric(10,7) NOT NULL,
  "speed_kph" numeric(6,2),
  "recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transport_fuel_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "vehicle_id" uuid NOT NULL REFERENCES "transport_vehicles"("id"),
  "liters" numeric(8,2) NOT NULL,
  "cost_minor" integer,
  "odometer_km" integer,
  "logged_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vehicle_maintenance_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "vehicle_id" uuid NOT NULL REFERENCES "transport_vehicles"("id"),
  "description" text NOT NULL,
  "cost_minor" integer,
  "service_date" date NOT NULL,
  "next_due_date" date
);

CREATE TABLE IF NOT EXISTS "transport_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "route_id" uuid REFERENCES "transport_routes"("id"),
  "student_id" uuid REFERENCES "students"("id"),
  "alert_type" text NOT NULL,
  "message" text NOT NULL,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "transport_stops" ADD COLUMN IF NOT EXISTS "lat" numeric(10,7);
ALTER TABLE "transport_stops" ADD COLUMN IF NOT EXISTS "lng" numeric(10,7);
ALTER TABLE "transport_vehicles" ADD COLUMN IF NOT EXISTS "route_id" uuid REFERENCES "transport_routes"("id");

CREATE TABLE IF NOT EXISTS "hostel_visitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "visitor_name" text NOT NULL,
  "student_id" uuid REFERENCES "students"("id"),
  "check_in" timestamp DEFAULT now() NOT NULL,
  "check_out" timestamp,
  "purpose" text
);

CREATE TABLE IF NOT EXISTS "hostel_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "date" date NOT NULL,
  "status" text NOT NULL DEFAULT 'present',
  "notes" text
);

CREATE TABLE IF NOT EXISTS "hostel_meals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "meal_type" text NOT NULL,
  "menu_json" jsonb DEFAULT '{}'::jsonb,
  "attendance_count" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "hostel_disciplinary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "incident" text NOT NULL,
  "action_taken" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "boarding_room_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "from_room_id" uuid REFERENCES "boarding_rooms"("id"),
  "to_room_id" uuid REFERENCES "boarding_rooms"("id"),
  "changed_at" timestamp DEFAULT now() NOT NULL,
  "changed_by" uuid REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "campus_departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "campus_id" uuid NOT NULL REFERENCES "tenant_campuses"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "parent_id" uuid REFERENCES "campus_departments"("id")
);

CREATE TABLE IF NOT EXISTS "tenant_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "scopes_json" jsonb DEFAULT '[]'::jsonb,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tenant_webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "url" text NOT NULL,
  "events_json" jsonb DEFAULT '[]'::jsonb,
  "secret" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "user_id" uuid REFERENCES "users"("id"),
  "parent_account_id" uuid,
  "endpoint" text NOT NULL,
  "keys_json" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
