import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { getPlatformMarketing } from "./platform-settings";
import type { PlatformRole } from "./platform-admins";

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

const ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  support: "Support",
  billing: "Billing",
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

export function isPlatformEmailConfigured(): boolean {
  return envSmtp() != null;
}

function buildTransport(cfg: PlatformSmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password ?? "" } : undefined,
  });
}

export async function sendPlatformEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const cfg = await getPlatformSmtpConfig();
  if (!cfg) {
    throw new Error(
      "Platform SMTP is not configured. Set PLATFORM_SMTP_HOST, PLATFORM_SMTP_FROM (and PLATFORM_SMTP_USER/PASS) on the server.",
    );
  }

  const transport = buildTransport(cfg);
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

async function platformLoginUrl(): Promise<string> {
  const marketing = await getPlatformMarketing();
  const base = (process.env.CLIENT_ORIGIN || marketing.siteUrl || "https://school.bclimaxtech.com").replace(/\/$/, "");
  return `${base}/platform/login`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPlatformAdminInviteEmail(opts: {
  to: string;
  name: string;
  email: string;
  password: string;
  role: PlatformRole;
}) {
  const marketing = await getPlatformMarketing();
  const loginUrl = await platformLoginUrl();
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;

  const subject = `Your ${marketing.siteName} platform account`;
  const text = [
    `Hello ${opts.name},`,
    ``,
    `A platform operator account has been created for you on ${marketing.siteName}.`,
    ``,
    `Login URL: ${loginUrl}`,
    `Email: ${opts.email}`,
    `Password: ${opts.password}`,
    `Role: ${roleLabel}`,
    ``,
    `Sign in at the link above and change your password after your first login if your administrator shared a temporary password.`,
    ``,
    `— ${marketing.siteName} Platform`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
      <h2 style="color:#2563eb;margin:0 0 12px">Welcome to ${escapeHtml(marketing.siteName)}</h2>
      <p>Hello <strong>${escapeHtml(opts.name)}</strong>,</p>
      <p>Your platform operator account is ready.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Login</td><td style="padding:8px 0"><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Password</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.password)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Role</td><td style="padding:8px 0">${escapeHtml(roleLabel)}</td></tr>
      </table>
      <p style="font-size:13px;color:#64748b">Change your password after first sign-in if this was a temporary password.</p>
    </div>
  `;

  await sendPlatformEmail({ to: opts.to, subject, text, html });
}

export async function sendPlatformAdminPasswordResetEmail(opts: {
  to: string;
  name: string;
  email: string;
  newPassword: string;
}) {
  const marketing = await getPlatformMarketing();
  const loginUrl = await platformLoginUrl();

  const subject = `${marketing.siteName} — password reset`;
  const text = [
    `Hello ${opts.name},`,
    ``,
    `Your platform password was reset by an administrator.`,
    ``,
    `Login URL: ${loginUrl}`,
    `Email: ${opts.email}`,
    `New password: ${opts.newPassword}`,
    ``,
    `All active sessions were signed out. Sign in with the new password.`,
    ``,
    `— ${marketing.siteName} Platform`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
      <h2 style="color:#2563eb;margin:0 0 12px">Password reset</h2>
      <p>Hello <strong>${escapeHtml(opts.name)}</strong>,</p>
      <p>Your platform password was reset. Previous sessions are no longer valid.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Login</td><td style="padding:8px 0"><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">New password</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.newPassword)}</td></tr>
      </table>
    </div>
  `;

  await sendPlatformEmail({ to: opts.to, subject, text, html });
}
