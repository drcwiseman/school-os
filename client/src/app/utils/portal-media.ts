const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function resolvePortalMediaUrl(path: string, cacheBust?: number) {
  if (!path) return "";
  let url = path;
  if (!path.startsWith("http") && !path.startsWith("data:")) {
    url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  }
  if (cacheBust != null) {
    url += `${url.includes("?") ? "&" : "?"}v=${cacheBust}`;
  }
  return url;
}
