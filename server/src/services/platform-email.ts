import nodemailer from "nodemailer";
import { getPlatformMarketing } from "./platform-settings";
import { logPlatformEmailSend } from "./platform-email-log";
import { renderPlatformEmailTemplate } from "./platform-email-settings";
import { getPlatformSmtpConfig } from "./platform-smtp-config";
import type { PlatformRole } from "./platform-admins";

export type { PlatformSmtpConfig } from "./platform-smtp-config";
export { getPlatformSmtpConfig, isPlatformEmailConfigured } from "./platform-smtp-config";

const ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  support: "Support",
  billing: "Billing",
};

function buildTransport(cfg: import("./platform-smtp-config").PlatformSmtpConfig) {
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
  templateCode?: string;
  skipLog?: boolean;
}) {
  const cfg = await getPlatformSmtpConfig();
  if (!cfg) {
    const err = new Error(
      "Platform SMTP is not configured. Set PLATFORM_SMTP_* environment variables or configure SMTP in Platform → Email settings.",
    );
    if (!input.skipLog) {
      await logPlatformEmailSend({
        templateCode: input.templateCode,
        recipient: input.to,
        subject: input.subject,
        status: "failed",
        error: err.message,
      });
    }
    throw err;
  }

  try {
    const transport = buildTransport(cfg);
    await transport.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (!input.skipLog) {
      await logPlatformEmailSend({
        templateCode: input.templateCode,
        recipient: input.to,
        subject: input.subject,
        status: "sent",
      });
    }
  } catch (err) {
    if (!input.skipLog) {
      await logPlatformEmailSend({
        templateCode: input.templateCode,
        recipient: input.to,
        subject: input.subject,
        status: "failed",
        error: (err as Error).message,
      });
    }
    throw err;
  }
}

async function platformLoginUrl(): Promise<string> {
  const { platformLoginPath } = await import("../lib/app-origin");
  return platformLoginPath();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function legacyInviteHtml(marketing: { siteName: string }, opts: {
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  loginUrl: string;
}) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
      <h2 style="color:#2563eb;margin:0 0 12px">Welcome to ${escapeHtml(marketing.siteName)}</h2>
      <p>Hello <strong>${escapeHtml(opts.name)}</strong>,</p>
      <p>Your platform operator account is ready.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Login</td><td style="padding:8px 0"><a href="${escapeHtml(opts.loginUrl)}">${escapeHtml(opts.loginUrl)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Password</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.password)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Role</td><td style="padding:8px 0">${escapeHtml(opts.roleLabel)}</td></tr>
      </table>
      <p style="font-size:13px;color:#64748b">Change your password after first sign-in if this was a temporary password.</p>
    </div>
  `;
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
  const vars = {
    siteName: marketing.siteName,
    name: opts.name,
    loginUrl,
    email: opts.email,
    password: opts.password,
    roleLabel,
  };

  const rendered = await renderPlatformEmailTemplate("admin_invite", vars);
  if (rendered) {
    await sendPlatformEmail({
      to: opts.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      templateCode: "admin_invite",
    });
    return;
  }

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
    `— ${marketing.siteName} Platform`,
  ].join("\n");

  await sendPlatformEmail({
    to: opts.to,
    subject,
    text,
    html: legacyInviteHtml(marketing, { ...opts, roleLabel, loginUrl }),
    templateCode: "admin_invite",
  });
}

export async function sendPlatformAdminPasswordResetEmail(opts: {
  to: string;
  name: string;
  email: string;
  newPassword: string;
}) {
  const marketing = await getPlatformMarketing();
  const loginUrl = await platformLoginUrl();
  const vars = {
    siteName: marketing.siteName,
    name: opts.name,
    loginUrl,
    email: opts.email,
    newPassword: opts.newPassword,
  };

  const rendered = await renderPlatformEmailTemplate("password_reset", vars);
  if (rendered) {
    await sendPlatformEmail({
      to: opts.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      templateCode: "password_reset",
    });
    return;
  }

  const subject = `${marketing.siteName} — password reset`;
  const text = [
    `Hello ${opts.name},`,
    ``,
    `Your platform password was reset.`,
    ``,
    `Login URL: ${loginUrl}`,
    `Email: ${opts.email}`,
    `New password: ${opts.newPassword}`,
    ``,
    `— ${marketing.siteName} Platform`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a">
      <h2 style="color:#2563eb;margin:0 0 12px">Password reset</h2>
      <p>Hello <strong>${escapeHtml(opts.name)}</strong>,</p>
      <p>Your platform password was reset.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Login</td><td style="padding:8px 0"><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">New password</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(opts.newPassword)}</td></tr>
      </table>
    </div>
  `;

  await sendPlatformEmail({
    to: opts.to,
    subject,
    text,
    html,
    templateCode: "password_reset",
  });
}
