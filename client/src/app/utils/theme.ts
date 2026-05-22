const THEME_KEY = "schoolos_theme";
const PORTAL_THEME_PREFIX = "schoolos_portal_theme_";

export function applyThemeMode(mode: "light" | "dark") {
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.classList.toggle("light", mode === "light");
  localStorage.setItem(THEME_KEY, mode);
}

export function portalThemeStorageKey(schoolSlug: string) {
  return `${PORTAL_THEME_PREFIX}${schoolSlug}`;
}

export function getStoredPortalTheme(schoolSlug: string): "light" | "dark" {
  const v = localStorage.getItem(portalThemeStorageKey(schoolSlug));
  return v === "light" ? "light" : "dark";
}

export function applyPortalTheme(mode: "light" | "dark", schoolSlug?: string) {
  if (schoolSlug) localStorage.setItem(portalThemeStorageKey(schoolSlug), mode);
}

export function applyAccentColor(accent?: string) {
  if (!accent) return;
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-border", `${accent}80`);
  document.documentElement.style.setProperty("--accent-bg", `${accent}1a`);
}

export function applyTenantAppearance(theme?: { mode?: "light" | "dark"; accent?: string }) {
  if (theme?.mode) applyThemeMode(theme.mode);
  if (theme?.accent) applyAccentColor(theme.accent);
}
