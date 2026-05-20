CREATE TABLE IF NOT EXISTS "platform_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_name" text NOT NULL,
  "stored_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL DEFAULT 0,
  "alt_text" text,
  "title" text,
  "uploaded_by" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_media_created_idx" ON "platform_media" ("created_at");
CREATE INDEX IF NOT EXISTS "platform_media_mime_idx" ON "platform_media" ("mime_type");
