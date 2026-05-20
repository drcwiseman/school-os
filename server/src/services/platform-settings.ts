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
  /** Organization logo (header, footer, JSON-LD). Path or absolute URL. */
  orgLogoUrl: string;
  /** Accessible alt text for the organization logo — required for SEO & a11y. */
  orgLogoAlt: string;
  /** Open Graph / social share image. Path or absolute URL. */
  ogImage: string;
  /** Alt text describing the OG image for og:image:alt and Twitter cards. */
  ogImageAlt: string;
  gaMeasurementId: string;
  gtmContainerId: string;
  plausibleDomain: string;
  twitterHandle: string;
};

/** Resolve relative asset paths against the public site URL for crawlers and social previews. */
export function resolveMarketingAssetUrls(settings: PlatformMarketingSettings): PlatformMarketingSettings {
  const base = (settings.siteUrl || "").replace(/\/$/, "");
  const toAbs = (path: string) => {
    const p = path?.trim();
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    if (!base) return p.startsWith("/") ? p : `/${p}`;
    return `${base}${p.startsWith("/") ? p : `/${p}`}`;
  };
  return {
    ...settings,
    orgLogoUrl: settings.orgLogoUrl ? toAbs(settings.orgLogoUrl) : "",
    ogImage: settings.ogImage ? toAbs(settings.ogImage) : "",
  };
}

const MARKETING_KEY = "marketing";

const MARKETING_FALLBACK: PlatformMarketingSettings = {
  siteName: "SchoolOS",
  siteUrl: "https://school.bclimaxtech.com",
  defaultTitle: "SchoolOS — School ERP & Academy Management for Africa",
  defaultDescription:
    "Multi-tenant school management: admissions, fees, exams, HR, parent portal, and integrations. Built for Uganda and East Africa.",
  defaultKeywords:
    "school ERP, school management software, Uganda schools, academy management, student information system",
  orgLogoUrl: "/schoolos-logo.svg",
  orgLogoAlt: "SchoolOS logo — academy management platform for schools",
  ogImage: "/og-schoolos.svg",
  ogImageAlt: "SchoolOS school ERP dashboard preview — multi-tenant academy management",
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
