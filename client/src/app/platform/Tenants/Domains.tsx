import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Globe,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type DomainRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  subdomain?: string | null;
  customDomain?: string | null;
  domainVerified?: boolean;
  adminEmail?: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    trial: "bg-amber-50 text-amber-700 ring-amber-600/20",
    suspended: "bg-red-50 text-red-700 ring-red-600/20",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function DomainStatus({ row }: { row: DomainRow }) {
  if (row.customDomain) {
    return row.domainVerified ? (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <CheckCircle2 size={14} /> Verified
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
        <AlertCircle size={14} /> Pending DNS
      </span>
    );
  }
  return <span className="text-xs text-slate-400">Subdomain only</span>;
}

export const DomainsHub: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "suspended">("all");
  const [domainFilter, setDomainFilter] = useState<"all" | "custom" | "verified" | "pending" | "subdomain">("all");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/tenants");
      setRows(res.data ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: rows.length,
    custom: rows.filter((r) => r.customDomain).length,
    verified: rows.filter((r) => r.domainVerified).length,
    pending: rows.filter((r) => r.customDomain && !r.domainVerified).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (domainFilter === "custom" && !r.customDomain) return false;
      if (domainFilter === "verified" && !r.domainVerified) return false;
      if (domainFilter === "pending" && (!r.customDomain || r.domainVerified)) return false;
      if (domainFilter === "subdomain" && r.customDomain) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.subdomain?.toLowerCase().includes(q) ?? false) ||
        (r.customDomain?.toLowerCase().includes(q) ?? false) ||
        (r.adminEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, statusFilter, domainFilter]);

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
              <Globe size={20} className="text-blue-600" />
              Domains & routing
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Subdomains (<span className="font-mono">/s/school-slug</span>) and custom domains per school. Configure DNS on each school&apos;s detail page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Schools", value: stats.total },
          { label: "Custom domain", value: stats.custom },
          { label: "Verified", value: stats.verified },
          { label: "Pending DNS", value: stats.pending },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search school, slug, subdomain, custom domain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
        <select className="input text-sm w-auto" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value as typeof domainFilter)}>
          <option value="all">All domain types</option>
          <option value="subdomain">Subdomain only</option>
          <option value="custom">Has custom domain</option>
          <option value="verified">Verified custom</option>
          <option value="pending">Pending verification</option>
        </select>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Path / subdomain</th>
                <th className="px-4 py-3">Custom domain</th>
                <th className="px-4 py-3">SSL / DNS</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={16} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <Link to={`/platform/tenants/${t.slug}`} className="font-medium text-slate-900 hover:text-blue-600 truncate block">
                          {t.name}
                        </Link>
                        {t.adminEmail && <p className="text-[10px] text-slate-400 truncate">{t.adminEmail}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-700">/s/{t.slug}</span>
                    {t.subdomain && t.subdomain !== t.slug && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">sub: {t.subdomain}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[180px] truncate">
                    {t.customDomain ?? "—"}
                  </td>
                  <td className="px-4 py-3"><DomainStatus row={t} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <a
                        href={`/s/${t.slug}/login`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                        title="Open school"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <Link
                        to={`/platform/tenants/${t.slug}`}
                        className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        DNS & verify
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">No schools match your filters.</p>
        )}
      </div>
    </div>
  );
};
