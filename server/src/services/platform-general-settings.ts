import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";

const GENERAL_KEY = "general";

export type PlatformGeneralSettings = {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  timezone: string;
  defaultLocale: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  incidentBanner: string;
};

const DEFAULTS: PlatformGeneralSettings = {
  platformName: "SchoolOS",
  supportEmail: "support@masomobest.com",
  supportPhone: "",
  timezone: "Africa/Kampala",
  defaultLocale: "en-UG",
  maintenanceMode: false,
  maintenanceMessage: "Scheduled maintenance in progress. Please try again shortly.",
  privacyPolicyUrl: "/privacy",
  termsUrl: "/terms",
  incidentBanner: "",
};

export async function getPlatformGeneralSettings(): Promise<PlatformGeneralSettings> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, GENERAL_KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<PlatformGeneralSettings>;
  return { ...DEFAULTS, ...v };
}

export async function setPlatformGeneralSettings(
  patch: Partial<PlatformGeneralSettings>,
): Promise<PlatformGeneralSettings> {
  const current = await getPlatformGeneralSettings();
  const next = { ...current, ...patch };
  await db
    .insert(platformSettings)
    .values({ key: GENERAL_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
