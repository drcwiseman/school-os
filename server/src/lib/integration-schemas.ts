import type { IntegrationEntry } from "./integrations-catalog";

export type IntegrationFieldType = "text" | "password" | "url" | "email";

export type IntegrationFieldDef = {
  key: string;
  label: string;
  type?: IntegrationFieldType;
  placeholder?: string;
  required?: boolean;
};

export type IntegrationSchema = {
  fields: IntegrationFieldDef[];
  webhookPath?: string;
  docsHint?: string;
};

const DEFAULT_SCHEMA: IntegrationSchema = {
  fields: [
    { key: "apiKey", label: "API key", type: "password", required: true },
    { key: "apiSecret", label: "API secret", type: "password" },
    { key: "webhookSecret", label: "Webhook signing secret", type: "password" },
  ],
  docsHint: "Enter credentials from your provider dashboard.",
};

export const INTEGRATION_SCHEMAS: Record<string, IntegrationSchema> = {
  google_workspace: {
    fields: [
      { key: "clientId", label: "OAuth client ID", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
      { key: "redirectUri", label: "Redirect URI", type: "url" },
    ],
    docsHint: "Google Cloud Console → APIs & Services → Credentials.",
  },
  microsoft_365: {
    fields: [
      { key: "tenantId", label: "Azure tenant ID", required: true },
      { key: "clientId", label: "Application (client) ID", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
    ],
    docsHint: "Azure Portal → App registrations.",
  },
  whatsapp_business: {
    fields: [
      { key: "phoneNumberId", label: "Phone number ID", required: true },
      { key: "accessToken", label: "Permanent access token", type: "password", required: true },
      { key: "businessAccountId", label: "WhatsApp Business account ID" },
    ],
    webhookPath: "/whatsapp",
    docsHint: "Meta Business Suite → WhatsApp → API setup.",
  },
  mtn_momo: {
    fields: [
      { key: "apiUser", label: "API user", required: true },
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "subscriptionKey", label: "Subscription key", type: "password", required: true },
      { key: "environment", label: "Environment (sandbox/production)" },
    ],
    webhookPath: "/mtn-momo",
  },
  airtel_money: {
    fields: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
      { key: "merchantId", label: "Merchant ID" },
    ],
    webhookPath: "/airtel-money",
  },
  flutterwave: {
    fields: [
      { key: "publicKey", label: "Public key", required: true },
      { key: "secretKey", label: "Secret key", type: "password", required: true },
      { key: "encryptionKey", label: "Encryption key", type: "password" },
    ],
    webhookPath: "/flutterwave",
  },
  pesapal: {
    fields: [
      { key: "consumerKey", label: "Consumer key", required: true },
      { key: "consumerSecret", label: "Consumer secret", type: "password", required: true },
    ],
    webhookPath: "/pesapal",
  },
  quickbooks: {
    fields: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
      { key: "realmId", label: "Realm ID (company)" },
    ],
  },
  xero: {
    fields: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
    ],
  },
  zapier: {
    fields: [
      { key: "outboundWebhookUrl", label: "Outbound webhook URL", type: "url" },
      { key: "signingSecret", label: "Signing secret", type: "password" },
    ],
    docsHint: "SchoolOS will POST events to your Zapier catch hook or custom endpoint.",
  },
  google_analytics: {
    fields: [
      { key: "measurementId", label: "Measurement ID (G-XXXX)", required: true },
      { key: "apiSecret", label: "Measurement Protocol API secret", type: "password" },
    ],
    docsHint: "Also configurable under Marketing & SEO for the public site.",
  },
  plausible: {
    fields: [{ key: "domain", label: "Plausible domain", required: true }],
    docsHint: "Also configurable under Marketing & SEO.",
  },
  zoom: {
    fields: [
      { key: "accountId", label: "Account ID" },
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
    ],
  },
  uneb_api: {
    fields: [
      { key: "centerCode", label: "Center / school code" },
      { key: "apiToken", label: "API token", type: "password" },
    ],
  },
  slack: {
    fields: [
      { key: "botToken", label: "Bot token (xoxb-…)", type: "password", required: true },
      { key: "defaultChannel", label: "Default channel ID" },
    ],
  },
};

export function getIntegrationSchema(entry: IntegrationEntry): IntegrationSchema {
  return INTEGRATION_SCHEMAS[entry.code] ?? DEFAULT_SCHEMA;
}
