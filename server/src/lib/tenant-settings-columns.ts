import { tenantSettings } from "../db/schema";

/** Core tenant_settings columns (safe if extended json columns lag). */
export const tenantSettingsCoreColumns = {
  id: tenantSettings.id,
  tenantId: tenantSettings.tenantId,
  brandingJson: tenantSettings.brandingJson,
  featureFlagsJson: tenantSettings.featureFlagsJson,
  country: tenantSettings.country,
  currency: tenantSettings.currency,
  timezone: tenantSettings.timezone,
  updatedAt: tenantSettings.updatedAt,
};
