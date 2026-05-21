import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import {
  Users, UserCheck, FileWarning, GraduationCap, BookOpen, ClipboardList,
  Calendar, AlertTriangle, DollarSign, Wallet, Bus, Home, Library,
  Package, Megaphone, Sparkles, Loader2, TrendingUp, ArrowUpRight,
} from "lucide-react";
import { DashboardCharts, type WidgetData } from "../components/DashboardCharts";

type KpiData = {
  academic?: {
    totalStudents: number;
    activeStudents: number;
    attendanceSessionsToday: number;
    attendanceRateToday: number | null;
    activeClasses: number;
    ongoingExams: number;
    upcomingAssignments: number;
    atRiskStudents: number;
    staffPresentToday: number;
    staffTotalToday: number;
  };
  finance?: {
    feesCollectedTodayMinor: number;
    outstandingBalanceMinor: number;
    pendingInvoices: number;
    payrollDue: number;
    expensesTodayMinor: number;
    expensesMonthMinor: number;
  };
  operations?: {
    transportRoutes: number;
    transportAssignments: number;
    hostelOccupancyPct: number | null;
    libraryActiveLoans: number;
    libraryOverdue: number;
    clinicOpenVisits: number;
    healthAlerts: number;
    inventoryLowStock: number;
  };
  communication?: {
    recentAnnouncements: number;
    smsSentToday: number;
    upcomingEvents: number;
    unreadParentMessages: number;
  };
  aiInsights?: {
    atRiskPreview: Array<{ studentId: string; name: string; riskScore: number; status: string }>;
    feeDefaultRiskCount: number;
    attendanceAnomalySessions: number;
    overloadedTeachers: number;
  };
  recentActivity?: Array<{ id: string; action: string; entityType: string; createdAt: string; actorEmail?: string }>;
};

function money(minor: number, currency = "KES") {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function HeroMetric({ label, value, delta, icon: Icon, accent }: {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5">
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-20 blur-2xl ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
          {delta && <p className="mt-1 text-xs text-slate-400">{delta}</p>}
        </div>
        <div className="rounded-xl bg-slate-800/80 p-2.5">
          <Icon className="w-5 h-5 text-slate-300" />
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, icon: Icon, to }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  to?: string;
}) {
  const body = (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-600 hover:bg-slate-900/70">
      <div className="rounded-lg bg-slate-800 p-2">
        <Icon className="w-4 h-4 text-slate-400 group-hover:text-primary-300 transition-colors" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      {to && <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400 shrink-0" />}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export const Dashboard: React.FC = () => {
  const { user, schoolSlug, hasPermission, moduleEnabled } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<KpiData | null>(null);
  const [widgets, setWidgets] = useState<WidgetData | null>(null);
  const base = `/s/${schoolSlug}`;

  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/dashboard`),
      api.get(`/s/${schoolSlug}/api/dashboard/widgets`).catch(() => null),
    ])
      .then(([dash, w]) => {
        setStats(dash.data);
        setWidgets(w?.data ?? null);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const a = stats?.academic;
  const f = stats?.finance;
  const o = stats?.operations;
  const c = stats?.communication;
  const ai = stats?.aiInsights;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 px-6 py-8 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-600/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary-400/90">Command Center</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Good day, {user?.firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-400">{today} · {schoolSlug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission("students.create") && <Link to={`${base}/students`} className="btn-primary text-sm">Students</Link>}
            {hasPermission("attendance.manage") && <Link to={`${base}/attendance`} className="btn-secondary text-sm">Attendance</Link>}
            {moduleEnabled("ai_homework") && <Link to={`${base}/ai-admin`} className="btn-secondary text-sm inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI</Link>}
          </div>
        </div>
      </div>

      {widgets && hasPermission("students.view") && (
        <DashboardCharts widgets={widgets} messagingPath={`${base}/messaging`} />
      )}

      {a && f && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeroMetric label="Active students" value={a.activeStudents} delta={`${a.totalStudents} enrolled`} icon={Users} accent="bg-blue-500" />
          <HeroMetric
            label="Attendance rate"
            value={a.attendanceRateToday != null ? `${a.attendanceRateToday}%` : "—"}
            delta={`${a.attendanceSessionsToday} sessions today`}
            icon={UserCheck}
            accent="bg-emerald-500"
          />
          <HeroMetric label="Collected today" value={money(f.feesCollectedTodayMinor)} icon={TrendingUp} accent="bg-violet-500" />
          <HeroMetric label="Outstanding fees" value={money(f.outstandingBalanceMinor)} delta={`${f.pendingInvoices} pending invoices`} icon={FileWarning} accent="bg-amber-500" />
        </div>
      )}

      {a && (
        <Section title="Academic">
          <KpiTile label="Active classes" value={a.activeClasses} icon={GraduationCap} to={`${base}/academics`} />
          <KpiTile label="Ongoing exams" value={a.ongoingExams} icon={ClipboardList} to={`${base}/exams`} />
          <KpiTile label="Assignments (7d)" value={a.upcomingAssignments} icon={BookOpen} to={`${base}/academics`} />
          <KpiTile label="At-risk" value={a.atRiskStudents} icon={AlertTriangle} to={moduleEnabled("ai_homework") ? `${base}/ai-admin` : `${base}/students`} />
          <KpiTile label="Staff present" value={a.staffPresentToday} sub={a.staffTotalToday ? `${a.staffTotalToday} checked in` : undefined} icon={Users} to={`${base}/hr`} />
        </Section>
      )}

      {f && (
        <Section title="Finance">
          <KpiTile label="Payroll due" value={f.payrollDue} sub="runs pending" icon={Wallet} to={`${base}/payroll`} />
          <KpiTile label="Expenses today" value={money(f.expensesTodayMinor)} sub={`Month: ${money(f.expensesMonthMinor)}`} icon={DollarSign} to={`${base}/finance`} />
        </Section>
      )}

      {o && (
        <Section title="Operations">
          <KpiTile label="Transport" value={o.transportRoutes} sub={`${o.transportAssignments} assignments`} icon={Bus} to={`${base}/ops/transport`} />
          <KpiTile label="Hostel" value={o.hostelOccupancyPct != null ? `${o.hostelOccupancyPct}%` : "—"} icon={Home} to={`${base}/ops/boarding`} />
          <KpiTile label="Library" value={o.libraryActiveLoans} sub={o.libraryOverdue > 0 ? `${o.libraryOverdue} overdue` : undefined} icon={Library} to={`${base}/ops/library`} />
          <KpiTile label="Low stock" value={o.inventoryLowStock} icon={Package} to={`${base}/ops/inventory`} />
        </Section>
      )}

      {c && (
        <Section title="Communication">
          <KpiTile label="Announcements" value={c.recentAnnouncements} icon={Megaphone} to={`${base}/messaging`} />
          <KpiTile label="SMS today" value={c.smsSentToday} icon={Megaphone} to={`${base}/messaging`} />
          <KpiTile label="Parent messages" value={c.unreadParentMessages} sub="unread" icon={Megaphone} to={`${base}/teacher`} />
          <KpiTile label="Events" value={c.upcomingEvents} icon={Calendar} to={`${base}/messaging`} />
        </Section>
      )}

      {ai && (
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950/30 to-slate-950 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-violet-200">
              <Sparkles className="w-4 h-4" /> AI insights
            </h2>
            {ai.atRiskPreview.length === 0 ? (
              <p className="text-sm text-slate-500">No elevated risk in recent sample.</p>
            ) : (
              <ul className="space-y-3">
                {ai.atRiskPreview.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
                    <Link to={`${base}/students/${s.studentId}`} className="text-sm text-violet-300 hover:underline">{s.name}</Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "high" ? "bg-red-900/50 text-red-200" : "bg-amber-900/50 text-amber-200"}`}>
                      {s.riskScore}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {moduleEnabled("ai_homework") && (
              <Link to={`${base}/ai-admin`} className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
                Open AI Admin →
              </Link>
            )}
          </div>
          <div className="lg:col-span-2 space-y-3">
            <KpiTile label="Fee default risk" value={ai.feeDefaultRiskCount} sub="overdue students" icon={DollarSign} />
            <KpiTile label="Attendance anomalies" value={ai.attendanceAnomalySessions} sub="sessions &gt;30% absent" icon={UserCheck} />
            <KpiTile label="Teacher overload" value={ai.overloadedTeachers} icon={Users} />
          </div>
        </section>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="mb-4 font-semibold text-white">Recent activity</h3>
        {(stats?.recentActivity ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No recent audit events.</p>
        ) : (
          <ul className="space-y-3">
            {stats!.recentActivity!.map((ev) => (
              <li key={ev.id} className="flex gap-3 text-sm border-l-2 border-primary-600/40 pl-3">
                <div>
                  <p className="text-slate-300">
                    <span className="font-mono text-xs text-primary-400">{ev.action}</span>
                    {" · "}{ev.entityType}
                  </p>
                  <p className="text-xs text-slate-500">{ev.actorEmail ?? "system"} · {new Date(ev.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasPermission("audit.view") && (
          <Link to={`${base}/admin`} className="mt-4 inline-block text-sm text-primary-400 hover:text-primary-300">Audit log →</Link>
        )}
      </div>
    </div>
  );
};
