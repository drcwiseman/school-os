import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Server, Users, GraduationCap, CreditCard, Shield, Search, Ban, Eye, RefreshCw,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { formatMoneyMinor } from "../../lib/currencies";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  country?: string;
  currency?: string;
  planCode?: string;
  planName?: string;
  studentCount?: number;
  userCount?: number;
};

type Stats = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalStudents: number;
  totalJobs: number;
  failedJobs: number;
  pendingJobs?: number;
  runningJobs?: number;
  totalRevenue: number;
  mrr?: number;
  displayCurrency?: string;
  fxProvider?: string;
};

export const PlatformDashboard: React.FC = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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
    load().catch((e) => toast(e.message, "error")).finally(() => setLoading(false));
  }, []);

  const saveCurrency = async (code: string) => {
    try {
      await api.patch("/api/platform/settings", { displayCurrency: code });
      setDisplayCurrency(code);
      await load();
      toast("Platform display currency updated", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const toggleStatus = async (slug: string, status: "active" | "suspended") => {
    if (!window.confirm(`${status === "suspended" ? "Suspend" : "Reactivate"} /s/${slug}?`)) return;
    try {
      await api.patch(`/api/platform/tenants/${slug}/status`, { status });
      await load();
      toast("Tenant status updated", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const cur = stats?.displayCurrency ?? displayCurrency;
  const fmt = (n: number) => formatMoneyMinor(n, cur);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      suspended: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded border uppercase ${map[status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
        {status}
      </span>
    );
  };

  if (loading) return <p className="text-slate-500 text-sm">Loading command center…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Macro-Economic Command Center</h2>
          <p className="text-xs text-slate-400 mt-1">Platform layer metrics — consolidated with live FX ({stats?.fxProvider ?? "frankfurter.app"})</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Display currency</label>
          <select
            className="bg-[#060a12] border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200"
            value={cur}
            onChange={(e) => saveCurrency(e.target.value)}
          >
            {["USD", "KES", "EUR", "GBP", "NGN", "ZAR", "INR", "AED"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button type="button" onClick={() => load()} className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Bento title="Schools provisioned" value={String(stats?.totalTenants ?? 0)} sub={`${stats?.activeTenants ?? 0} active nodes`} icon={Server} accent="blue" />
        <Bento title="Total staff users" value={String(stats?.totalUsers ?? 0)} sub="Across all tenants" icon={Users} accent="purple" />
        <Bento title="Isolated students" value={String(stats?.totalStudents ?? 0)} sub="Portal + core ERP" icon={GraduationCap} accent="emerald" />
        <Bento title="MRR consolidated" value={fmt(stats?.mrr ?? 0)} sub={`ARR ${fmt(stats?.totalRevenue ?? 0)}`} icon={CreditCard} accent="emerald" highlight />
      </section>

      <div className="bg-blue-950/20 border border-blue-500/20 text-blue-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-blue-400 shrink-0" />
          <span><strong>Platform ≠ Tenant:</strong> You govern the ecosystem; school admins run their castles. Row-level <code className="text-blue-200">tenant_id</code> isolation enforced on every query.</span>
        </div>
        <div className="flex gap-4 text-slate-400">
          <span>Jobs: <strong className="text-white">{stats?.totalJobs ?? 0}</strong></span>
          <span>Failed: <strong className="text-rose-400">{stats?.failedJobs ?? 0}</strong></span>
          <span>Queue: <strong className="text-amber-400">5s poll</strong></span>
        </div>
      </div>

      <div className="bg-[#090f1c]/80 backdrop-blur-md border border-slate-900 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Active tenant cluster</h3>
            <p className="text-xs text-slate-400">Plan tier, locale, and operational status</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter slug or name…"
              className="bg-[#060a12] border border-slate-800 text-xs rounded-lg pl-9 pr-4 py-2 w-64 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-900 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6">School</th>
                <th className="py-4 px-6">Route</th>
                <th className="py-4 px-6">Country / Currency</th>
                <th className="py-4 px-6">Plan</th>
                <th className="py-4 px-6">Students</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 text-slate-300">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[#0c1424]/30">
                  <td className="py-4 px-6">
                    <div className="font-medium text-white">{t.name}</div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="py-4 px-6 font-mono text-blue-400">/s/{t.slug}</td>
                  <td className="py-4 px-6">{t.country || "—"} / {t.currency || "USD"}</td>
                  <td className="py-4 px-6">{t.planName ?? t.planCode ?? "—"}</td>
                  <td className="py-4 px-6">{t.studentCount ?? 0}</td>
                  <td className="py-4 px-6">{statusBadge(t.status)}</td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <Link to={`/s/${t.slug}/login`} className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300">
                      <Eye size={12} /> Open
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] border border-slate-800 px-2 py-1 rounded text-slate-400 hover:text-amber-400"
                      onClick={() => toast("Secure impersonation API — Phase 17", "info")}
                    >
                      Shadow
                    </button>
                    {t.status === "active" ? (
                      <button type="button" className="inline-flex items-center gap-1 text-[11px] text-amber-400" onClick={() => toggleStatus(t.slug, "suspended")}>
                        <Ban size={12} /> Suspend
                      </button>
                    ) : (
                      <button type="button" className="text-[11px] text-emerald-400" onClick={() => toggleStatus(t.slug, "active")}>Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function Bento({
  title, value, sub, icon: Icon, accent, highlight,
}: {
  title: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number }>;
  accent: "blue" | "purple" | "emerald";
  highlight?: boolean;
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
  };
  return (
    <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 hover:border-slate-800 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className={`text-3xl font-bold mt-2 ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colors[accent]}`}><Icon size={20} /></div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
