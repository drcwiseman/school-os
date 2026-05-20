/** Client labels for feature categories (must match server catalog). */
export const FEATURE_CATEGORY_LABELS: Record<string, string> = {
  modules: "ERP modules",
  portal: "Portal & mobile",
  communications: "Email & messaging",
  platform: "Platform & scale",
  support: "Support & SLA",
  success: "Training & onboarding",
  integrations: "Integrations",
};

export const FEATURE_CATEGORY_ORDER = [
  "modules",
  "portal",
  "communications",
  "platform",
  "support",
  "success",
  "integrations",
] as const;
