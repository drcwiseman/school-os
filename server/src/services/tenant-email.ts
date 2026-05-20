import nodemailer from "nodemailer";
import type { TenantSmtpSettings } from "../db/schema";
import { ForbiddenError } from "../middleware/error";
import { isFeatureAllowedForTenant } from "./plan-features";

export type SmtpSettingsPublic = Omit<TenantSmtpSettings, "password"> & {
  passwordConfigured?: boolean;
};

export function maskSmtpForApi(raw: TenantSmtpSettings | null | undefined): SmtpSettingsPublic {
  const s = raw ?? {};
  const { password, ...rest } = s;
  return {
    ...rest,
    passwordConfigured: Boolean(password?.length),
  };
}

export async function assertCustomSmtpAllowed(tenantId: string) {
  const ok = await isFeatureAllowedForTenant(tenantId, "custom_smtp");
  if (!ok) throw new ForbiddenError("Custom SMTP is not included in your subscription plan");
}

export function buildSmtpTransport(settings: TenantSmtpSettings) {
  if (!settings.host || !settings.port) {
    throw new Error("SMTP host and port are required");
  }
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure ?? settings.port === 465,
    auth: settings.user
      ? { user: settings.user, pass: settings.password ?? "" }
      : undefined,
  });
}

export async function sendTenantEmail(
  tenantId: string,
  settings: TenantSmtpSettings,
  input: { to: string; subject: string; text: string; html?: string },
) {
  await assertCustomSmtpAllowed(tenantId);
  if (!settings.enabled) throw new Error("SMTP is disabled in settings");
  const from = settings.fromEmail || settings.user;
  if (!from) throw new Error("From email is required");

  const transport = buildSmtpTransport(settings);
  await transport.sendMail({
    from: settings.fromName ? `"${settings.fromName}" <${from}>` : from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text,
  });
}

export async function verifyTenantSmtp(settings: TenantSmtpSettings) {
  const transport = buildSmtpTransport(settings);
  await transport.verify();
}
