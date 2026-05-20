import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";

const WEBHOOKS_KEY = "outbound_webhooks";

type StoredWebhook = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string;
};

type StoredWebhooks = { hooks: StoredWebhook[] };

export async function dispatchPlatformEvent(
  event: string,
  payload: Record<string, unknown>,
): Promise<{ delivered: number; failed: number }> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, WEBHOOKS_KEY)).limit(1);
  const hooks = ((row?.value ?? {}) as StoredWebhooks).hooks ?? [];
  const targets = hooks.filter((h) => h.enabled && h.events.includes(event));
  if (!targets.length) return { delivered: 0, failed: 0 };

  const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() });
  let delivered = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (hook) => {
      const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SchoolOS-Event": event,
            "X-SchoolOS-Signature": `sha256=${sig}`,
          },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) delivered++;
        else failed++;
      } catch {
        failed++;
      }
    }),
  );

  return { delivered, failed };
}
