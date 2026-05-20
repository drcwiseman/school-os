import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  invoices,
  paymentAllocations,
  payments,
  platformWebhookEvents,
  receipts,
} from "../db/schema";
import { nextReceiptNumber } from "../utils/receipts";
import { dispatchPlatformEvent } from "./platform-outbound-webhooks";

export type PaymentReference = {
  tenantId: string;
  invoiceId: string;
};

/** schoolos:{tenantId}:{invoiceId} or meta fields */
export function parsePaymentReference(raw: string | undefined | null): PaymentReference | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(/^schoolos:([0-9a-f-]{36}):([0-9a-f-]{36})$/i);
  if (m) return { tenantId: m[1], invoiceId: m[2] };
  return null;
}

export function buildPaymentReference(tenantId: string, invoiceId: string): string {
  return `schoolos:${tenantId}:${invoiceId}`;
}

async function recordWebhookEvent(opts: {
  provider: string;
  externalId: string;
  tenantId?: string;
  paymentId?: string;
  invoiceId?: string;
  payload: unknown;
  status: string;
}) {
  try {
    await db.insert(platformWebhookEvents).values({
      provider: opts.provider,
      externalId: opts.externalId,
      tenantId: opts.tenantId,
      paymentId: opts.paymentId,
      invoiceId: opts.invoiceId,
      status: opts.status,
      payload: opts.payload as object,
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return;
    throw err;
  }
}

export async function reconcileGatewayPayment(input: {
  provider: string;
  externalId: string;
  reference: PaymentReference;
  amount: number;
  method: string;
  currency?: string;
  rawPayload?: unknown;
}): Promise<{ ok: boolean; paymentId?: string; message: string }> {
  const { provider, externalId, reference, amount, method } = input;

  const [existingEvent] = await db
    .select()
    .from(platformWebhookEvents)
    .where(
      and(
        eq(platformWebhookEvents.provider, provider),
        eq(platformWebhookEvents.externalId, externalId),
      ),
    )
    .limit(1);
  if (existingEvent) {
    return { ok: true, paymentId: existingEvent.paymentId ?? undefined, message: "Already processed" };
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, reference.invoiceId),
        eq(invoices.tenantId, reference.tenantId),
        isNull(invoices.deletedAt),
      ),
    )
    .limit(1);
  if (!invoice) {
    await recordWebhookEvent({
      provider,
      externalId,
      tenantId: reference.tenantId,
      invoiceId: reference.invoiceId,
      payload: input.rawPayload,
      status: "invoice_not_found",
    });
    return { ok: false, message: "Invoice not found" };
  }

  const [dupPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, reference.tenantId),
        eq(payments.reference, externalId),
        isNull(payments.deletedAt),
      ),
    )
    .limit(1);
  if (dupPayment) {
    await recordWebhookEvent({
      provider,
      externalId,
      tenantId: reference.tenantId,
      paymentId: dupPayment.id,
      invoiceId: invoice.id,
      payload: input.rawPayload,
      status: "duplicate",
    });
    return { ok: true, paymentId: dupPayment.id, message: "Payment already recorded" };
  }

  let payAmount = amount > 0 ? Math.min(amount, invoice.totalAmount - invoice.paidAmount) : invoice.totalAmount - invoice.paidAmount;
  if (payAmount <= 0) {
    await recordWebhookEvent({
      provider,
      externalId,
      tenantId: reference.tenantId,
      invoiceId: invoice.id,
      payload: input.rawPayload,
      status: "no_balance",
    });
    return { ok: false, message: "Invoice already fully paid" };
  }

  const receiptNo = await nextReceiptNumber(reference.tenantId);
  const [payment] = await db
    .insert(payments)
    .values({
      tenantId: reference.tenantId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      amount: payAmount,
      method,
      reference: externalId,
      receiptNo,
    })
    .returning();

  await db.insert(paymentAllocations).values({
    tenantId: reference.tenantId,
    paymentId: payment.id,
    invoiceId: invoice.id,
    amount: payAmount,
  });
  await db.insert(receipts).values({
    tenantId: reference.tenantId,
    paymentId: payment.id,
    receiptNo,
    amount: payAmount,
  });

  const newPaid = invoice.paidAmount + payAmount;
  const status = newPaid >= invoice.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
  await db
    .update(invoices)
    .set({ paidAmount: newPaid, status, updatedAt: new Date() })
    .where(eq(invoices.id, invoice.id));

  await recordWebhookEvent({
    provider,
    externalId,
    tenantId: reference.tenantId,
    paymentId: payment.id,
    invoiceId: invoice.id,
    payload: input.rawPayload,
    status: "processed",
  });

  await dispatchPlatformEvent("payment.received", {
    tenantId: reference.tenantId,
    invoiceId: invoice.id,
    paymentId: payment.id,
    amount: payAmount,
    method,
    provider,
    externalId,
    currency: input.currency,
  });

  return { ok: true, paymentId: payment.id, message: "Payment recorded" };
}

export async function handleFlutterwaveWebhook(body: Record<string, unknown>) {
  const event = String(body.event ?? "");
  const data = (body.data ?? {}) as Record<string, unknown>;
  if (event !== "charge.completed" && data.status !== "successful") {
    return { ok: true, message: "Ignored event" };
  }

  const txRef = String(data.tx_ref ?? data.txRef ?? "");
  const meta = (data.meta ?? {}) as Record<string, unknown>;
  let ref =
    parsePaymentReference(txRef) ??
    (meta.tenant_id && meta.invoice_id
      ? { tenantId: String(meta.tenant_id), invoiceId: String(meta.invoice_id) }
      : null);

  if (!ref) return { ok: false, message: "Missing schoolos payment reference in tx_ref or meta" };

  const externalId = String(data.id ?? data.flw_ref ?? txRef);
  const amountMajor = Number(data.amount ?? data.charged_amount ?? 0);
  const amount = Math.round(amountMajor * 100);
  return reconcileGatewayPayment({
    provider: "flutterwave",
    externalId,
    reference: ref,
    amount,
    method: "flutterwave",
    currency: String(data.currency ?? ""),
    rawPayload: body,
  });
}

export async function handleMtnMomoWebhook(body: Record<string, unknown>) {
  const externalId = String(body.financialTransactionId ?? body.externalId ?? body.referenceId ?? "");
  const ref = parsePaymentReference(String(body.externalId ?? ""));
  if (!externalId || !ref) return { ok: false, message: "Missing reference" };
  const amount = Math.round(Number(body.amount ?? 0));
  if (String(body.status ?? "").toLowerCase() !== "successful") {
    return { ok: true, message: "Non-success status ignored" };
  }
  return reconcileGatewayPayment({
    provider: "mtn_momo",
    externalId,
    reference: ref,
    amount: amount || 0,
    method: "mtn_momo",
    rawPayload: body,
  });
}

export async function handlePesapalWebhook(body: Record<string, unknown>) {
  const notif = (body.OrderNotificationType ?? {}) as Record<string, unknown>;
  const orderTrackingId = String(notif.OrderTrackingId ?? body.order_tracking_id ?? "");
  const merchantRef = String(notif.OrderMerchantReference ?? body.order_merchant_reference ?? "");
  const ref = parsePaymentReference(merchantRef);
  if (!ref || !orderTrackingId) return { ok: false, message: "Missing Pesapal reference" };
  const status = String(notif.OrderNotificationStatus ?? body.status ?? "");
  if (status && !/completed|paid/i.test(status)) {
    return { ok: true, message: "Payment not completed" };
  }
  const amount = Math.round(Number(body.amount ?? 0));
  return reconcileGatewayPayment({
    provider: "pesapal",
    externalId: orderTrackingId,
    reference: ref,
    amount,
    method: "pesapal",
    rawPayload: body,
  });
}
