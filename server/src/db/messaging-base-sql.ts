/** Messaging tables — ensure on VPS before API use. */
export const MESSAGING_BASE_TABLES_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS message_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    channel text NOT NULL DEFAULT 'sms',
    subject text,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS msg_templates_tenant_idx ON message_templates(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    audience text NOT NULL DEFAULT 'all',
    published boolean NOT NULL DEFAULT false,
    publish_at timestamptz,
    notify_channels jsonb DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS announcements_tenant_idx ON announcements(tenant_id)`,
  `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS publish_at timestamptz`,
  `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS notify_channels jsonb DEFAULT '[]'::jsonb`,
  `CREATE TABLE IF NOT EXISTS system_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    category text NOT NULL DEFAULT 'general',
    link text,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS system_notifications_tenant_user_idx ON system_notifications(tenant_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    channel text NOT NULL DEFAULT 'sms',
    template_id uuid REFERENCES message_templates(id),
    audience text NOT NULL DEFAULT 'parents',
    audience_filter jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'draft',
    sent_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS campaigns_tenant_idx ON campaigns(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS delivery_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id uuid REFERENCES campaigns(id),
    announcement_id uuid REFERENCES announcements(id),
    recipient text NOT NULL,
    channel text NOT NULL DEFAULT 'console',
    status text NOT NULL DEFAULT 'sent',
    provider_ref text,
    error text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS delivery_logs_tenant_idx ON delivery_logs(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS internal_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_user_id uuid NOT NULL REFERENCES users(id),
    to_user_id uuid REFERENCES users(id),
    body text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS internal_messages_tenant_idx ON internal_messages(tenant_id)`,
];
