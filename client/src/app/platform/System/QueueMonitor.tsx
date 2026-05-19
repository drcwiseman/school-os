import React, { useEffect, useState } from "react";
import { api } from "../../api/client";

export const QueueMonitor: React.FC = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const tick = () => api.get("/api/platform/stats").then((s) => setStats(s.data));
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Worker queue monitor</h2>
      <p className="text-xs text-slate-400">Campaign / messaging jobs polled every 5 seconds on the Node worker.</p>
      <div className="grid sm:grid-cols-4 gap-4">
        <Card label="Total jobs" value={stats?.totalJobs ?? "—"} />
        <Card label="Pending" value={stats?.pendingJobs ?? "—"} accent="amber" />
        <Card label="Running" value={stats?.runningJobs ?? "—"} accent="blue" />
        <Card label="Failed" value={stats?.failedJobs ?? "—"} accent="rose" />
      </div>
    </div>
  );
};

function Card({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const color = accent === "rose" ? "text-rose-400" : accent === "amber" ? "text-amber-400" : accent === "blue" ? "text-blue-400" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm rounded-xl p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}
