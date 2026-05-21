import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import {
  Users, GraduationCap, UserCircle, Wallet, Loader2, ChevronRight,
  UserCheck, Megaphone, Sparkles, Activity, Clock
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
  gradient,
  shadow,
  to,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  shadow: string;
  to?: string;
}) {
  const inner = (
    <div className="relative overflow-hidden flex items-center gap-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/40 group">
      {/* Decorative gradient blur in background */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-40 ${gradient.split(' ')[1]}`} />
      
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${gradient} ${shadow} transform transition-transform duration-300 group-hover:scale-110`}>
        <Icon className="w-7 h-7" strokeWidth={1.5} />
      </div>
      <div className="z-10">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
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
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const apiFailed = !stats;
  const a = stats?.academic;
  const f = stats?.finance;
  const c = stats?.communication;

  const feesTotal = widgets?.feesChart.collectedMinor ?? f?.feesCollectedTodayMinor ?? 0;
  const countryName = COUNTRY_OPTIONS.find((c) => c.code === country)?.name ?? country;

  return (
    <div className="relative space-y-8 animate-fade-in pb-10">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary-500/10 via-transparent to-transparent dark:from-primary-500/5 -z-10" />

      <header className="relative z-10 pt-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
          <Link to={base} className="hover:underline">Home</Link>
          <span className="opacity-50">/</span>
          <span>Overview</span>
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-500 dark:from-primary-400 dark:to-violet-400">{user?.firstName}</span>
        </h1>
        <p className="mt-3 text-base text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4 opacity-70" />
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          <span className="mx-2 opacity-30">•</span>
          {countryName} ({currency})
        </p>
      </header>

      {apiFailed && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-900 backdrop-blur-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-center gap-3 font-semibold mb-1">
            <Activity className="w-5 h-5 text-red-500" />
            Dashboard data could not load
          </div>
          <p className="pl-8 opacity-80">
            On the server run <code className="bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded text-xs font-mono">npm run db:repair --prefix server && pm2 restart school-os</code>, then hard-refresh.
          </p>
        </div>
      )}

      {a && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Students"
            value={a.activeStudents.toLocaleString()}
            icon={Users}
            gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
            shadow="shadow-lg shadow-emerald-500/30"
            to={hasPermission("students.view") ? `${base}/students` : undefined}
          />
          <StatCard
            label="Staff Present"
            value={a.staffTotalToday ? a.staffTotalToday.toLocaleString() : "—"}
            icon={GraduationCap}
            gradient="bg-gradient-to-br from-blue-400 to-blue-600"
            shadow="shadow-lg shadow-blue-500/30"
            to={`${base}/teachers`}
          />
          <StatCard
            label="Registered Parents"
            value={parentCount != null ? parentCount.toLocaleString() : "—"}
            icon={UserCircle}
            gradient="bg-gradient-to-br from-amber-400 to-orange-500"
            shadow="shadow-lg shadow-amber-500/30"
            to={hasPermission("students.view") ? `${base}/parents` : undefined}
          />
          <StatCard
            label="Revenue Today"
            value={formatMoney(feesTotal)}
            icon={Wallet}
            gradient="bg-gradient-to-br from-rose-400 to-rose-600"
            shadow="shadow-lg shadow-rose-500/30"
            to={`${base}/finance`}
          />
        </div>
      )}

      {widgets && hasPermission("students.view") && (
        <div className="rounded-3xl overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl p-1">
          <DashboardCharts widgets={widgets} messagingPath={`${base}/messaging`} formatMoney={formatMoney} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        {hasPermission("students.create") && (
          <Link to={`${base}/students/new`} className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-800/60 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 transition-transform group-hover:scale-110">
              <Users className="w-4 h-4" />
            </div>
            Add student
            <ChevronRight className="w-4 h-4 ml-2 opacity-40 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
        {hasPermission("attendance.manage") && (
          <Link to={`${base}/attendance`} className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-800/60 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md dark:hover:border-blue-700 dark:hover:bg-blue-900/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 transition-transform group-hover:scale-110">
              <UserCheck className="w-4 h-4" />
            </div>
            Attendance
            <ChevronRight className="w-4 h-4 ml-2 opacity-40 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
        <Link to={`${base}/messaging`} className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-800/60 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-md dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 transition-transform group-hover:scale-110">
            <Megaphone className="w-4 h-4" />
          </div>
          Messaging
          {c?.upcomingEvents ? <span className="ml-1 rounded-md bg-indigo-100 dark:bg-indigo-500/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">{c.upcomingEvents} events</span> : null}
          <ChevronRight className="w-4 h-4 ml-2 opacity-40 transition-transform group-hover:translate-x-1" />
        </Link>
        {moduleEnabled("ai_homework") && (
          <Link to={`${base}/ai-admin`} className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-800/60 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-md dark:hover:border-violet-700 dark:hover:bg-violet-900/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 transition-transform group-hover:scale-110">
              <Sparkles className="w-4 h-4" />
            </div>
            AI insights
            <ChevronRight className="w-4 h-4 ml-2 opacity-40 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      {a && f && (
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Operations Overview</h2>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-4 py-1.5 rounded-full transition-colors"
            >
              {showMore ? "Collapse view" : "Expand metrics"}
            </button>
          </div>

          {showMore && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
              <div className="rounded-2xl border border-slate-200/60 bg-white/50 dark:border-slate-700/60 dark:bg-slate-900/50 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Attendance today</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {a.attendanceRateToday != null ? `${a.attendanceRateToday}%` : "—"}
                </p>
                <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${a.attendanceRateToday ?? 0}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/60 bg-white/50 dark:border-slate-700/60 dark:bg-slate-900/50 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active classes</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{a.activeClasses}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/60 bg-white/50 dark:border-slate-700/60 dark:bg-slate-900/50 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Outstanding fees</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(f.outstandingBalanceMinor)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/60 bg-white/50 dark:border-slate-700/60 dark:bg-slate-900/50 p-5 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Expenses (month)</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(f.expensesMonthMinor)}</p>
              </div>
              {a.atRiskStudents > 0 && (
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-900/20 p-5 backdrop-blur-sm sm:col-span-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Students flagged at-risk</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{a.atRiskStudents}</p>
                  </div>
                  <Link to={`${base}/students`} className="px-4 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-semibold hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors">
                    Review students
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(stats?.recentActivity ?? []).length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/50 dark:border-slate-700/60 dark:bg-slate-900/50 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h3>
            {hasPermission("audit.view") && (
              <Link to={`${base}/admin`} className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                View all logs →
              </Link>
            )}
          </div>
          <div className="space-y-4">
            {stats!.recentActivity!.slice(0, 8).map((ev) => (
              <div key={ev.id} className="group flex items-start gap-4">
                <div className="relative mt-1">
                  <div className="absolute -inset-1 rounded-full bg-blue-100 dark:bg-blue-900/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative h-2 w-2 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900" />
                </div>
                <div className="flex-1 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                      {ev.action} <span className="font-normal text-slate-500 dark:text-slate-400 ml-1">on {ev.entityType}</span>
                    </p>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(ev.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
