import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { DEFAULT_CURRENCY } from "../lib/currencies";

const DEFAULTS_KEY = "defaults";

export type PlatformDefaults = {
  displayCurrency: string;
};

export type PlatformMarketingSettings = {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string;
  ogImage: string;
  gaMeasurementId: string;
  gtmContainerId: string;
  plausibleDomain: string;
  twitterHandle: string;
};

const MARKETING_KEY = "marketing";

const MARKETING_FALLBACK: PlatformMarketingSettings = {
  siteName: "SchoolOS",
  siteUrl: "https://school.bclimaxtech.com",
  defaultTitle: "SchoolOS — School ERP & Academy Management for Africa",
  defaultDescription:
    "Multi-tenant school management: admissions, fees, exams, HR, parent portal, and integrations. Built for Uganda and East Africa.",
  defaultKeywords:
    "school ERP, school management software, Uganda schools, academy management, student information system",
  ogImage: "/og-schoolos.png",
  gaMeasurementId: "",
  gtmContainerId: "",
  plausibleDomain: "",
  twitterHandle: "@SchoolOS",
};

const FALLBACK: PlatformDefaults = { displayCurrency: DEFAULT_CURRENCY };

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

export async function getPlatformMarketing(): Promise<PlatformMarketingSettings> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, MARKETING_KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<PlatformMarketingSettings>;
  return { ...MARKETING_FALLBACK, ...v };
}

export async function setPlatformMarketing(patch: Partial<PlatformMarketingSettings>): Promise<PlatformMarketingSettings> {
  const current = await getPlatformMarketing();
  const next = { ...current, ...patch };
  await db
    .insert(platformSettings)
    .values({ key: MARKETING_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
