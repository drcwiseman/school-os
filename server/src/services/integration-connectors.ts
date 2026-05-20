import nodemailer from "nodemailer";
import { getPlatformSmtpConfig } from "./platform-smtp-config";
import { loadRawIntegrationCredentials } from "./platform-integrations-settings";

async function rawCredentials(code: string): Promise<Record<string, string>> {
  return loadRawIntegrationCredentials(code);
}

export async function testIntegrationConnector(code: string): Promise<{ ok: boolean; message: string }> {
  const entry = (await import("../lib/integrations-catalog")).INTEGRATIONS_CATALOG.find((i) => i.code === code);
  if (!entry) return { ok: false, message: "Unknown integration" };

  const credsCheck = await loadRawIntegrationCredentials(code);
  if (!Object.values(credsCheck).some((v) => v?.trim())) {
    return { ok: false, message: "Save credentials first" };
  }

  switch (code) {
    case "google_workspace":
    case "microsoft_365":
    case "quickbooks":
    case "xero":
    case "zoom":
    case "pesapal":
    case "airtel_money":
    case "uneb_api":
    case "google_analytics":
    case "plausible":
    case "zapier":
      return {
        ok: true,
        message: `${entry.name}: credentials stored. OAuth/connect flow will complete authorization when the school uses this module.`,
      };

    case "whatsapp_business": {
      const creds = await rawCredentials(code);
      const token = creds.accessToken;
      const phoneId = creds.phoneNumberId;
      if (!token || !phoneId) return { ok: false, message: "Missing access token or phone number ID" };
      const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, message: `Meta API error: ${res.status} ${await res.text().catch(() => "")}` };
      return { ok: true, message: "WhatsApp Business API credentials verified" };
    }

    case "mtn_momo": {
      const creds = await rawCredentials(code);
      if (!creds.apiUser || !creds.apiKey || !creds.subscriptionKey) {
        return { ok: false, message: "Missing API user, key, or subscription key" };
      }
      const env = (creds.environment ?? "sandbox").toLowerCase();
      const base = env.includes("prod")
        ? "https://proxy.momoapi.mtn.com"
        : "https://sandbox.momodeveloper.mtn.com";
      const res = await fetch(`${base}/collection/token/`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
          Authorization: `Basic ${Buffer.from(`${creds.apiUser}:${creds.apiKey}`).toString("base64")}`,
        },
      });
      if (!res.ok) return { ok: false, message: `MTN MoMo token failed: ${res.status}` };
      return { ok: true, message: "MTN MoMo API credentials verified (token issued)" };
    }

    case "flutterwave": {
      const creds = await rawCredentials(code);
      if (!creds.secretKey) return { ok: false, message: "Missing secret key" };
      const res = await fetch("https://api.flutterwave.com/v3/transactions?from=2020-01-01", {
        headers: { Authorization: `Bearer ${creds.secretKey}` },
      });
      if (!res.ok) return { ok: false, message: `Flutterwave API error: ${res.status}` };
      return { ok: true, message: "Flutterwave secret key verified" };
    }

    case "slack": {
      const creds = await rawCredentials(code);
      if (!creds.botToken) return { ok: false, message: "Missing bot token" };
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.botToken}`, "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) return { ok: false, message: data.error ?? "Slack auth.test failed" };
      return { ok: true, message: "Slack bot token verified" };
    }

    default:
      return { ok: true, message: `${entry.name}: configuration saved` };
  }
}

export async function testPlatformSmtpIntegration(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getPlatformSmtpConfig();
  if (!cfg) return { ok: false, message: "Platform SMTP not configured — use Email settings" };
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password ?? "" } : undefined,
  });
  await transport.verify();
  return { ok: true, message: "SMTP connection verified" };
}
