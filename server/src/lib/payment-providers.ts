/** Tenant paymentProvidersJson shape (Settings + portal). */

export type TenantPaypalConfig = {
  enabled?: boolean;
  clientId?: string;
};

export type TenantPesapalConfig = {
  enabled?: boolean;
  consumerKey?: string;
  consumerSecret?: string;
  consumerSecretConfigured?: boolean;
};

export type TenantPaymentProvidersJson = {
  paypal?: TenantPaypalConfig;
  pesapal?: TenantPesapalConfig;
  /** @deprecated use paypal.clientId */
  paypalClientId?: string;
  /** @deprecated use pesapal */
  stripePublicKey?: string;
  pesapalConsumerKey?: string;
  pesapalConsumerSecret?: string;
};

export function normalizePaymentProviders(
  raw: Record<string, unknown> | null | undefined,
): TenantPaymentProvidersJson {
  const p = (raw ?? {}) as TenantPaymentProvidersJson;
  const paypalRaw = (p.paypal ?? {}) as TenantPaypalConfig;
  const pesapalRaw = (p.pesapal ?? {}) as TenantPesapalConfig;

  const paypalClientId = String(paypalRaw.clientId ?? p.paypalClientId ?? "").trim();
  const pesapalKey = String(pesapalRaw.consumerKey ?? p.pesapalConsumerKey ?? "").trim();
  const pesapalSecret = String(pesapalRaw.consumerSecret ?? p.pesapalConsumerSecret ?? "").trim();

  return {
    paypal: {
      enabled: paypalRaw.enabled ?? Boolean(paypalClientId),
      clientId: paypalClientId || undefined,
    },
    pesapal: {
      enabled: pesapalRaw.enabled ?? Boolean(pesapalKey),
      consumerKey: pesapalKey || undefined,
      consumerSecret: pesapalSecret || undefined,
    },
  };
}

export function maskPaymentProvidersForApi(
  raw: Record<string, unknown> | null | undefined,
): TenantPaymentProvidersJson {
  const n = normalizePaymentProviders(raw);
  const secret = n.pesapal?.consumerSecret;
  return {
    ...n,
    pesapal: n.pesapal
      ? {
          ...n.pesapal,
          consumerSecret: undefined,
          consumerSecretConfigured: Boolean(secret?.length),
        }
      : undefined,
  };
}

export function isPaypalReady(p: TenantPaymentProvidersJson): boolean {
  return Boolean(p.paypal?.enabled && p.paypal.clientId?.trim());
}

export function isPesapalReady(p: TenantPaymentProvidersJson): boolean {
  return Boolean(
    p.pesapal?.enabled
    && p.pesapal.consumerKey?.trim()
    && p.pesapal.consumerSecret?.trim(),
  );
}
