import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";

const SMTP_SETTINGS_KEY = "smtp";

export type PlatformSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromEmail: string;
  fromName: string;
};

function envSmtp(): PlatformSmtpConfig | null {
  const host = process.env.PLATFORM_SMTP_HOST?.trim();
  const fromEmail = process.env.PLATFORM_SMTP_FROM?.trim() || process.env.PLATFORM_SMTP_USER?.trim();
  if (!host || !fromEmail) return null;
  const port = Number(process.env.PLATFORM_SMTP_PORT ?? 587);
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.PLATFORM_SMTP_SECURE === "true" || port === 465,
    user: process.env.PLATFORM_SMTP_USER?.trim() || undefined,
    password: process.env.PLATFORM_SMTP_PASS?.trim() || undefined,
    fromEmail,
    fromName: process.env.PLATFORM_SMTP_FROM_NAME?.trim() || "SchoolOS Platform",
  };
}

export async function getPlatformSmtpConfig(): Promise<PlatformSmtpConfig | null> {
  const fromEnv = envSmtp();
  if (fromEnv) return fromEnv;

  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SMTP_SETTINGS_KEY)).limit(1);
  const v = (row?.value ?? {}) as {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    fromEmail?: string;
    fromName?: string;
    enabled?: boolean;
  };
  if (v.enabled === false || !v.host || !v.fromEmail) return null;

  return {
    host: v.host,
    port: v.port ?? 587,
    secure: v.secure ?? v.port === 465,
    user: v.user,
    password: v.password,
    fromEmail: v.fromEmail,
    fromName: v.fromName ?? "SchoolOS Platform",
  };
}

export async function isPlatformEmailConfigured(): Promise<boolean> {
  return (await getPlatformSmtpConfig()) != null;
}
