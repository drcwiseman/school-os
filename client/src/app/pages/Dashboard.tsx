import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import {
  Users, GraduationCap, UserCircle, Wallet, Loader2, ChevronRight,
  UserCheck, Megaphone, Sparkles,
} from "lucide-react";
import { DashboardCharts, type WidgetData } from "../components/DashboardCharts";
import { COUNTRY_OPTIONS } from "../../lib/currencies";

type KpiData = {
  academic?: {
    totalStudents: number;
    activeStudents: number;
    attendanceRateToday: number | null;
    activeClasses: number;
    staffTotalToday: number;
    atRiskStudents: number;
  };
  finance?: {
    feesCollectedTodayMinor: number;
    outstandingBalanceMinor: number;
    expensesMonthMinor: number;
  };
  communication?: { upcomingEvents: number };
  recentActivity?: Array<{ id: string; action: string; entityType: string; createdAt: string; actorEmail?: string }>;
};

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  to,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  to?: string;
}) {
  const inner = (
    <div className="dash-stat-card">
      <div className={`dash-stat-icon ${iconBg}`}>
        <Icon className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <div>
        <p className="dash-stat-label">{label}</p>
        <p className="dash-stat-value">{value}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export const Dashboard: React.FC = () => {
  const { user, schoolSlug, hasPermission, moduleEnabled, formatMoney, country, currency } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<KpiData | null>(null);
  const [widgets, setWidgets] = useState<WidgetData | null>(null);
  const [parentCount, setParentCount] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const base = `/s/${schoolSlug}`;

  useEffect(() => {
    if (!schoolSlug) return;
    const parentsReq = hasPermission("students.view")
      ? api.get(`/s/${schoolSlug}/api/parents`).catch(() => null)
      : Promise.resolve(null);

    Promise.all([
      api.get(`/s/${schoolSlug}/api/dashboard`),
      api.get(`/s/${schoolSlug}/api/dashboard/widgets`).catch(() => null),
      parentsReq,
    ])
      .then(([dash, w, parents]) => {
        setStats(dash.data);
        setWidgets(w?.data ?? null);
        const list = parents?.data;
        if (Array.isArray(list)) setParentCount(list.length);
        else if (list && typeof list === "object" && Array.isArray((list as { parents?: unknown[] }).parents)) {
          setParentCount((list as { parents: unknown[] }).parents.length);
        }
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) {
    return (
      <div className="dashboard-akkhor flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const apiFailed = !stats;
  const a = stats?.academic;
  const f = stats?.finance;
  const c = stats?.communication;

  const feesTotal = widgets?.feesChart.collectedMinor ?? f?.feesCollectedTodayMinor ?? 0;

  return (
    <div className="dashboard-akkhor space-y-6">
      <header>
        <p className="dash-breadcrumb">
          <Link to={base}>Home</Link>
          <span className="mx-1.5 text-slate-400">›</span>
          <span className="text-slate-700">Dashboard</span>
        </p>
        <h1 className="dash-page-title">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {user?.firstName} · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {" · "}
          {COUNTRY_OPTIONS.find((c) => c.code === country)?.name ?? country} ({currency})
        </p>
      </header>

      {apiFailed && (
        <div className="dash-alert">
          Dashboard data could not load. On the server run{" "}
          <code className="font-mono text-xs">npm run db:repair --prefix server && pm2 restart school-os</code>
          , then hard-refresh. Clear old cached UI under DevTools → Application → Service workers if needed.
        </div>
      )}

      {a && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Students"
            value={a.activeStudents.toLocaleString()}
            icon={Users}
            iconBg="bg-emerald-500"
            to={hasPermission("students.view") ? `${base}/students` : undefined}
          />
          <StatCard
            label="Teachers"
            value={a.staffTotalToday ? a.staffTotalToday.toLocaleString() : "—"}
            icon={GraduationCap}
            iconBg="bg-blue-500"
            to={`${base}/teachers`}
          />
          <StatCard
            label="Parents"
            value={parentCount != null ? parentCount.toLocaleString() : "—"}
            icon={UserCircle}
            iconBg="bg-amber-500"
            to={hasPermission("students.view") ? `${base}/parents` : undefined}
          />
          <StatCard
            label="Fees collected"
            value={formatMoney(feesTotal)}
            icon={Wallet}
            iconBg="bg-rose-500"
            to={`${base}/finance`}
          />
        </div>
      )}

      {widgets && hasPermission("students.view") && (
        <DashboardCharts widgets={widgets} messagingPath={`${base}/messaging`} formatMoney={formatMoney} />
      )}

      <div className="flex flex-wrap gap-2">
        {hasPermission("students.create") && (
          <Link to={`${base}/students/new`} className="dash-quick-link">
            <Users className="w-4 h-4 text-emerald-600" /> Add student <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
          </Link>
        )}
        {hasPermission("attendance.manage") && (
          <Link to={`${base}/attendance`} className="dash-quick-link">
            <UserCheck className="w-4 h-4 text-blue-600" /> Attendance <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
          </Link>
        )}
        <Link to={`${base}/messaging`} className="dash-quick-link">
          <Megaphone className="w-4 h-4 text-violet-600" /> Messaging
          {c?.upcomingEvents ? <span className="ml-1 text-xs text-slate-500">({c.upcomingEvents} events)</span> : null}
          <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
        </Link>
        {moduleEnabled("ai_homework") && (
          <Link to={`${base}/ai-admin`} className="dash-quick-link">
            <Sparkles className="w-4 h-4 text-violet-500" /> AI insights
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
          </Link>
        )}
      </div>

      {a && f && (
        <>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {showMore ? "Hide" : "Show"} more metrics
          </button>

          {showMore && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="dash-panel">
                <p className="text-xs text-slate-500">Attendance today</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {a.attendanceRateToday != null ? `${a.attendanceRateToday}%` : "—"}
                </p>
              </div>
              <div className="dash-panel">
                <p className="text-xs text-slate-500">Active classes</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{a.activeClasses}</p>
              </div>
              <div className="dash-panel">
                <p className="text-xs text-slate-500">Outstanding fees</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatMoney(f.outstandingBalanceMinor)}</p>
              </div>
              <div className="dash-panel">
                <p className="text-xs text-slate-500">Expenses (month)</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatMoney(f.expensesMonthMinor)}</p>
              </div>
              {a.atRiskStudents > 0 && (
                <div className="dash-panel sm:col-span-2">
                  <p className="text-xs text-slate-500">Students flagged at-risk</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{a.atRiskStudents}</p>
                  <Link to={`${base}/students`} className="text-xs text-blue-600 mt-2 inline-block hover:underline">Review students →</Link>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(stats?.recentActivity ?? []).length > 0 && (
        <div className="dash-panel">
          <h3 className="dash-panel-title mb-3">Recent activity</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {stats!.recentActivity!.slice(0, 8).map((ev) => (
              <li key={ev.id} className="text-sm text-slate-600 flex justify-between gap-2 border-l-2 border-blue-200 pl-2">
                <span>
                  <span className="font-medium text-slate-800">{ev.action}</span>
                  <span className="text-slate-500"> · {ev.entityType}</span>
                </span>
                <span className="text-xs text-slate-400 shrink-0">{new Date(ev.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {hasPermission("audit.view") && (
            <Link to={`${base}/admin`} className="mt-3 inline-block text-sm text-blue-600 hover:underline">Full audit log →</Link>
          )}
        </div>
      )}
    </div>
  );
};
