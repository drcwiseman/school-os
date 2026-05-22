#!/usr/bin/env node
/**
 * Audit production school-b pages via API (authenticated).
 * Usage: node scripts/audit-school-b-prod.mjs
 */
const BASE = process.env.BASE_URL ?? "https://masomobest.com";
const SLUG = "school-b";
const EMAIL = process.env.SCHOOL_EMAIL ?? "admin@school-b.com";
const PASS = process.env.SCHOOL_PASS ?? "Password123!";

const endpoints = [
  ["GET", "/api/auth/me"],
  ["GET", "/api/dashboard"],
  ["GET", "/api/dashboard/widgets"],
  ["GET", "/api/settings"],
  ["GET", "/api/settings/features"],
  ["GET", "/api/students?limit=5"],
  ["GET", "/api/parents?limit=5"],
  ["GET", "/api/admissions"],
  ["GET", "/api/admission-forms"],
  ["GET", "/api/attendance/sessions/enriched"],
  ["GET", "/api/academics/classes"],
  ["GET", "/api/exams/assessments"],
  ["GET", "/api/finance/invoices?limit=5"],
  ["GET", "/api/hr/staff?limit=5"],
  ["GET", "/api/payroll/runs?limit=5"],
  ["GET", "/api/messaging/announcements?limit=5"],
  ["GET", "/api/reports/builder"],
  ["GET", "/api/help"],
  ["GET", "/api/security/sessions"],
  ["GET", "/api/admin/overview"],
  ["GET", "/api/admin/users-with-roles"],
  ["GET", "/api/discipline/incidents?limit=5"],
  ["GET", "/api/health/visits?limit=5"],
  ["GET", "/api/inventory/items?limit=5"],
  ["GET", "/api/library/books?limit=5"],
  ["GET", "/api/transport/routes"],
  ["GET", "/api/boarding/dashboard"],
  ["GET", "/api/facilities/overview"],
  ["PATCH", "/api/settings", {
    country: "UG",
    currency: "UGX",
    timezone: "Africa/Kampala",
    paymentProvidersJson: { paypal: { enabled: false }, pesapal: { enabled: false } },
    smtpSettingsJson: { enabled: false },
  }],
];

const pages = [
  "/login",
  "/dashboard",
  "/students",
  "/parents",
  "/teachers",
  "/admissions",
  "/attendance",
  "/academics",
  "/curriculum",
  "/exams",
  "/finance",
  "/hr",
  "/payroll",
  "/facilities",
  "/ops/discipline",
  "/ops/health",
  "/ops/inventory",
  "/messaging",
  "/reports",
  "/admin",
  "/security",
  "/help",
  "/settings",
  "/portal/login",
];

async function main() {
  const jar = new Map();
  const loginRes = await fetch(`${BASE}/s/${SLUG}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    jar.set(k.trim(), v);
  }
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const loginJson = await loginRes.json().catch(() => ({}));
  console.log("LOGIN", loginRes.status, loginJson.success ? "ok" : loginJson.message ?? loginJson);

  const apiFails = [];
  for (const item of endpoints) {
    const [method, path, payload] = item;
    const url = `${BASE}/s/${SLUG}${path}`;
    const res = await fetch(url, {
      method,
      headers: { Cookie: cookie, ...(payload ? { "Content-Type": "application/json" } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    let json = null;
    try { json = await res.json(); } catch { /* */ }
    const ok = res.ok && json?.success !== false;
    const line = `${res.status} ${method} ${path}${!ok ? ` — ${json?.message ?? "fail"}` : ""}`;
    console.log(line);
    if (!ok) apiFails.push({ path, status: res.status, message: json?.message, errors: json?.errors });
  }

  console.log("\n--- SPA routes (HTML shell) ---");
  const pageFails = [];
  for (const p of pages) {
    const res = await fetch(`${BASE}/s/${SLUG}${p}`);
    const html = await res.text();
    const hasRoot = html.includes('id="root"') || html.includes("SchoolOS");
    const ok = res.status === 200 && hasRoot;
    console.log(`${res.status} ${p}${ok ? "" : " — bad shell"}`);
    if (!ok) pageFails.push(p);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`API failures: ${apiFails.length}`);
  for (const f of apiFails) console.log(`  ${f.status} ${f.path}: ${f.message ?? JSON.stringify(f.errors)}`);
  console.log(`Page shell failures: ${pageFails.length}`);
  if (pageFails.length) console.log(" ", pageFails.join(", "));
  process.exit(apiFails.length + pageFails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
