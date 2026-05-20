import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ListTodo,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";
const POLL_MS = 5000;

type JobRow = {
  id: string;
  type: string;
  status: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
  hasDetail: boolean;
};

type QueueHub = {
  workerActive: boolean;
  pollIntervalSec: number;
  summary: {
    total: number;
    pending: number;
    running: number;
    done: number;
    failed: number;
    last24h: number;
    byType: Record<string, number>;
  };
  schools: { id: string; slug: string; name: string }[];
  jobs: JobRow[];
};

type JobDetail = Record<string, unknown> & {
  id: string;
  type: string;
  status: string;
  payload?: unknown;
  result?: unknown;
  error?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  running: "bg-blue-50 text-blue-700 ring-blue-600/20",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const Icon =
    status === "failed" ? AlertCircle : status === "pending" || status === "running" ? Clock : CheckCircle2;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      <Icon size={11} /> {status}
    </span>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">{label}</p>
      <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-48 text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export const QueueMonitor: React.FC = () => {
  const { toast } = useToast();
  const [hub, setHub] = useState<QueueHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("all");

  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter.trim()) params.set("type", typeFilter.trim());
      if (schoolFilter !== "all") params.set("tenantId", schoolFilter);
      if (daysFilter !== "all") params.set("days", daysFilter);
      params.set("limit", "500");
      const res = await api.get(`/api/platform/queue?${params}`);
      setHub(res.data as QueueHub);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, statusFilter, typeFilter, schoolFilter, daysFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const summary = hub?.summary;

  const filtered = useMemo(() => {
    if (!hub) return [];
    const q = search.trim().toLowerCase();
    return hub.jobs.filter((j) => {
      if (!q) return true;
      return (
        j.type.toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q) ||
        (j.error?.toLowerCase().includes(q) ?? false) ||
        (j.tenantName?.toLowerCase().includes(q) ?? false) ||
        (j.tenantSlug?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [hub, search]);

  const openDetail = async (id: string) => {
    setDetail({ id, type: "…", status: "pending" });
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/platform/queue/${id}`);
      setDetail(res.data as JobDetail);
    } catch (e: any) {
      toast(e.message, "error");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const runWorker = async () => {
    setActing(true);
    try {
      await api.post("/api/platform/queue/process");
      toast("Worker tick triggered", "success");
      load(true);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setActing(false);
    }
  };

  const retryJob = async (id: string) => {
    setActing(true);
    try {
      const res = await api.post(`/api/platform/queue/${id}/retry`);
      setDetail(res.data as JobDetail);
      toast("Job re-queued", "success");
      load(true);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const jobTypes = Object.keys(summary?.byType ?? {});

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ListTodo size={20} className="text-blue-600" />
              Job queue
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              In-process worker for messaging campaigns — polls every {hub?.pollIntervalSec ?? 5}s and processes up to 5 pending jobs per tick.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={runWorker}
              disabled={acting}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Play size={14} />
              Process now
            </button>
            <Link
              to="/platform/logs"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              System logs
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: summary?.total ?? 0 },
          { label: "Pending", value: summary?.pending ?? 0, accent: "text-amber-600" },
          { label: "Running", value: summary?.running ?? 0, accent: "text-blue-600" },
          { label: "Done", value: summary?.done ?? 0, accent: "text-emerald-600" },
          { label: "Failed", value: summary?.failed ?? 0, accent: "text-rose-600" },
          { label: "Updated 24h", value: summary?.last24h ?? 0 },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${s.accent ?? "text-slate-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {jobTypes.length > 0 && (
        <div className={`${CARD} p-3`}>
          <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Job types</p>
          <div className="flex flex-wrap gap-2">
            {jobTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-blue-50"
              >
                <span className="font-mono">{t}</span>
                <span className="tabular-nums text-slate-400">{summary?.byType[t]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search type, school, error…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="done">Done</option>
          <option value="failed">Failed</option>
        </select>
        <input
          className="input text-sm w-auto min-w-[140px]"
          placeholder="Job type filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
        <select className="input text-sm w-auto max-w-[200px]" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="all">All schools</option>
          {(hub?.schools ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="input text-sm w-auto" value={daysFilter} onChange={(e) => setDaysFilter(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <button type="button" onClick={() => load(true)} className="inline-flex rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
          Apply
        </button>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((j) => (
                <tr
                  key={j.id}
                  className={`hover:bg-slate-50/80 cursor-pointer ${j.status === "failed" ? "bg-rose-50/20" : ""}`}
                  onClick={() => openDetail(j.id)}
                >
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(j.updatedAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800">{j.type}</td>
                  <td className="px-4 py-3">
                    {j.tenantSlug ? (
                      <Link
                        to={`/platform/tenants/${j.tenantSlug}`}
                        className="inline-flex items-center gap-1 text-slate-800 hover:text-blue-600 truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Building2 size={12} className="text-slate-400 shrink-0" />
                        {j.tenantName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{formatDuration(j.durationMs)}</td>
                  <td className="px-4 py-3 text-xs text-rose-600 max-w-[200px] truncate">{j.error ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{j.hasDetail && <ChevronRight size={16} />}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No jobs in queue. Send a messaging campaign from a school to enqueue work.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
          Showing {filtered.length} of {hub?.jobs.length ?? 0} loaded jobs.
          {autoRefresh && ` Auto-refreshing every ${POLL_MS / 1000}s.`}
        </p>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900 font-mono truncate">{detail.type}</h3>
              <button type="button" onClick={() => setDetail(null)} className="p-1 rounded-md text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <StatusBadge status={String(detail.status)} />
                  {typeof detail.updatedAt === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Last updated</p>
                      <p>{formatDate(detail.updatedAt)}</p>
                    </div>
                  )}
                  {detail.tenantSlug && typeof detail.tenantName === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">School</p>
                      <Link to={`/platform/tenants/${detail.tenantSlug}`} className="text-blue-600 hover:underline">
                        {detail.tenantName}
                      </Link>
                    </div>
                  )}
                  {(detail.status === "failed" || detail.status === "done") && (
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => retryJob(String(detail.id))}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      Re-queue job
                    </button>
                  )}
                  <JsonBlock label="Payload" value={detail.payload} />
                  <JsonBlock label="Result" value={detail.result} />
                  <JsonBlock label="Error" value={detail.error} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
