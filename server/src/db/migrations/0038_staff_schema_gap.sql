-- Staff table columns expected by HR routes (soft delete, profile fields)

ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
