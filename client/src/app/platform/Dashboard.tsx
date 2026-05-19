import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  GraduationCap,
  Wallet,
  Briefcase,
  Search,
  Ban,
  Eye,
  RefreshCw,
  Loader2,
  Globe,
  Settings,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { formatMoneyMinor } from "../../lib/currencies";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  country?: string;
  currency?: string;
  planName?: string;
  planCode?: string;
  studentCount?: number;
  erpUserCount?: number;
};

type Stats = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalStaff?: number;
  totalStudents: number;
  totalJobs: number;
  failedJobs: number;
  mrr?: number;
  totalRevenue: number;
  displayCurrency?: string;
  fxProvider?: string;
};

type FeatureRow = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const PlatformDashboard: React.FC = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState("");
  const [tenantFeatures, setTenantFeatures] = useState<FeatureRow[]>([]);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [fxBase, setFxBase] = useState("USD");
  const [fxRates, setFxRates] = useState<Record<string, number>>({});

  const load = async () => {
    const [t, s, settings] = await Promise.all([
      api.get("/api/platform/tenants"),
      api.get("/api/platform/stats"),
      api.get("/api/platform/settings"),
    ]);
    setTenants(t.data ?? []);
    if (s.data) setStats(s.data);
    if (settings.data?.displayCurrency) setDisplayCurrency(settings.data.displayCurrency);
  };

  useEffect(() => {
    load()
      .catch((e) => toast(e.message || "Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get(`/api/platform/exchange-rates?base=${fxBase}`)
      .then((res) => { if (res.data?.rates) setFxRates(res.data.rates); })
      .catch(() => {});
  }, [fxBase]);

  const saveCurrency = async (code: string) => {
    try {
      await api.patch("/api/platform/settings", { displayCurrency: code });
      setDisplayCurrency(code);
      await load();
      toast(`Display currency set to ${code}`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const toggleStatus = async (slug: string, status: "active" | "suspended") => {
    const label = status === "suspended" ? "suspend" : "reactivate";
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${slug}?`)) return;
    try {
      await api.patch(`/api/platform/tenants/${slug}/status`, { status });
      await load();
      toast(`School ${slug} is now ${status}`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleImpersonate = async (tenant: TenantRow) => {
    try {
      const res = await api.post(`/api/platform/tenants/${tenant.slug}/impersonate`);
      window.open(res.data?.url, "_blank", "noopener,noreferrer");
      toast("Read-only session opened in a new tab", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const loadTenantFeatures = async (slug: string) => {
    setSelectedTenantSlug(slug);
    if (!slug) return setTenantFeatures([]);
    const res = await api.get(`/api/platform/tenants/${slug}/features`);
    setTenantFeatures(res.data ?? []);
  };

  const saveTenantFeatures = async () => {
    if (!selectedTenantSlug) return;
    setSavingFeatures(true);
    try {
      await api.patch(`/api/platform/tenants/${selectedTenantSlug}/features`, {
        features: tenantFeatures.map((f) => ({ code: f.code, enabled: f.enabled })),
      });
      toast("Features updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingFeatures(false);
    }
  };

  const filteredTenants = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    [tenants, search],
  );

  const cur = stats?.displayCurrency ?? displayCurrency;
  const fmt = (n: number) => formatMoneyMinor(n, cur);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="mt-3 text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform metrics across {stats?.totalTenants ?? 0} schools · FX via {stats?.fxProvider ?? "Frankfurter"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Currency</label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={cur}
            onChange={(e) => saveCurrency(e.target.value)}
          >
            {["USD", "UGX", "KES", "EUR", "GBP", "NGN", "ZAR"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load().then(() => toast("Refreshed", "success"))}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Schools" value={String(stats?.totalTenants ?? 0)} hint={`${stats?.activeTenants ?? 0} active`} icon={Building2} />
        <StatCard label="ERP users" value={String(stats?.totalUsers ?? 0)} hint="Admin & operator accounts" icon={Users} />
        <StatCard label="Employees" value={String(stats?.totalStaff ?? 0)} hint="HR registry (all schools)" icon={Briefcase} />
        <StatCard label="Students" value={String(stats?.totalStudents ?? 0)} hint="Enrolled pupils" icon={GraduationCap} />
        <StatCard label="MRR" value={fmt(stats?.mrr ?? 0)} hint={`ARR ${fmt(stats?.totalRevenue ?? 0)}`} icon={Wallet} accent />
      </div>

      {/* System health strip */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
        <span className="text-slate-500">Background jobs</span>
        <span className="font-medium text-slate-900">{stats?.totalJobs ?? 0} total</span>
        <span className={stats?.failedJobs ? "text-amber-600 font-medium" : "text-slate-600"}>
          {stats?.failedJobs ?? 0} failed
        </span>
        <Link to="/platform/system/queue" className="ml-auto inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium">
          View queue <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Schools table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Schools</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tenants on this platform</p>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools…"
                className="w-full sm:w-56 rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">School</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3 text-center">Students</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <Link to={`/platform/tenants/${t.slug}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {t.name}
                      </Link>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">/s/{t.slug}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{t.planName ?? t.planCode ?? "—"}</td>
                    <td className="px-5 py-4 text-center text-slate-700">{t.studentCount ?? 0}</td>
                    <td className="px-5 py-4">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleImpersonate(t)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          title="Read-only shadow login"
                        >
                          <Eye size={14} /> View
                        </button>
                        {t.status === "active" ? (
                          <button
                            type="button"
                            onClick={() => toggleStatus(t.slug, "suspended")}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Ban size={14} /> Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleStatus(t.slug, "active")}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      No schools match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <Link to="/platform/tenants" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
              Manage all schools <ExternalLink size={14} />
            </Link>
          </div>
        </div>

        {/* Side panel: FX + features */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Globe size={16} className="text-slate-400" /> Exchange rates
              </h3>
              <select
                value={fxBase}
                onChange={(e) => setFxBase(e.target.value)}
                className="text-xs rounded-md border border-slate-200 px-2 py-1"
              >
                {["USD", "EUR", "GBP", "KES", "UGX", "NGN", "ZAR"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <ul className="space-y-2 text-sm">
              {["KES", "UGX", "EUR", "GBP", "NGN", "ZAR"]
                .filter((c) => c !== fxBase)
                .slice(0, 6)
                .map((code) => (
                  <li key={code} className="flex justify-between text-slate-600">
                    <span>{code}</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {fxRates[code]?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
                    </span>
                  </li>
                ))}
            </ul>
            <Link to="/platform/subscriptions/plans" className="mt-4 block text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Plans & regional pricing →
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Settings size={16} className="text-slate-400" /> School features
            </h3>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3"
              value={selectedTenantSlug}
              onChange={(e) => loadTenantFeatures(e.target.value)}
            >
              <option value="">Select a school…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.slug}>{t.name}</option>
              ))}
            </select>
            {selectedTenantSlug && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tenantFeatures.map((f) => (
                  <label key={f.code} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-700">{f.name}</span>
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) =>
                        setTenantFeatures((prev) =>
                          prev.map((x) => (x.code === f.code ? { ...x, enabled: e.target.checked } : x)),
                        )
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  disabled={savingFeatures}
                  onClick={saveTenantFeatures}
                  className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingFeatures ? "Saving…" : "Save features"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-indigo-600" : "text-slate-900"}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${accent ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    suspended: "bg-red-50 text-red-700 ring-red-600/20",
    trial: "bg-blue-50 text-blue-700 ring-blue-600/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? "bg-slate-50 text-slate-600 ring-slate-500/20"}`}>
      {status}
    </span>
  );
}
