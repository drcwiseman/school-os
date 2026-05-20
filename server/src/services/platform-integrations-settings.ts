import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { INTEGRATIONS_CATALOG, type IntegrationEntry } from "../lib/integrations-catalog";
import { getIntegrationSchema, type IntegrationFieldDef, type IntegrationSchema } from "../lib/integration-schemas";
import { getPlatformMarketing } from "./platform-settings";

const SETTINGS_KEY = "integrations";

export type IntegrationConfigStored = {
  enabled: boolean;
  credentials: Record<string, string>;
  notes?: string;
  updatedAt?: string;
};

export type IntegrationConfigPublic = {
  code: string;
  enabled: boolean;
  configured: boolean;
  credentials: Record<string, string>;
  notes: string;
  updatedAt: string | null;
  schema: IntegrationSchema;
  webhookUrl: string | null;
};

export type PlatformIntegrationsHub = {
  summary: {
    total: number;
    connected: number;
    enabled: number;
    popular: number;
  };
  webhookBaseUrl: string;
  catalog: IntegrationEntry[];
  configs: IntegrationConfigPublic[];
};

function maskCredentialValue(key: string, value: string): string {
  if (!value) return "";
  const secretKeys = /secret|password|token|key|pass/i;
  if (secretKeys.test(key) && value.length > 0) return "••••••••";
  if (value.length > 48) return `${value.slice(0, 8)}…${value.slice(-4)}`;
  return value;
}

function maskCredentials(credentials: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(credentials)) {
    out[k] = maskCredentialValue(k, v);
  }
  return out;
}

function isConfigured(schema: IntegrationSchema, credentials: Record<string, string>): boolean {
  const required = schema.fields.filter((f) => f.required);
  if (required.length === 0) {
    return Object.values(credentials).some((v) => v.trim().length > 0);
  }
  return required.every((f) => (credentials[f.key] ?? "").trim().length > 0);
}

async function loadRawConfigs(): Promise<Record<string, IntegrationConfigStored>> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
  return (row?.value ?? {}) as Record<string, IntegrationConfigStored>;
}

async function saveRawConfigs(configs: Record<string, IntegrationConfigStored>) {
  await db
    .insert(platformSettings)
    .values({ key: SETTINGS_KEY, value: configs, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: configs, updatedAt: new Date() },
    });
}

async function webhookBaseUrl(): Promise<string> {
  const marketing = await getPlatformMarketing();
  const base = (process.env.CLIENT_ORIGIN || marketing.siteUrl || "https://school.bclimaxtech.com").replace(/\/$/, "");
  return `${base}/api/webhooks`;
}

function toPublicConfig(entry: IntegrationEntry, stored?: IntegrationConfigStored): IntegrationConfigPublic {
  const schema = getIntegrationSchema(entry);
  const credentials = stored?.credentials ?? {};
  const configured = isConfigured(schema, credentials);
  const base = ""; // filled async in hub

  return {
    code: entry.code,
    enabled: stored?.enabled ?? false,
    configured,
    credentials: maskCredentials(credentials),
    notes: stored?.notes ?? "",
    updatedAt: stored?.updatedAt ?? null,
    schema,
    webhookUrl: schema.webhookPath ? `${base}${schema.webhookPath}` : null,
  };
}

export async function getPlatformIntegrationsHub(): Promise<PlatformIntegrationsHub> {
  const raw = await loadRawConfigs();
  const base = await webhookBaseUrl();
  const configs = INTEGRATIONS_CATALOG.map((entry) => {
    const c = toPublicConfig(entry, raw[entry.code]);
    if (c.schema.webhookPath) {
      c.webhookUrl = `${base}${c.schema.webhookPath}`;
    }
    return c;
  });

  const connected = configs.filter((c) => c.configured).length;
  const enabled = configs.filter((c) => c.enabled).length;

  return {
    summary: {
      total: INTEGRATIONS_CATALOG.length,
      connected,
      enabled,
      popular: INTEGRATIONS_CATALOG.filter((i) => i.popular).length,
    },
    webhookBaseUrl: base,
    catalog: INTEGRATIONS_CATALOG,
    configs,
  };
}

export async function getPlatformIntegrationConfig(code: string): Promise<IntegrationConfigPublic | null> {
  const entry = INTEGRATIONS_CATALOG.find((i) => i.code === code);
  if (!entry) return null;
  const raw = await loadRawConfigs();
  const base = await webhookBaseUrl();
  const c = toPublicConfig(entry, raw[code]);
  if (c.schema.webhookPath) c.webhookUrl = `${base}${c.schema.webhookPath}`;
  return c;
}

export async function updatePlatformIntegrationConfig(
  code: string,
  patch: {
    enabled?: boolean;
    credentials?: Record<string, string>;
    notes?: string;
  },
): Promise<IntegrationConfigPublic> {
  const entry = INTEGRATIONS_CATALOG.find((i) => i.code === code);
  if (!entry) throw new Error("Unknown integration");

  const raw = await loadRawConfigs();
  const existing = raw[code] ?? { enabled: false, credentials: {} };
  const schema = getIntegrationSchema(entry);

  const nextCreds = { ...existing.credentials };
  if (patch.credentials) {
    for (const [k, v] of Object.entries(patch.credentials)) {
      if (v === "" || v === "••••••••") continue;
      nextCreds[k] = v;
    }
  }

  const next: IntegrationConfigStored = {
    enabled: patch.enabled ?? existing.enabled,
    credentials: nextCreds,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    updatedAt: new Date().toISOString(),
  };

  if (!isConfigured(schema, next.credentials) && next.enabled) {
    throw new Error("Add required credentials before enabling this integration");
  }

  raw[code] = next;
  await saveRawConfigs(raw);

  const result = await getPlatformIntegrationConfig(code);
  if (!result) throw new Error("Failed to save integration");
  return result;
}

export async function loadRawIntegrationCredentials(code: string): Promise<Record<string, string>> {
  const raw = await loadRawConfigs();
  return raw[code]?.credentials ?? {};
}

export async function testPlatformIntegrationConnection(code: string): Promise<{ ok: boolean; message: string }> {
  const { testIntegrationConnector } = await import("./integration-connectors");
  const raw = await loadRawConfigs();
  const stored = raw[code];
  if (!stored?.enabled) {
    return { ok: false, message: "Enable the integration before testing" };
  }
  return testIntegrationConnector(code);
}

export function listIntegrationFieldDefs(code: string): IntegrationFieldDef[] {
  const entry = INTEGRATIONS_CATALOG.find((i) => i.code === code);
  if (!entry) return [];
  return getIntegrationSchema(entry).fields;
}
