-- Admission / profile fields for Akkhor-style student form
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "blood_group" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "short_bio" text;
