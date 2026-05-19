import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";

const DEFAULTS_KEY = "defaults";

export type PlatformDefaults = {
  displayCurrency: string;
};

const FALLBACK: PlatformDefaults = { displayCurrency: "USD" };

export async function getPlatformDefaults(): Promise<PlatformDefaults> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, DEFAULTS_KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<PlatformDefaults>;
  return {
    displayCurrency: (v.displayCurrency ?? FALLBACK.displayCurrency).toUpperCase(),
  };
}

export async function setPlatformDefaults(patch: Partial<PlatformDefaults>): Promise<PlatformDefaults> {
  const current = await getPlatformDefaults();
  const next: PlatformDefaults = {
    displayCurrency: (patch.displayCurrency ?? current.displayCurrency).toUpperCase(),
  };
  await db
    .insert(platformSettings)
    .values({ key: DEFAULTS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
