import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HardDrive,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  ListTodo,
  Mail,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type LogRow = {
  id: string;
  source: "job" | "delivery";
  status: string;
  level: "info" | "warn" | "error";
  message: string;
  subtext: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  createdAt: string;
  updatedAt: string | null;
  hasDetail: boolean;
};

type LogsHub = {
  summary: {
    total: number;
    last24h: number;
    jobsTotal: number;
    jobsPending: number;
    jobsRunning: number;
    jobsFailed: number;
    jobsDone: number;
    deliveriesTotal: number;
    deliveriesFailed: number;
    schoolsWithActivity: number;
  };
  schools: { id: string; slug: string; name: string }[];
  events: LogRow[];
};

type LogDetail = Record<string, unknown> & { source: "job" | "delivery" };

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
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

function SourceBadge({ source }: { source: LogRow["source"] }) {
  if (source === "job") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20">
        <ListTodo size={11} /> Background job
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
      <Mail size={11} /> Message delivery
    </span>
  );
}

function StatusBadge({ status, level }: { status: string; level: LogRow["level"] }) {
  const styles =
    level === "error"
      ? "bg-rose-50 text-rose-700 ring-rose-600/20"
      : level === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
        : "bg-slate-100 text-slate-700 ring-slate-500/20";
  const Icon = level === "error" ? AlertCircle : level === "warn" ? Clock : CheckCircle2;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${styles}`}>
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

export const SystemLogsHub: React.FC = () => {
  const { toast } = useToast();
  const [hub, setHub] = useState<LogsHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "job" | "delivery">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("all");
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (schoolFilter !== "all") params.set("tenantId", schoolFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (daysFilter !== "all") params.set("days", daysFilter);
      params.set("limit", "500");
      const res = await api.get(`/api/platform/logs?${params}`);
      setHub(res.data as LogsHub);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, sourceFilter, schoolFilter, statusFilter, daysFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = hub?.summary;

  const filtered = useMemo(() => {
    if (!hub) return [];
    const q = search.trim().toLowerCase();
    return hub.events.filter((r) => {
      if (!q) return true;
      return (
        r.message.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.subtext?.toLowerCase().includes(q) ?? false) ||
        (r.tenantName?.toLowerCase().includes(q) ?? false) ||
        (r.tenantSlug?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [hub, search]);

  const openDetail = async (row: LogRow) => {
    setDetailLoading(true);
    setDetail({ source: row.source, message: row.message, status: row.status });
    try {
      const path = row.source === "job"
        ? `/api/platform/logs/job/${row.id}`
        : `/api/platform/logs/delivery/${row.id}`;
      const res = await api.get(path);
      setDetail(res.data as LogDetail);
    } catch (e: any) {
      toast(e.message, "error");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HardDrive size={20} className="text-blue-600" />
              System logs
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Background worker jobs and messaging delivery outcomes across all schools.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              to="/platform/system/queue"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Job queue monitor
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Events loaded", value: String(summary?.total ?? 0) },
          { label: "Last 24h", value: String(summary?.last24h ?? 0) },
          { label: "Jobs failed", value: String(summary?.jobsFailed ?? 0), accent: summary?.jobsFailed ? "text-rose-600" : undefined },
          { label: "Jobs pending", value: String(summary?.jobsPending ?? 0) },
          { label: "Jobs running", value: String(summary?.jobsRunning ?? 0) },
          { label: "Jobs done", value: String(summary?.jobsDone ?? 0) },
          { label: "Deliveries failed", value: String(summary?.deliveriesFailed ?? 0), accent: summary?.deliveriesFailed ? "text-rose-600" : undefined },
          { label: "Schools", value: String(summary?.schoolsWithActivity ?? 0) },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${s.accent ?? "text-slate-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search job type, recipient, school, error…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input text-sm w-auto"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
        >
          <option value="all">All sources</option>
          <option value="job">Background jobs</option>
          <option value="delivery">Message delivery</option>
        </select>
        <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="done">Done</option>
          <option value="failed">Failed</option>
          <option value="sent">Sent</option>
        </select>
        <select
          className="input text-sm w-auto max-w-[220px]"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          <option value="all">All schools</option>
          {(hub?.schools ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="input text-sm w-auto" value={daysFilter} onChange={(e) => setDaysFilter(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        <button
          type="button"
          onClick={() => load(true)}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Apply filters
        </button>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr
                  key={`${r.source}-${r.id}`}
                  className={`hover:bg-slate-50/80 cursor-pointer ${r.level === "error" ? "bg-rose-50/30" : ""}`}
                  onClick={() => openDetail(r)}
                >
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3"><SourceBadge source={r.source} /></td>
                  <td className="px-4 py-3 min-w-[120px]">
                    {r.tenantSlug ? (
                      <Link
                        to={`/platform/tenants/${r.tenantSlug}`}
                        className="font-medium text-slate-900 hover:text-blue-600 truncate block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          {r.tenantName}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">Platform</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <p className="font-mono text-xs text-slate-800 truncate">{r.message}</p>
                    {r.subtext && (
                      <p className={`text-[10px] mt-0.5 truncate ${r.level === "error" ? "text-rose-600" : "text-slate-500"}`}>
                        {r.subtext}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} level={r.level} /></td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.hasDetail && <ChevronRight size={16} />}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No system log events match your filters. Queue a messaging campaign or check the job worker.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
          Showing {filtered.length} of {hub?.events.length ?? 0} loaded events (max 500).
        </p>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setDetail(null)}
          />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Log detail</h3>
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
                  {detail.source && <SourceBadge source={detail.source as LogRow["source"]} />}
                  {typeof detail.createdAt === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Created</p>
                      <p>{formatDate(detail.createdAt)}</p>
                    </div>
                  )}
                  {typeof detail.updatedAt === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Updated</p>
                      <p>{formatDate(detail.updatedAt)}</p>
                    </div>
                  )}
                  {typeof detail.status === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Status</p>
                      <p className="capitalize">{detail.status}</p>
                    </div>
                  )}
                  {typeof detail.type === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Job type</p>
                      <p className="font-mono text-xs">{detail.type}</p>
                    </div>
                  )}
                  {typeof detail.channel === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Channel</p>
                      <p>{detail.channel}</p>
                    </div>
                  )}
                  {typeof detail.recipient === "string" && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Recipient</p>
                      <p className="font-mono text-xs break-all">{detail.recipient}</p>
                    </div>
                  )}
                  {typeof detail.tenantName === "string" && detail.tenantSlug && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">School</p>
                      <Link to={`/platform/tenants/${detail.tenantSlug}`} className="text-blue-600 hover:underline">
                        {detail.tenantName}
                      </Link>
                    </div>
                  )}
                  <JsonBlock label="Payload" value={detail.payload} />
                  <JsonBlock label="Result" value={detail.result} />
                  <JsonBlock label="Error" value={detail.error} />
                  {detail.providerRef != null && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Provider ref</p>
                      <p className="font-mono text-xs">{String(detail.providerRef)}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
