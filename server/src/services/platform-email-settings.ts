import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformEmailTemplates, platformSettings } from "../db/schema";
import { getPlatformSmtpConfig, type PlatformSmtpConfig } from "./platform-smtp-config";
import { emailLogStats, listPlatformEmailLogs, logPlatformEmailSend } from "./platform-email-log";
import { getPlatformMarketing } from "./platform-settings";

const SMTP_SETTINGS_KEY = "smtp";

export type PlatformSmtpPublic = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  passwordConfigured: boolean;
  source: "env" | "database" | "none";
};

export type PlatformEmailTemplateRow = {
  code: string;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: string[];
  enabled: boolean;
  updatedAt: string;
};

export type { PlatformEmailLogRow } from "./platform-email-log";

export type PlatformEmailHub = {
  smtp: PlatformSmtpPublic | null;
  configured: boolean;
  summary: {
    sent24h: number;
    failed24h: number;
    totalSent: number;
    totalFailed: number;
    templatesEnabled: number;
    templatesTotal: number;
  };
  templates: PlatformEmailTemplateRow[];
  recentLogs: import("./platform-email-log").PlatformEmailLogRow[];
};

const DEFAULT_TEMPLATES: Omit<PlatformEmailTemplateRow, "updatedAt">[] = [
  {
    code: "admin_invite",
    name: "Platform admin invite",
    description: "Sent when a new platform operator account is created.",
    category: "transactional",
    subject: "Your {{siteName}} platform account",
    bodyHtml: `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
  <h2 style="color:#2563eb;margin:0 0 12px">Welcome to {{siteName}}</h2>
  <p>Hello <strong>{{name}}</strong>,</p>
  <p>Your platform operator account is ready.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
    <tr><td style="padding:8px 0;color:#64748b">Login</td><td style="padding:8px 0"><a href="{{loginUrl}}">{{loginUrl}}</a></td></tr>
    <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;font-family:monospace">{{email}}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b">Password</td><td style="padding:8px 0;font-family:monospace">{{password}}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b">Role</td><td style="padding:8px 0">{{roleLabel}}</td></tr>
  </table>
  <p style="font-size:13px;color:#64748b">Change your password after first sign-in if this was a temporary password.</p>
</div>`,
    bodyText: `Hello {{name}},\n\nA platform operator account has been created for you on {{siteName}}.\n\nLogin URL: {{loginUrl}}\nEmail: {{email}}\nPassword: {{password}}\nRole: {{roleLabel}}\n\n— {{siteName}} Platform`,
    variables: ["siteName", "name", "loginUrl", "email", "password", "roleLabel"],
    enabled: true,
  },
  {
    code: "password_reset",
    name: "Platform password reset",
    description: "Sent when an administrator resets a platform user password.",
    category: "transactional",
    subject: "{{siteName}} — password reset",
    bodyHtml: `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
  <h2 style="color:#2563eb;margin:0 0 12px">Password reset</h2>
  <p>Hello <strong>{{name}}</strong>,</p>
  <p>Your platform password was reset. Previous sessions are no longer valid.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
    <tr><td style="padding:8px 0;color:#64748b">Login</td><td style="padding:8px 0"><a href="{{loginUrl}}">{{loginUrl}}</a></td></tr>
    <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;font-family:monospace">{{email}}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b">New password</td><td style="padding:8px 0;font-family:monospace">{{newPassword}}</td></tr>
  </table>
</div>`,
    bodyText: `Hello {{name}},\n\nYour platform password was reset.\n\nLogin URL: {{loginUrl}}\nEmail: {{email}}\nNew password: {{newPassword}}\n\n— {{siteName}} Platform`,
    variables: ["siteName", "name", "loginUrl", "email", "newPassword"],
    enabled: true,
  },
  {
    code: "smtp_test",
    name: "SMTP connection test",
    description: "Sent from Email settings when you verify SMTP delivery.",
    category: "system",
    subject: "{{siteName}} — SMTP test",
    bodyHtml: `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
  <h2 style="color:#2563eb;margin:0 0 12px">SMTP test successful</h2>
  <p>This message confirms that <strong>{{siteName}}</strong> platform email is configured correctly.</p>
  <p style="font-size:13px;color:#64748b">Sent at {{sentAt}} from the platform console.</p>
</div>`,
    bodyText: `SMTP test successful for {{siteName}}.\nSent at {{sentAt}}.`,
    variables: ["siteName", "sentAt"],
    enabled: true,
  },
];

function envSmtpPublic(): PlatformSmtpPublic | null {
  const host = process.env.PLATFORM_SMTP_HOST?.trim();
  const fromEmail = process.env.PLATFORM_SMTP_FROM?.trim() || process.env.PLATFORM_SMTP_USER?.trim();
  if (!host || !fromEmail) return null;
  const port = Number(process.env.PLATFORM_SMTP_PORT ?? 587);
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.PLATFORM_SMTP_SECURE === "true" || port === 465,
    user: process.env.PLATFORM_SMTP_USER?.trim() || "",
    fromEmail,
    fromName: process.env.PLATFORM_SMTP_FROM_NAME?.trim() || "SchoolOS Platform",
    enabled: true,
    passwordConfigured: Boolean(process.env.PLATFORM_SMTP_PASS?.trim()),
    source: "env",
  };
}

export async function getPlatformSmtpPublic(): Promise<PlatformSmtpPublic | null> {
  const fromEnv = envSmtpPublic();
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
  if (!v.host || !v.fromEmail) {
    return {
      host: "",
      port: 587,
      secure: false,
      user: "",
      fromEmail: "",
      fromName: "SchoolOS Platform",
      enabled: false,
      passwordConfigured: false,
      source: "none",
    };
  }

  return {
    host: v.host,
    port: v.port ?? 587,
    secure: v.secure ?? v.port === 465,
    user: v.user ?? "",
    fromEmail: v.fromEmail,
    fromName: v.fromName ?? "SchoolOS Platform",
    enabled: v.enabled !== false,
    passwordConfigured: Boolean(v.password),
    source: "database",
  };
}

export async function setPlatformSmtp(patch: {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
}): Promise<PlatformSmtpPublic> {
  if (envSmtpPublic()) {
    throw new Error("SMTP is locked by server environment variables (PLATFORM_SMTP_*). Remove env overrides to edit in the console.");
  }

  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SMTP_SETTINGS_KEY)).limit(1);
  const existing = (row?.value ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...existing, ...patch };
  if (patch.password === "") delete next.password;
  else if (patch.password === undefined && existing.password) next.password = existing.password;

  await db
    .insert(platformSettings)
    .values({ key: SMTP_SETTINGS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedAt: new Date() },
    });

  return (await getPlatformSmtpPublic())!;
}

function rowToTemplate(r: typeof platformEmailTemplates.$inferSelect): PlatformEmailTemplateRow {
  return {
    code: r.code,
    name: r.name,
    description: r.description,
    category: r.category,
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText,
    variables: (r.variablesJson as string[]) ?? [],
    enabled: r.enabled,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function ensureDefaultEmailTemplates(): Promise<void> {
  for (const t of DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select()
      .from(platformEmailTemplates)
      .where(eq(platformEmailTemplates.code, t.code))
      .limit(1);
    if (existing) continue;
    await db.insert(platformEmailTemplates).values({
      code: t.code,
      name: t.name,
      description: t.description,
      category: t.category,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText,
      variablesJson: t.variables,
      enabled: t.enabled,
    });
  }
}

export async function listPlatformEmailTemplates(): Promise<PlatformEmailTemplateRow[]> {
  await ensureDefaultEmailTemplates();
  const rows = await db.select().from(platformEmailTemplates).orderBy(platformEmailTemplates.category, platformEmailTemplates.name);
  return rows.map(rowToTemplate);
}

export async function getPlatformEmailTemplate(code: string): Promise<PlatformEmailTemplateRow | null> {
  await ensureDefaultEmailTemplates();
  const [row] = await db.select().from(platformEmailTemplates).where(eq(platformEmailTemplates.code, code)).limit(1);
  return row ? rowToTemplate(row) : null;
}

export async function updatePlatformEmailTemplate(
  code: string,
  patch: Partial<Pick<PlatformEmailTemplateRow, "subject" | "bodyHtml" | "bodyText" | "enabled" | "name" | "description">>,
): Promise<PlatformEmailTemplateRow> {
  const existing = await getPlatformEmailTemplate(code);
  if (!existing) throw new Error("Template not found");
  if (code === "smtp_test" && patch.enabled === false) {
    throw new Error("The SMTP test template cannot be disabled");
  }

  const [row] = await db
    .update(platformEmailTemplates)
    .set({
      ...(patch.subject != null ? { subject: patch.subject } : {}),
      ...(patch.bodyHtml != null ? { bodyHtml: patch.bodyHtml } : {}),
      ...(patch.bodyText !== undefined ? { bodyText: patch.bodyText } : {}),
      ...(patch.enabled != null ? { enabled: patch.enabled } : {}),
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(platformEmailTemplates.code, code))
    .returning();

  return rowToTemplate(row!);
}

export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export async function renderPlatformEmailTemplate(
  code: string,
  vars: Record<string, string>,
): Promise<{ subject: string; text: string; html: string } | null> {
  const tpl = await getPlatformEmailTemplate(code);
  if (!tpl || !tpl.enabled) return null;
  const subject = applyTemplateVars(tpl.subject, vars);
  const html = applyTemplateVars(tpl.bodyHtml, vars);
  const text = tpl.bodyText
    ? applyTemplateVars(tpl.bodyText, vars)
    : html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { subject, text, html };
}

export async function getPlatformEmailHub(): Promise<PlatformEmailHub> {
  const smtp = await getPlatformSmtpPublic();
  const templates = await listPlatformEmailTemplates();
  const stats = await emailLogStats();
  const cfg = await getPlatformSmtpConfig();
  const recentLogs = await listPlatformEmailLogs({ limit: 15 });

  return {
    smtp,
    configured: cfg != null && (smtp?.enabled !== false),
    summary: {
      ...stats,
      templatesEnabled: templates.filter((t) => t.enabled).length,
      templatesTotal: templates.length,
    },
    templates,
    recentLogs,
  };
}

export async function previewPlatformEmailTemplate(
  code: string,
  vars?: Record<string, string>,
): Promise<{ subject: string; text: string; html: string; variables: string[] }> {
  const marketing = await getPlatformMarketing();
  const { resolveClientOrigin } = await import("../lib/app-origin");
  const base = await resolveClientOrigin();
  const sample: Record<string, string> = {
    siteName: marketing.siteName,
    name: "Alex Operator",
    loginUrl: `${base}/platform/login`,
    email: "operator@example.com",
    password: "TempPass-42",
    newPassword: "NewPass-99",
    roleLabel: "Support",
    sentAt: new Date().toLocaleString(),
    ...vars,
  };
  const rendered = await renderPlatformEmailTemplate(code, sample);
  const tpl = await getPlatformEmailTemplate(code);
  if (!rendered || !tpl) throw new Error("Template not found or disabled");
  return { ...rendered, variables: tpl.variables };
}

export async function sendPlatformEmailWithTemplate(opts: {
  to: string;
  templateCode: string;
  vars: Record<string, string>;
}) {
  const rendered = await renderPlatformEmailTemplate(opts.templateCode, opts.vars);
  if (!rendered) throw new Error("Template not found or disabled");
  const { sendPlatformEmail } = await import("./platform-email");
  await sendPlatformEmail({
    to: opts.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    templateCode: opts.templateCode,
  });
}

export async function sendPlatformSmtpTest(to: string, smtpOverride?: Partial<PlatformSmtpConfig>) {
  const marketing = await getPlatformMarketing();
  const vars = {
    siteName: marketing.siteName,
    sentAt: new Date().toLocaleString(),
  };

  if (smtpOverride) {
    const rendered = await renderPlatformEmailTemplate("smtp_test", vars);
    if (!rendered) throw new Error("SMTP test template unavailable");
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtpOverride.host,
      port: smtpOverride.port,
      secure: smtpOverride.secure,
      auth: smtpOverride.user ? { user: smtpOverride.user, pass: smtpOverride.password ?? "" } : undefined,
    });
    try {
      await transport.sendMail({
        from: `"${smtpOverride.fromName}" <${smtpOverride.fromEmail}>`,
        to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      await logPlatformEmailSend({ templateCode: "smtp_test", recipient: to, subject: rendered.subject, status: "sent" });
    } catch (err) {
      await logPlatformEmailSend({
        templateCode: "smtp_test",
        recipient: to,
        subject: rendered.subject,
        status: "failed",
        error: (err as Error).message,
      });
      throw err;
    }
    return { success: true };
  }

  await sendPlatformEmailWithTemplate({ to, templateCode: "smtp_test", vars });
  return { success: true };
}

export async function verifyPlatformSmtpConnection(smtpOverride?: PlatformSmtpConfig) {
  const nodemailer = await import("nodemailer");
  const cfg = smtpOverride ?? (await getPlatformSmtpConfig());
  if (!cfg) throw new Error("SMTP is not configured");
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password ?? "" } : undefined,
  });
  await transport.verify();
  return { success: true };
}
