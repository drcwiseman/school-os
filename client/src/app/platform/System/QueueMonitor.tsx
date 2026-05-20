import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListTodo, RefreshCw } from "lucide-react";
import { api } from "../../api/client";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

export const QueueMonitor: React.FC = () => {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const tick = () => {
    api.get("/api/platform/stats")
      .then((s) => setStats(s.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ListTodo size={20} className="text-blue-600" />
              Worker queue monitor
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Campaign and messaging jobs polled every 5 seconds on the Node worker.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={tick}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <Link
              to="/platform/logs"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Full system logs
            </Link>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Total jobs" value={loading ? "—" : stats?.totalJobs ?? 0} />
        <Card label="Pending" value={loading ? "—" : stats?.pendingJobs ?? 0} accent="amber" />
        <Card label="Running" value={loading ? "—" : stats?.runningJobs ?? 0} accent="blue" />
        <Card label="Failed" value={loading ? "—" : stats?.failedJobs ?? 0} accent="rose" />
      </div>
    </div>
  );
};

function Card({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const color =
    accent === "rose" ? "text-rose-600" : accent === "amber" ? "text-amber-600" : accent === "blue" ? "text-blue-600" : "text-slate-900";
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-2 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
