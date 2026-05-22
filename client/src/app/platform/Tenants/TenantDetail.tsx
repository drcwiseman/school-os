import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Globe,
  Package,
  BarChart3,
  ExternalLink,
  UserCog,
  Save,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
  Users,
  GraduationCap,
  KeyRound,
  LogIn,
  Copy,
} from "lucide-react";
import { api } from "../../api/client";
import { absoluteSchoolUrl, normalizeAppUrl } from "../../lib/app-origin";
import { useToast } from "../../components/Toast";
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  currencyForCountry,
  formatMoneyMinor,
} from "../../../lib/currencies";

const CARD = "rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm";

const TIMEZONES = [
  "Africa/Kampala",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "UTC",
  "Europe/London",
  "America/New_York",
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    trial: "bg-amber-50 text-amber-700 ring-amber-600/20",
    suspended: "bg-red-50 text-red-700 ring-red-600/20",
  };
  const label = status === "active" ? "Active" : status === "trial" ? "Trial" : status === "suspended" ? "Suspended" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

export const TenantDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [plans, setPlans] = useState<{ id: string; code: string; name: string }[]>([]);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [planCode, setPlanCode] = useState("starter");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [timezone, setTimezone] = useState("Africa/Kampala");
  const [customDomain, setCustomDomain] = useState("");
  const [loginAccess, setLoginAccess] = useState<{
    loginUrl: string;
    parentPortalUrl?: string;
    studentPortalUrl?: string;
    users: { id: string; email: string; firstName: string; lastName: string; status: string; roleName: string | null; isPrimaryAdmin: boolean }[];
  } | null>(null);
  const [resetCreds, setResetCreds] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [resettingPwd, setResettingPwd] = useState(false);

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/platform/tenants/${slug}`);
      api.get("/api/platform/plans").then((r) => setPlans(r.data ?? [])).catch(() => {});
      try {
        const loginsRes = await api.get(`/api/platform/tenants/${slug}/logins`);
        setLoginAccess(loginsRes.data);
      } catch {
        setLoginAccess(null);
      }
      const d = res.data;
      setDetail(d);
      setName(d.tenant?.name ?? "");
      setStatus(d.tenant?.status ?? "active");
      setPlanCode(d.plan?.code ?? "starter");
      setCountry(d.settings?.country || DEFAULT_COUNTRY);
      setCurrency(d.settings?.currency ?? DEFAULT_CURRENCY);
      setTimezone(d.settings?.timezone ?? "Africa/Kampala");
      setCustomDomain(d.domain?.customDomain ?? "");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [slug]);

  const saveProfile = async () => {
    if (!slug) return;
    setSaving(true);
    try {
      await api.patch(`/api/platform/tenants/${slug}`, {
        name: name.trim(),
        status,
        planCode,
        country,
        currency,
        timezone,
      });
      toast("School profile saved", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveDomain = async () => {
    try {
      await api.patch(`/api/platform/tenants/${slug}/domain`, { customDomain });
      toast("Custom domain saved — add DNS TXT then verify", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const verifyDomain = async () => {
    try {
      await api.post(`/api/platform/tenants/${slug}/domain/verify`);
      toast("Domain marked verified", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const toggleAddon = async (code: string, active: boolean) => {
    try {
      await api.post(`/api/platform/tenants/${slug}/addons`, { code, active });
      toast(active ? "Add-on activated" : "Add-on deactivated", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const saveFeatures = async () => {
    if (!detail?.features?.length) return;
    try {
      await api.patch(`/api/platform/tenants/${slug}/features`, {
        features: detail.features.map((f: any) => ({ code: f.code, enabled: f.enabled })),
      });
      toast("Module flags saved", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const setFeatureEnabled = (code: string, enabled: boolean) => {
    setDetail((prev: any) => ({
      ...prev,
      features: prev.features.map((f: any) => (f.code === code ? { ...f, enabled } : f)),
    }));
  };

  const generateLines = async () => {
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/usage/generate-lines`, {
        cycle: detail?.billingCycle,
      });
      toast(`Generated ${res.data?.lines?.length ?? 0} billing line(s)`, "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const loginAsAdmin = async (readOnly = false) => {
    if (!slug) return;
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/impersonate`, { readOnly });
      const raw = res.data.url?.startsWith("http")
        ? res.data.url
        : `${window.location.origin}${res.data.url}`;
      window.open(normalizeAppUrl(raw), "_blank", "noopener,noreferrer");
      toast(readOnly ? "Opened read-only shadow session" : "Logged in as school administrator", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const schoolLoginUrl = useMemo(() => {
    const u = loginAccess?.loginUrl ?? `/s/${slug}/login`;
    return normalizeAppUrl(absoluteSchoolUrl(u));
  }, [slug, loginAccess?.loginUrl]);

  const parentPortalUrl = useMemo(() => {
    const u = loginAccess?.parentPortalUrl ?? (slug ? `/s/${slug}/portal/login` : "");
    return u ? normalizeAppUrl(absoluteSchoolUrl(u)) : "";
  }, [slug, loginAccess?.parentPortalUrl]);

  const studentPortalUrl = useMemo(() => {
    const u = loginAccess?.studentPortalUrl ?? loginAccess?.parentPortalUrl ?? (slug ? `/s/${slug}/portal/login` : "");
    return u ? normalizeAppUrl(absoluteSchoolUrl(u)) : "";
  }, [slug, loginAccess?.studentPortalUrl, loginAccess?.parentPortalUrl]);

  const resetAdminPassword = async () => {
    if (!slug) return;
    if (!window.confirm("Generate a new temporary password for the primary school administrator?")) return;
    setResettingPwd(true);
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/reset-admin-password`);
      setResetCreds({ email: res.data.email, temporaryPassword: res.data.temporaryPassword });
      toast("Temporary password generated", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setResettingPwd(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!detail?.tenant) {
    return (
      <div className={`${CARD} text-center py-12`}>
        <p className="text-slate-600">School not found.</p>
        <Link to="/platform/tenants" className="text-blue-600 text-sm font-medium mt-2 inline-block">Back to schools</Link>
      </div>
    );
  }

  const { tenant, domain, addons, usage, billingLines, billingCycle, plan, stats, features } = detail;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-5 pb-8">
      {/* Header */}
      <div className={`${CARD} flex flex-col sm:flex-row sm:items-center gap-4`}>
        <Link
          to="/platform/tenants"
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          aria-label="Back to schools"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Building2 size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 truncate">{tenant.name}</h1>
              <StatusBadge status={tenant.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5 font-mono truncate">
              /s/{tenant.slug} · {plan?.name ?? "No plan"}
            </p>
            {stats?.adminEmail && (
              <p className="text-xs text-slate-500 mt-1 truncate">Admin: {stats.adminEmail}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            href={schoolLoginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={15} />
            Open school
          </a>
          <button
            type="button"
            onClick={() => loginAsAdmin(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserCog size={15} />
            Login as admin
          </button>
          <button
            type="button"
            onClick={() => loginAsAdmin(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="Read-only shadow"
          >
            Shadow
          </button>
        </div>
      </div>

      {/* School login access */}
      <div className={CARD}>
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <LogIn size={16} /> School login
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 text-sm mb-4">
          {[
            { label: "Staff ERP login", url: schoolLoginUrl },
            { label: "Parent portal", url: parentPortalUrl },
            { label: "Student portal", url: studentPortalUrl },
          ].map((link) => (
            <div key={link.label} className="rounded-md border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{link.label}</p>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-blue-600 hover:underline font-mono text-xs break-all">
                {link.url.replace(/^https?:\/\/[^/]+/, "")}
              </a>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => navigator.clipboard.writeText(link.url).then(() => toast(`${link.label} URL copied`, "success"))}
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
            onClick={() => navigator.clipboard.writeText(schoolLoginUrl).then(() => toast("Staff login URL copied", "success"))}
          >
            <Copy size={12} /> Copy staff URL
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50"
            disabled={resettingPwd}
            onClick={resetAdminPassword}
          >
            {resettingPwd ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
            Reset admin password
          </button>
        </div>
        {resetCreds && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <p>
              <span className="text-slate-600">Email:</span> <code>{resetCreds.email}</code>
            </p>
            <p className="mt-1">
              <span className="text-slate-600">Temporary password:</span> <code>{resetCreds.temporaryPassword}</code>
            </p>
          </div>
        )}
        <div className="overflow-x-auto rounded-md border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(loginAccess?.users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-xs">
                    No ERP users — provision an administrator when creating the school.
                  </td>
                </tr>
              ) : (
                loginAccess?.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {u.isPrimaryAdmin && (
                        <span className="text-[10px] font-semibold text-blue-600 uppercase">Impersonation target</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{u.roleName ?? "—"}</td>
                    <td className="px-3 py-2 capitalize text-slate-600">{u.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Students", value: stats?.studentCount ?? 0, icon: GraduationCap },
          { label: "Staff", value: stats?.staffCount ?? 0, icon: Users },
          { label: "ERP users", value: stats?.erpUserCount ?? 0, icon: Users },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={CARD}>
              <div className="flex items-center gap-2 text-slate-500">
                <Icon size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* School profile CRUD */}
        <section className={`${CARD} space-y-4 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">School profile</h2>
            <button
              type="button"
              disabled={saving}
              onClick={saveProfile}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">School name</label>
              <input className="input text-sm mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">URL slug</label>
              <input className="input text-sm mt-1 w-full bg-slate-50 font-mono" value={tenant.slug} readOnly title="Auto-generated at creation" />
              <p className="text-[10px] text-slate-400 mt-1">Generated automatically; used in /s/{tenant.slug}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select className="input text-sm mt-1 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Subscription plan</label>
              <select className="input text-sm mt-1 w-full" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Country</label>
              <select
                className="input text-sm mt-1 w-full"
                value={country}
                onChange={(e) => {
                  const c = e.target.value;
                  setCountry(c);
                  setCurrency(currencyForCountry(c));
                }}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Currency</label>
              <select className="input text-sm mt-1 w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Timezone</label>
              <select className="input text-sm mt-1 w-full" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Domains */}
        <section className={`${CARD} space-y-4`}>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Globe size={16} className="text-blue-600" />
            Domains & routing
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2 py-2 border-b border-slate-100">
              <span className="text-slate-500">Subdomain</span>
              <span className="font-mono text-slate-800">{domain?.subdomain ?? tenant.slug}</span>
            </div>
            {domain?.suggestedSubdomainUrl && (
              <div className="flex justify-between gap-2 py-2 border-b border-slate-100">
                <span className="text-slate-500">Path URL</span>
                <a href={domain.suggestedSubdomainUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-mono truncate max-w-[200px]">
                  {domain.suggestedSubdomainUrl}
                </a>
              </div>
            )}
            <div className="flex justify-between gap-2 py-2">
              <span className="text-slate-500">SSL / verify</span>
              <span className={`text-xs font-medium ${domain?.domainVerified ? "text-emerald-600" : "text-amber-600"}`}>
                {domain?.domainVerified ? "Verified" : domain?.sslStatus ?? "Pending"}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Custom domain</label>
            <input
              className="input text-sm mt-1 w-full"
              placeholder="erp.greenfield.ac.ug"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveDomain} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Save domain
            </button>
            <button
              type="button"
              onClick={verifyDomain}
              disabled={!customDomain}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              Mark verified
            </button>
          </div>
          {domain?.customDomain && domain?.dnsTxtRecord && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs font-mono text-slate-600 break-all">
              <p className="font-semibold text-slate-700 mb-1">DNS TXT record</p>
              <p>{domain.dnsTxtRecord.host}</p>
              <p className="mt-1 text-slate-800">{domain.dnsTxtRecord.value}</p>
            </div>
          )}
        </section>

        {/* Module flags */}
        <section className={`${CARD} space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-blue-600" />
              Module flags
            </h2>
            <button type="button" onClick={saveFeatures} className="text-xs font-medium text-blue-600 hover:text-blue-700">
              Save flags
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(features ?? []).map((f: any) => (
              <label
                key={f.code}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-sm text-slate-800 min-w-0 truncate">{f.name}</span>
                <input
                  type="checkbox"
                  checked={f.enabled}
                  onChange={(e) => setFeatureEnabled(f.code, e.target.checked)}
                  className="shrink-0 rounded border-slate-300 text-blue-600"
                />
              </label>
            ))}
            {(!features || features.length === 0) && (
              <p className="text-sm text-slate-500">No modules configured.</p>
            )}
          </div>
        </section>

        {/* Add-ons */}
        <section className={`${CARD} space-y-3 lg:col-span-2`}>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package size={16} className="text-blue-600" />
            Add-on marketplace
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {addons?.map((a: any) => (
              <label
                key={a.code}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  a.active ? "border-blue-200 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{a.code}</p>
                  {a.priceMonthly != null && (
                    <p className="text-xs text-slate-600 mt-1">{formatMoneyMinor(a.priceMonthly, currency)} / mo</p>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={a.active}
                  onChange={(e) => toggleAddon(a.code, e.target.checked)}
                  className="shrink-0 mt-0.5 rounded border-slate-300 text-blue-600"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Usage billing */}
        <section className={`${CARD} space-y-4 lg:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600" />
              Usage billing — {billingCycle}
            </h2>
            <button
              type="button"
              onClick={generateLines}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Generate overage lines
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {usage?.map((u: any) => (
              <div key={u.metric} className="rounded-md border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{u.metric}</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{u.quantityUsed}</p>
              </div>
            ))}
            {(!usage || usage.length === 0) && (
              <p className="text-sm text-slate-500 col-span-full">No usage recorded this cycle.</p>
            )}
          </div>
          {billingLines?.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-slate-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Metric</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billingLines.map((l: any) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-slate-800">{l.description}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-xs">{l.metric ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoneyMinor(l.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
