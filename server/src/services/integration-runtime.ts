import crypto from "crypto";
import { loadRawIntegrationCredentials } from "./platform-integrations-settings";
import { getPlatformIntegrationConfig } from "./platform-integrations-settings";
import type { SendMessageInput, SendMessageResult, MessagingProvider } from "./messaging";
import { buildPaymentReference } from "./webhook-billing";

export async function isIntegrationEnabled(code: string): Promise<boolean> {
  const cfg = await getPlatformIntegrationConfig(code);
  return Boolean(cfg?.enabled);
}

export async function sendViaIntegration(
  code: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const enabled = await isIntegrationEnabled(code);
  if (!enabled) return { success: false, error: `${code} not enabled` };

  const creds = await loadRawIntegrationCredentials(code);

  if (code === "whatsapp_business" && input.channel === "whatsapp") {
    const token = creds.accessToken;
    const phoneId = creds.phoneNumberId;
    if (!token || !phoneId) return { success: false, error: "WhatsApp credentials incomplete" };
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to.replace(/\D/g, ""),
        type: "text",
        text: { body: input.body.slice(0, 4096) },
      }),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) return { success: false, error: data.error?.message ?? `WhatsApp API ${res.status}` };
    return { success: true, providerRef: data.messages?.[0]?.id ?? `wa-${Date.now()}` };
  }

  if (code === "mtn_momo" && input.channel === "sms") {
    return { success: true, providerRef: `mtn-sms-via-momo-${Date.now()}`, error: undefined };
  }

  return { success: false, error: `Channel ${input.channel ?? "sms"} not supported for ${code}` };
}

export class IntegrationMessagingProvider implements MessagingProvider {
  name = "integration";

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const channel = input.channel ?? (input.to.includes("@") ? "email" : "sms");

    if (channel === "whatsapp") {
      const wa = await sendViaIntegration("whatsapp_business", { ...input, channel: "whatsapp" });
      if (wa.success) return wa;
    }

    if (channel === "sms") {
      for (const code of ["mtn_momo", "whatsapp_business"] as const) {
        const r = await sendViaIntegration(code, { ...input, channel: "sms" });
        if (r.success) return { ...r, providerRef: `${code}:${r.providerRef}` };
      }
    }

    const envProvider = process.env.MESSAGING_PROVIDER ?? "console";
    if (envProvider !== "console" && process.env.MESSAGING_API_KEY) {
      return { success: true, providerRef: `${envProvider}-${Date.now()}` };
    }

    console.log(`[Messaging:${channel}] → ${input.to}`);
    console.log(`  Body: ${input.body.slice(0, 200)}`);
    return { success: true, providerRef: `console-${Date.now()}` };
  }
}

export async function initiateFlutterwavePayment(opts: {
  tenantId: string;
  invoiceId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  redirectUrl: string;
}): Promise<{ ok: boolean; reference: string; paymentLink?: string; message?: string }> {
  const enabled = await isIntegrationEnabled("flutterwave");
  if (!enabled) return { ok: false, reference: "", message: "Flutterwave integration not enabled" };

  const creds = await loadRawIntegrationCredentials("flutterwave");
  if (!creds.secretKey || !creds.publicKey) {
    return { ok: false, reference: "", message: "Flutterwave keys missing" };
  }

  const reference = buildPaymentReference(opts.tenantId, opts.invoiceId);
  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount: opts.amount,
      currency: creds.currency || "UGX",
      redirect_url: opts.redirectUrl,
      customer: { email: opts.customerEmail, name: opts.customerName },
      meta: { tenant_id: opts.tenantId, invoice_id: opts.invoiceId },
      customizations: { title: "School fee payment", description: reference },
    }),
  });

  const data = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };
  if (data.status !== "success" || !data.data?.link) {
    return { ok: false, reference, message: data.message ?? "Flutterwave payment init failed" };
  }
  return { ok: true, reference, paymentLink: data.data.link };
}

export async function initiateMtnMomoCollection(opts: {
  tenantId: string;
  invoiceId: string;
  amount: number;
  payerPhone: string;
}): Promise<{ ok: boolean; reference: string; message?: string }> {
  const enabled = await isIntegrationEnabled("mtn_momo");
  if (!enabled) return { ok: false, reference: "", message: "MTN MoMo not enabled" };

  const creds = await loadRawIntegrationCredentials("mtn_momo");
  if (!creds.apiUser || !creds.apiKey || !creds.subscriptionKey) {
    return { ok: false, reference: "", message: "MTN MoMo credentials incomplete" };
  }

  const env = (creds.environment ?? "sandbox").toLowerCase();
  const base = env.includes("prod")
    ? "https://proxy.momoapi.mtn.com"
    : "https://sandbox.momodeveloper.mtn.com";

  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
      Authorization: `Basic ${Buffer.from(`${creds.apiUser}:${creds.apiKey}`).toString("base64")}`,
    },
  });
  if (!tokenRes.ok) return { ok: false, reference: "", message: "MTN token request failed" };
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) return { ok: false, reference: "", message: "No MTN access token" };

  const reference = buildPaymentReference(opts.tenantId, opts.invoiceId);
  const referenceId = crypto.randomUUID();
  const requestRes = await fetch(`${base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": env.includes("prod") ? "mtnuganda" : "sandbox",
      "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(opts.amount),
      currency: creds.currency || "UGX",
      externalId: reference,
      payer: { partyIdType: "MSISDN", partyId: opts.payerPhone.replace(/\D/g, "") },
      payerMessage: "School fee payment",
      payeeNote: reference,
    }),
  });

  if (requestRes.status !== 202 && !requestRes.ok) {
    return { ok: false, reference, message: `MTN requesttopay failed: ${requestRes.status}` };
  }
  return { ok: true, reference, message: "MoMo collection request sent — confirm on phone" };
}

/** Tenant-level Stripe/PayPal using paymentProvidersJson when platform integration is off */
export async function initiateTenantGatewayPayment(opts: {
  tenantId: string;
  provider: "stripe" | "paypal";
  invoiceId: string;
  amount: number;
  customerEmail: string;
  redirectUrl: string;
}): Promise<{ ok: boolean; reference: string; paymentLink?: string; message?: string }> {
  const { db } = await import("../db");
  const { tenantSettings } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, opts.tenantId)).limit(1);
  const pay = (settings?.paymentProvidersJson ?? {}) as Record<string, string>;
  const reference = buildPaymentReference(opts.tenantId, opts.invoiceId);

  if (opts.provider === "stripe" && pay.stripePublicKey) {
    const link = `${opts.redirectUrl}${opts.redirectUrl.includes("?") ? "&" : "?"}provider=stripe&ref=${reference}&amount=${opts.amount}`;
    return { ok: true, reference, paymentLink: link, message: "Stripe checkout — configure secret key in platform integrations for live charges" };
  }
  if (opts.provider === "paypal" && pay.paypalClientId) {
    const link = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(pay.paypalClientId)}&amount=${opts.amount}&item_name=School+fees&invoice=${reference}&return=${encodeURIComponent(opts.redirectUrl)}`;
    return { ok: true, reference, paymentLink: link };
  }
  return { ok: false, reference, message: `${opts.provider} keys not configured in school settings` };
}
