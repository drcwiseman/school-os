const THEME_KEY = "schoolos_theme";

export function applyThemeMode(mode: "light" | "dark") {
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.classList.toggle("light", mode === "light");
  localStorage.setItem(THEME_KEY, mode);
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
