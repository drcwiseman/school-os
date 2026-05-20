import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  Briefcase,
  GraduationCap,
  Wallet,
  RefreshCw,
  Globe,
  ChevronRight,
  Download,
  Calendar,
  Activity,
  Plus,
  Pencil,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { formatMoneyMinor, DEFAULT_CURRENCY } from "../../lib/currencies";
import { SchoolFormModal, type TenantRow as ModalTenant } from "./components/SchoolFormModal";

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


const DONUT_R = 15.91549430918954;

function StatusDonut({
  active,
  trial,
  suspended,
  total,
}: {
  active: number;
  trial: number;
  suspended: number;
  total: number;
}) {
  const segments = [
    { n: active, color: "#10b981" },
    { n: trial, color: "#f59e0b" },
    { n: suspended, color: "#ef4444" },
  ].filter((s) => s.n > 0);
  const denom = total > 0 ? total : 1;
  let offset = 0;

  return (
    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={DONUT_R} fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
      {segments.map((seg, i) => {
        const pct = (seg.n / denom) * 100;
        const el = (
          <circle
            key={i}
            cx="18"
            cy="18"
            r={DONUT_R}
            fill="transparent"
            stroke={seg.color}
            strokeWidth="4"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={-offset}
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}

const CARD = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm overflow-hidden min-w-0";

const Sparkline = ({ color }: { color: string }) => (
  <svg className="w-full h-5 mt-2 max-w-full" preserveAspectRatio="none" viewBox="0 0 100 30">
    <path
      d="M0,25 C10,20 20,28 30,15 C40,5 50,18 60,10 C70,2 80,22 90,12 C95,7 100,15 100,15"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type AuditRow = { action: string; tenant_name?: string; created_at: string; source: string };

function KpiCard({
  icon: Icon,
  iconClass,
  label,
  title,
  value,
  sub,
  subClass = "text-slate-500",
  sparkColor,
}: {
  icon: React.ComponentType<{ size?: number }>;
  iconClass: string;
  label: string;
  title?: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  subClass?: string;
  sparkColor: string;
}) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${iconClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate" title={title ?? label}>
            {label}
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums truncate leading-tight mt-0.5">{value}</p>
          <p className={`text-[11px] mt-0.5 truncate ${subClass}`}>{sub}</p>
        </div>
      </div>
      <Sparkline color={sparkColor} />
    </div>
  );
}

export const PlatformDashboard: React.FC = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);

  const load = async () => {
    try {
      const [tRes, sRes, aRes] = await Promise.all([
        api.get("/api/platform/tenants"),
        api.get("/api/platform/stats"),
        api.get("/api/platform/audit-logs?limit=8"),
      ]);
      setTenants(tRes.data ?? []);
      setStats(sRes.data ?? {});
      setAudit(aRes.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cur = stats?.displayCurrency ?? DEFAULT_CURRENCY;
  const fmtMinor = (n: number) => formatMoneyMinor(n, cur);

  const statusBreakdown = useMemo(() => {
    const total = tenants.length || stats?.totalTenants || 0;
    const active = tenants.filter((t) => t.status === "active").length || stats?.activeTenants || 0;
    const trial = tenants.filter((t) => t.status === "trial").length || stats?.trialTenants || 0;
    const suspended = tenants.filter((t) => t.status === "suspended").length || stats?.suspendedTenants || 0;
    const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0");
    return { total, active, trial, suspended, pct };
  }, [tenants, stats]);

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tenants) {
      const key = t.planName ?? t.planCode ?? "Unassigned";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const total = tenants.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [tenants]);

  const sortedSchools = useMemo(
    () => [...tenants].sort((a, b) => (b.studentCount ?? 0) - (a.studentCount ?? 0)),
    [tenants],
  );

  const openCreate = () => {
    setModalMode("create");
    setEditTenant(null);
    setModalOpen(true);
  };

  const openEdit = (t: TenantRow) => {
    setModalMode("edit");
    setEditTenant(t);
    setModalOpen(true);
  };

  const updateStatus = async (slug: string, status: string) => {
    try {
      await api.patch(`/api/platform/tenants/${slug}/status`, { status });
      toast("Status updated", "success");
      await load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-5 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">Platform summary and key metrics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={15} />
            Add school
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Calendar size={15} className="text-slate-500 shrink-0" />
            <span className="hidden sm:inline">May 13 – May 20</span>
            <span className="sm:hidden">Date range</span>
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3">
        <KpiCard
          icon={Building2}
          iconClass="bg-indigo-500"
          label="Schools"
          title="Total Schools"
          value={stats?.totalTenants ?? 0}
          sub={`${statusBreakdown.active} active`}
          sparkColor="#6366f1"
        />
        <KpiCard
          icon={Users}
          iconClass="bg-emerald-500"
          label="Active"
          title="Active Schools"
          value={stats?.activeTenants ?? 0}
          sub={`${statusBreakdown.pct(statusBreakdown.active)}% of total`}
          subClass="text-emerald-600"
          sparkColor="#10b981"
        />
        <KpiCard
          icon={Briefcase}
          iconClass="bg-amber-500"
          label="Subscriptions"
          title="Total Subscriptions"
          value={stats?.totalTenants ?? 0}
          sub="Provisioned"
          sparkColor="#f59e0b"
        />
        <KpiCard
          icon={Wallet}
          iconClass="bg-blue-500"
          label="MRR"
          title="Monthly Recurring Revenue"
          value={fmtMinor(stats?.mrr ?? 0)}
          sub={`ARR ${fmtMinor(stats?.totalRevenue ?? 0)}`}
          sparkColor="#3b82f6"
        />
        <KpiCard
          icon={GraduationCap}
          iconClass="bg-purple-500"
          label="Users"
          title="Total Users"
          value={(stats?.totalUsers ?? 0).toLocaleString()}
          sub={`${stats?.totalStudents ?? 0} students`}
          sparkColor="#a855f7"
        />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        {/* Revenue Chart */}
        <div className={`lg:col-span-2 ${CARD} flex flex-col min-h-0`}>
          <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Revenue Overview</h3>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 tabular-nums truncate">{fmtMinor(stats?.mrr ?? 0)}</p>
                <p className="text-xs text-slate-500 truncate">in {cur}</p>
              </div>
            </div>
            <select className="shrink-0 rounded-md border border-slate-200 text-xs py-1 px-2 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Year</option>
            </select>
          </div>
          
          <div className="relative h-40 sm:h-44 w-full overflow-hidden shrink-0">
            {/* Dummy Line Chart Grid */}
            <div className="absolute inset-0 flex flex-col justify-between pt-1 pb-10 pl-10 pr-3">
              {[60, 45, 30, 15, 0].map((val) => (
                <div key={val} className="flex items-center w-full min-w-0">
                  <span className="text-xs text-slate-400 w-9 shrink-0">{val ? `$${val}K` : "$0"}</span>
                  <div className="flex-1 border-t border-slate-100 border-dashed min-w-0" />
                </div>
              ))}
            </div>
            <div className="absolute bottom-1 left-10 right-3 flex justify-between gap-1 text-[10px] sm:text-xs text-slate-400">
              <span>May 13</span>
              <span>May 14</span>
              <span>May 15</span>
              <span>May 16</span>
              <span className="hidden sm:inline">May 17</span>
              <span className="hidden sm:inline">May 18</span>
              <span className="hidden md:inline">May 19</span>
              <span>May 20</span>
            </div>
            <svg
              className="absolute top-1 left-10 right-3 bottom-10 z-10"
              preserveAspectRatio="none"
              viewBox="0 0 100 80"
            >
              <defs>
                <linearGradient id="platform-revenue-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M 4 56 L 17 44 L 30 40 L 43 36 L 56 32 L 69 30 L 82 24 L 96 18"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 4 80 L 4 56 L 17 44 L 30 40 L 43 36 L 56 32 L 69 30 L 82 24 L 96 18 L 96 80 Z"
                fill="url(#platform-revenue-grad)"
                opacity="0.12"
              />
              {[
                [4, 56],
                [17, 44],
                [30, 40],
                [43, 36],
                [56, 32],
                [69, 30],
                [82, 24],
                [96, 18],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="2.5" fill="white" stroke="#3b82f6" strokeWidth="2" />
              ))}
            </svg>
          </div>
        </div>

        {/* Subscription Status */}
        <div className={`${CARD} flex flex-col min-h-0`}>
          <h3 className="text-sm font-bold text-slate-900 mb-3 shrink-0">Subscription Status</h3>
          <div className="flex flex-col items-center gap-3 flex-1 min-h-0 justify-center">
            <div className="relative w-24 h-24 shrink-0">
              <StatusDonut
                active={statusBreakdown.active}
                trial={statusBreakdown.trial}
                suspended={statusBreakdown.suspended}
                total={statusBreakdown.total}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-slate-900">{statusBreakdown.total}</span>
                <span className="text-[10px] text-slate-500">Total</span>
              </div>
            </div>

            <div className="space-y-2 w-full px-1">
              {[
                { label: "Active", count: statusBreakdown.active, pct: statusBreakdown.pct(statusBreakdown.active), color: "bg-emerald-500" },
                { label: "Trial", count: statusBreakdown.trial, pct: statusBreakdown.pct(statusBreakdown.trial), color: "bg-amber-500" },
                { label: "Suspended", count: statusBreakdown.suspended, pct: statusBreakdown.pct(statusBreakdown.suspended), color: "bg-red-500" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${row.color}`} />
                  <div className="min-w-0 flex-1 flex justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800 truncate">{row.label}</span>
                    <span className="text-slate-500 shrink-0 tabular-nums">{row.count} ({row.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className={`${CARD} flex flex-col min-h-0`}>
          <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Activity</h3>
          <div className="space-y-3 flex-1 min-h-0">
            {audit.length === 0 ? (
              <p className="text-sm text-slate-500">No recent platform events yet.</p>
            ) : (
              audit.slice(0, 6).map((row) => (
                <div key={`${row.source}-${row.action}-${row.created_at}`} className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0">
                    <Activity size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{row.action}</p>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {row.tenant_name ?? row.source}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link to="/platform/system/audit" className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-4 text-right inline-flex items-center justify-end gap-1 w-full">
            View all activities <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        {/* Top Schools Table */}
        <div className={`lg:col-span-2 ${CARD} !p-0 flex flex-col min-h-0`}>
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Schools overview</h3>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          <div className="overflow-x-auto flex-1 max-h-80 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-white z-[1]">
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">School</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Students</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedSchools.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[140px]">
                      <Link to={`/platform/tenants/${t.slug}`} className="hover:text-indigo-600 truncate block" title={t.name}>{t.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600 truncate max-w-[100px]" title={t.planName ?? t.planCode ?? ""}>{t.planName ?? t.planCode ?? "—"}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{t.studentCount ?? 0}</td>
                    <td className="px-3 py-2">
                      <select
                        className="text-[11px] rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700 max-w-full"
                        value={t.status}
                        onChange={(e) => updateStatus(t.slug, e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="trial">Trial</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Edit school"
                          onClick={() => openEdit(t)}
                          className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={13} />
                        </button>
                        <Link
                          to={`/platform/tenants/${t.slug}`}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedSchools.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No schools yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 text-right">
            <Link to="/platform/tenants" className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              View all schools <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className={`${CARD} flex flex-col min-h-0`}>
          <h3 className="text-sm font-bold text-slate-900 mb-3">Plan Distribution</h3>
          <div className="space-y-4 flex-1">
            {planDistribution.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between gap-2 text-xs mb-1 min-w-0">
                  <span className="font-semibold text-slate-800 truncate">{p.name}</span>
                  <span className="text-slate-600 shrink-0 tabular-nums">
                    {p.count} <span className="text-slate-400">({p.pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${i % 3 === 0 ? "bg-indigo-600" : i % 3 === 1 ? "bg-blue-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.max(p.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
            {planDistribution.length === 0 && (
              <p className="text-sm text-slate-500">No plan assignments yet.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <Link to="/platform/subscriptions" className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              Subscriptions <ChevronRight size={14} />
            </Link>
            <Link to="/platform/subscriptions/plans" className="text-sm font-medium text-slate-600 hover:text-slate-800 inline-flex items-center gap-1">
              Plans &amp; pricing <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className={`${CARD} flex flex-col min-h-0`}>
          <h3 className="text-sm font-bold text-slate-900 mb-3">System Health</h3>
          <div className="space-y-3 flex-1">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Activity size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate">Server Status</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-medium text-emerald-600 truncate max-w-[120px]">Operational</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              </div>
            </div>
            {[
              { icon: Globe, label: "Database", value: "Healthy", valueClass: "text-emerald-600", dot: "bg-emerald-500" },
              { icon: Wallet, label: "Storage", value: "62% used", valueClass: "text-slate-600", dot: "bg-emerald-500" },
              { icon: RefreshCw, label: "Jobs", value: `${stats?.failedJobs ?? 0} failed`, valueClass: "text-amber-600", dot: "bg-amber-500" },
              { icon: Users, label: "Email", value: `${stats?.pendingJobs ?? 0} pending`, valueClass: "text-slate-600", dot: "bg-emerald-500" },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={14} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[11px] font-medium truncate max-w-[100px] ${row.valueClass}`}>{row.value}</span>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-right">
            <Link to="/platform/system/queue" className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              View system status <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <p>© 2025 SchoolOS. All rights reserved.</p>
        <div className="flex items-center gap-6 mt-4 sm:mt-0">
          <span>Platform Version: v2.1.0</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span>All systems operational</span>
          </div>
        </div>
      </footer>

      <SchoolFormModal
        open={modalOpen}
        mode={modalMode}
        tenant={editTenant as ModalTenant | null}
        onClose={() => setModalOpen(false)}
        onSaved={() => load()}
      />
    </div>
  );
};

