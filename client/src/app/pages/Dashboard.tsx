import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { Users, UserCheck, FileWarning, UserPlus, Loader2 } from "lucide-react";

export const Dashboard: React.FC = () => {
  const { user, schoolSlug, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/dashboard`)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const cards = [
    { label: "Active students", value: stats?.activeStudents ?? 0, sub: stats?.totalStudents != null ? `${stats.totalStudents} total` : undefined, icon: Users, color: "text-blue-400", link: "students", perm: "students.view" },
    { label: "Unpaid invoices", value: stats?.unpaidInvoices ?? 0, icon: FileWarning, color: "text-amber-400", link: "finance", perm: "finance.view" },
    { label: "Admissions pipeline", value: stats?.applicantsInPipeline ?? 0, icon: UserPlus, color: "text-indigo-400", link: "admissions", perm: "admissions.view" },
    { label: "Attendance today", value: stats?.todayAttendanceSessions ?? 0, sub: "sessions", icon: UserCheck, color: "text-emerald-400", link: "attendance", perm: "attendance.view" },
  ].filter((c) => !c.perm || hasPermission(c.perm));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back to {schoolSlug}, {user?.firstName}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((stat) => {
          const Icon = stat.icon;
          const inner = (
            <div className="card p-6 flex items-center gap-4 hover:border-slate-600 transition-colors">
              <div className={`p-4 rounded-xl bg-slate-800/50 ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-0.5">{stat.value}</p>
                {stat.sub && <p className="text-xs text-slate-500">{stat.sub}</p>}
              </div>
            </div>
          );
          return stat.link ? (
            <Link key={stat.label} to={`/s/${schoolSlug}/${stat.link}`}>{inner}</Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          );
        })}
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-white mb-4">Recent activity</h3>
        {(stats?.recentActivity ?? []).length === 0 ? (
          <p className="text-slate-500 text-sm">No recent audit events.</p>
        ) : (
          <ul className="space-y-3">
            {(stats.recentActivity as any[]).map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-slate-300">
                    <span className="font-mono text-xs text-primary-400">{a.action}</span>
                    {" · "}{a.entityType}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.actorEmail ?? "system"} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasPermission("audit.view") && (
          <Link to={`/s/${schoolSlug}/admin`} className="inline-block mt-4 text-sm text-primary-400 hover:text-primary-300">
            View full audit log →
          </Link>
        )}
      </div>
    </div>
  );
};
