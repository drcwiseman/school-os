const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // We must use 'include' for the backend session cookies to work.
    options.credentials = "include";
    const resAuth = await fetch(url, { ...options, headers });

    const data = await resAuth.json().catch(() => null);

    if (!resAuth.ok) {
      throw new Error(data?.message || `API Error: ${resAuth.status}`);
    }

    return data;
  }

  get(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  post(endpoint: string, body?: any, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: "POST", body: JSON.stringify(body) });
  }

  patch(endpoint: string, body?: any, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: "PATCH", body: JSON.stringify(body) });
  }

  put(endpoint: string, body?: any, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: "PUT", body: JSON.stringify(body) });
  }

  delete(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient();

export async function downloadPdf(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const name = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "document.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
