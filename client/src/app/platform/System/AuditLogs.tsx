import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ScrollText,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  Shield,
  X,
  ChevronRight,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type AuditRow = {
  id: string;
  source: "school" | "platform";
  action: string;
  entityType: string;
  entityId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  actor: string | null;
  ip: string | null;
  createdAt: string;
  hasDiff: boolean;
};

type AuditHub = {
  summary: {
    total: number;
    last24h: number;
    schoolEvents: number;
    platformEvents: number;
    schoolsWithActivity: number;
    uniqueActions: number;
    topActions: { action: string; count: number }[];
  };
  schools: { id: string; slug: string; name: string }[];
  events: AuditRow[];
};

type AuditDetail = AuditRow & {
  beforeJson?: unknown;
  afterJson?: unknown;
};

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

function SourceBadge({ source }: { source: AuditRow["source"] }) {
  if (source === "platform") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-violet-50 text-violet-700 ring-violet-600/20">
        <Shield size={11} /> Platform
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-500/20">
      <Building2 size={11} /> School ERP
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

export const AuditLogs: React.FC = () => {
  const { toast } = useToast();
  const [hub, setHub] = useState<AuditHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "school" | "platform">("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (schoolFilter !== "all") params.set("tenantId", schoolFilter);
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (daysFilter !== "all") params.set("days", daysFilter);
      params.set("limit", "500");
      try {
        const res = await api.get(`/api/platform/audit?${params}`);
        setHub(res.data as AuditHub);
      } catch {
        const legacy = await api.get(`/api/platform/audit-logs?limit=500`);
        const events = (legacy.data ?? []) as AuditRow[];
        setHub({
          summary: {
            total: events.length,
            last24h: events.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 86400000).length,
            schoolEvents: events.filter((e) => e.source === "school").length,
            platformEvents: events.filter((e) => e.source === "platform").length,
            schoolsWithActivity: new Set(events.filter((e) => e.tenantId).map((e) => e.tenantId)).size,
            uniqueActions: new Set(events.map((e) => e.action)).size,
            topActions: [],
          },
          schools: [],
          events,
        });
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, sourceFilter, schoolFilter, daysFilter, actionFilter]);

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
        r.action.toLowerCase().includes(q) ||
        r.entityType.toLowerCase().includes(q) ||
        (r.entityId?.toLowerCase().includes(q) ?? false) ||
        (r.actor?.toLowerCase().includes(q) ?? false) ||
        (r.tenantName?.toLowerCase().includes(q) ?? false) ||
        (r.tenantSlug?.toLowerCase().includes(q) ?? false) ||
        (r.ip?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [hub, search]);

  const openDetail = async (row: AuditRow) => {
    setDetailLoading(true);
    setDetail({ ...row });
    try {
      const res = await api.get(`/api/platform/audit/${row.source}/${row.id}`);
      setDetail(res.data as AuditDetail);
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
              <ScrollText size={20} className="text-blue-600" />
              Audit log
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Immutable trail of school ERP changes and platform operator actions across all tenants.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 self-start"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Events loaded", value: String(summary?.total ?? 0) },
          { label: "Last 24 hours", value: String(summary?.last24h ?? 0) },
          { label: "School ERP", value: String(summary?.schoolEvents ?? 0) },
          { label: "Platform ops", value: String(summary?.platformEvents ?? 0) },
          { label: "Schools active", value: String(summary?.schoolsWithActivity ?? 0) },
          { label: "Unique actions", value: String(summary?.uniqueActions ?? 0) },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {(summary?.topActions?.length ?? 0) > 0 && (
        <div className={`${CARD} p-3`}>
          <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Top actions in view</p>
          <div className="flex flex-wrap gap-2">
            {summary!.topActions.map((t) => (
              <button
                key={t.action}
                type="button"
                onClick={() => setActionFilter(t.action)}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-blue-50 hover:border-blue-200"
              >
                <span className="font-mono">{t.action}</span>
                <span className="tabular-nums text-slate-400">{t.count}</span>
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
            placeholder="Search action, entity, actor, school, IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input
          className="input text-sm w-auto min-w-[160px]"
          placeholder="Filter action prefix…"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(true)}
        />
        <select
          className="input text-sm w-auto"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
        >
          <option value="all">All sources</option>
          <option value="school">School ERP</option>
          <option value="platform">Platform</option>
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
          <option value="365">Last year</option>
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
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr
                  key={`${r.source}-${r.id}`}
                  className="hover:bg-slate-50/80 cursor-pointer"
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
                        {r.tenantName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800">{r.action}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <span className="text-slate-500">{r.entityType}</span>
                    {r.entityId && (
                      <span className="block font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                        {r.entityId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate">{r.actor ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.hasDiff && <ChevronRight size={16} />}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No audit events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
          Showing {filtered.length} of {hub?.events.length ?? 0} loaded events (max 500). Click a row for before/after details.
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
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full animate-in slide-in-from-right">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Event detail</h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-100"
              >
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
                  <div><SourceBadge source={detail.source} /></div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Time</p>
                    <p className="text-slate-800">{formatDate(detail.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Action</p>
                    <p className="font-mono text-xs text-slate-800">{detail.action}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Entity</p>
                    <p className="text-slate-800">{detail.entityType}</p>
                    {detail.entityId && <p className="font-mono text-xs text-slate-500 break-all">{detail.entityId}</p>}
                  </div>
                  {detail.tenantSlug && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">School</p>
                      <Link to={`/platform/tenants/${detail.tenantSlug}`} className="text-blue-600 hover:underline">
                        {detail.tenantName}
                      </Link>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Actor</p>
                    <p className="text-slate-800">{detail.actor ?? "—"}</p>
                  </div>
                  {detail.ip && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">IP</p>
                      <p className="font-mono text-xs text-slate-600">{detail.ip}</p>
                    </div>
                  )}
                  <JsonBlock label="Before" value={detail.beforeJson} />
                  <JsonBlock label="After" value={detail.afterJson} />
                  {!detail.beforeJson && !detail.afterJson && (
                    <p className="text-xs text-slate-500">No structured before/after payload for this event.</p>
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
