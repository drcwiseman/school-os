import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import crypto from "crypto";

const API_KEYS_KEY = "api_keys";
const WEBHOOKS_KEY = "outbound_webhooks";

export type PlatformApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type OutboundWebhook = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secretPrefix: string;
};

type StoredKeys = { keys: Array<{ id: string; name: string; hash: string; prefix: string; createdAt: string; lastUsedAt?: string }> };
type StoredWebhooks = { hooks: Array<{ id: string; url: string; events: string[]; enabled: boolean; secret: string }> };

export async function getPlatformApiSettings() {
  const [keysRow] = await db.select().from(platformSettings).where(eq(platformSettings.key, API_KEYS_KEY)).limit(1);
  const [hooksRow] = await db.select().from(platformSettings).where(eq(platformSettings.key, WEBHOOKS_KEY)).limit(1);
  const keys = ((keysRow?.value ?? {}) as StoredKeys).keys ?? [];
  const hooks = ((hooksRow?.value ?? {}) as StoredWebhooks).hooks ?? [];

  return {
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? null,
    })) as PlatformApiKey[],
    webhooks: hooks.map((h) => ({
      id: h.id,
      url: h.url,
      events: h.events,
      enabled: h.enabled,
      secretPrefix: h.secret.slice(0, 8) + "…",
    })) as OutboundWebhook[],
    availableEvents: ["tenant.created", "tenant.suspended", "payment.received", "backup.completed", "backup.failed"],
  };
}

export async function createPlatformApiKey(name: string): Promise<{ key: PlatformApiKey; plainKey: string }> {
  const plain = `sk_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  const prefix = plain.slice(0, 16);
  const entry = {
    id: crypto.randomUUID(),
    name,
    hash,
    prefix,
    createdAt: new Date().toISOString(),
  };

  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, API_KEYS_KEY)).limit(1);
  const existing = (row?.value ?? { keys: [] }) as StoredKeys;
  const stored: StoredKeys = { keys: [...existing.keys, entry] };

  await db
    .insert(platformSettings)
    .values({ key: API_KEYS_KEY, value: stored, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: stored, updatedAt: new Date() } });

  return {
    key: { id: entry.id, name, prefix, createdAt: entry.createdAt, lastUsedAt: null },
    plainKey: plain,
  };
}

export async function deletePlatformApiKey(id: string) {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, API_KEYS_KEY)).limit(1);
  const stored = (row?.value ?? { keys: [] }) as StoredKeys;
  const next = { keys: stored.keys.filter((k) => k.id !== id) };
  await db
    .insert(platformSettings)
    .values({ key: API_KEYS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: next, updatedAt: new Date() } });
}

export async function upsertOutboundWebhook(input: {
  id?: string;
  url: string;
  events: string[];
  enabled: boolean;
}) {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, WEBHOOKS_KEY)).limit(1);
  const stored = (row?.value ?? { hooks: [] }) as StoredWebhooks;
  const id = input.id ?? crypto.randomUUID();
  const secret = crypto.randomBytes(16).toString("hex");
  const hook = { id, url: input.url, events: input.events, enabled: input.enabled, secret };
  const idx = stored.hooks.findIndex((h) => h.id === id);
  if (idx >= 0) stored.hooks[idx] = { ...stored.hooks[idx], ...hook, secret: stored.hooks[idx].secret };
  else stored.hooks.push(hook);

  await db
    .insert(platformSettings)
    .values({ key: WEBHOOKS_KEY, value: stored, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: stored, updatedAt: new Date() } });

  return { id, secretPrefix: secret.slice(0, 8) + "…" };
}
