import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Pencil,
  SlidersHorizontal,
  UserCog,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { COUNTRY_OPTIONS } from "../../../lib/currencies";
import { SchoolFormModal, type TenantRow } from "../components/SchoolFormModal";
import { SchoolLoginsPanel } from "../components/SchoolLoginsPanel";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type TenantListRow = TenantRow & {
  createdAt?: string;
  updatedAt?: string;
  subdomain?: string | null;
  customDomain?: string | null;
  domainVerified?: boolean;
  country?: string;
  currency?: string;
  timezone?: string;
  studentCount?: number;
  staffCount?: number;
  erpUserCount?: number;
  adminEmail?: string | null;
  loginUrl?: string;
};

type FeatureRow = { code: string; name: string; enabled: boolean };

function countryLabel(code?: string) {
  if (!code) return "—";
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name ?? code;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    trial: "bg-amber-50 text-amber-700 ring-amber-600/20",
    suspended: "bg-red-50 text-red-700 ring-red-600/20",
  };
  const label = status === "active" ? "Active" : status === "trial" ? "Trial" : status === "suspended" ? "Suspended" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>
      {label}
    </span>
  );
}

export const TenantHub: React.FC = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "suspended">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editTenant, setEditTenant] = useState<TenantListRow | null>(null);
  const [featuresSlug, setFeaturesSlug] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/tenants");
      setTenants(res.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === "active").length;
    const trial = tenants.filter((t) => t.status === "trial").length;
    const suspended = tenants.filter((t) => t.status === "suspended").length;
    const students = tenants.reduce((n, t) => n + (t.studentCount ?? 0), 0);
    return { total, active, trial, suspended, students };
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.adminEmail?.toLowerCase().includes(q) ?? false) ||
        (t.planName?.toLowerCase().includes(q) ?? false) ||
        (t.planCode?.toLowerCase().includes(q) ?? false) ||
        (t.customDomain?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tenants, search, statusFilter]);

  const openCreate = () => {
    setModalMode("create");
    setEditTenant(null);
    setModalOpen(true);
  };

  const openEdit = (t: TenantListRow) => {
    setModalMode("edit");
    setEditTenant(t);
    setModalOpen(true);
  };

  const updateStatus = async (slug: string, status: string) => {
    try {
      await api.patch(`/api/platform/tenants/${slug}/status`, { status });
      toast("Status updated", "success");
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const [loginSlug, setLoginSlug] = useState<string | null>(null);
  const [loginReadOnly, setLoginReadOnly] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const enterSchool = async (slug: string, readOnly = false) => {
    setLoginSlug(slug);
    setLoginLoading(true);
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/impersonate`, { readOnly });
      const url = res.data.url?.startsWith("http")
        ? res.data.url
        : `${window.location.origin}${res.data.url}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast(readOnly ? "Opened school (read-only shadow)" : "Opened school as administrator", "success");
      setLoginSlug(null);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoginLoading(false);
    }
  };

  const loginAsSchoolAdmin = async () => {
    if (!loginSlug) return;
    await enterSchool(loginSlug, loginReadOnly);
  };

  const openFeatures = async (slug: string) => {
    setFeaturesSlug(slug);
    setFeaturesLoading(true);
    try {
      const res = await api.get(`/api/platform/tenants/${slug}/features`);
      setFeatures(res.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
      setFeaturesSlug(null);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const saveFeatures = async () => {
    if (!featuresSlug) return;
    setSavingFeatures(true);
    try {
      await api.patch(`/api/platform/tenants/${featuresSlug}/features`, {
        features: features.map((f) => ({ code: f.code, enabled: f.enabled })),
      });
      toast("Module flags saved", "success");
      setFeaturesSlug(null);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingFeatures(false);
    }
  };

  const schoolUrl = (t: TenantListRow) =>
    t.loginUrl?.startsWith("http") ? t.loginUrl : `${window.location.origin}/s/${t.slug}/login`;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Schools</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage tenant schools, subscriptions, and module access from one directory.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={15} />
            Add school
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total schools", value: stats.total, sub: `${stats.students} students` },
          { label: "Active", value: stats.active, sub: "Paying / live", accent: "text-emerald-600" },
          { label: "Trial", value: stats.trial, sub: "Evaluation", accent: "text-amber-600" },
          { label: "Suspended", value: stats.suspended, sub: "Access paused", accent: "text-red-600" },
          { label: "Directory", value: filtered.length, sub: "Matching filters", accent: "text-slate-600" },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3 min-w-0`}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">{s.label}</p>
            <p className={`text-xl font-bold tabular-nums mt-0.5 ${s.accent ?? "text-slate-900"}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <SchoolLoginsPanel
        schools={filtered.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          status: t.status,
          adminEmail: t.adminEmail ?? null,
          loginUrl: t.loginUrl ?? `/s/${t.slug}/login`,
          erpUserCount: t.erpUserCount,
        }))}
        onLogin={enterSchool}
        loginLoadingSlug={loginLoading ? loginSlug : null}
      />

      {/* Toolbar */}
      <div className={`${CARD} p-3 flex flex-col sm:flex-row gap-3 sm:items-center`}>
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, slug, admin email, plan, domain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shrink-0 sm:w-40"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className={`${CARD} hidden md:block overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <Link to={`/platform/tenants/${t.slug}`} className="font-semibold text-slate-900 hover:text-blue-600 truncate block">
                          {t.name}
                        </Link>
                        <p className="text-xs text-slate-500 font-mono truncate">/{t.slug}</p>
                        {t.adminEmail && (
                          <p className="text-xs text-slate-500 truncate mt-0.5" title={t.adminEmail}>{t.adminEmail}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-slate-800">{t.planName ?? t.planCode ?? "—"}</span>
                    {t.planCode && t.planName && (
                      <p className="text-xs text-slate-500">{t.planCode}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    <p className="text-xs">{countryLabel(t.country)}</p>
                    <p className="text-xs font-mono text-slate-500">{t.currency ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-700">
                    <p>{t.studentCount ?? 0} <span className="text-slate-400 text-xs">students</span></p>
                    <p className="text-xs text-slate-500">{t.erpUserCount ?? 0} ERP · {t.staffCount ?? 0} staff</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1"
                      value={t.status}
                      onChange={(e) => updateStatus(t.slug, e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Module flags"
                        onClick={() => openFeatures(t.slug)}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                      >
                        <SlidersHorizontal size={15} />
                      </button>
                      <button
                        type="button"
                        title="Login as school admin"
                        onClick={() => {
                          setLoginSlug(t.slug);
                          setLoginReadOnly(false);
                        }}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                      >
                        <UserCog size={15} />
                      </button>
                      <button type="button" title="Edit" onClick={() => openEdit(t)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
                        <Pencil size={15} />
                      </button>
                      <Link to={`/platform/tenants/${t.slug}`} className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50" title="Details">
                        <ChevronRight size={15} />
                      </Link>
                      <a
                        href={schoolUrl(t)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                        title="Open school login"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {tenants.length === 0 ? "No schools provisioned yet." : "No schools match your filters."}
            {tenants.length === 0 && (
              <button type="button" onClick={openCreate} className="mt-3 text-blue-600 font-medium hover:underline">
                Add your first school
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((t) => (
          <div key={t.id} className={`${CARD} p-4 space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/platform/tenants/${t.slug}`} className="font-semibold text-slate-900 hover:text-blue-600 truncate block">
                  {t.name}
                </Link>
                <p className="text-xs font-mono text-slate-500">/{t.slug}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div><span className="text-slate-400">Plan</span><p className="font-medium text-slate-800">{t.planName ?? "—"}</p></div>
              <div><span className="text-slate-400">Students</span><p className="font-medium text-slate-800 tabular-nums">{t.studentCount ?? 0}</p></div>
              <div><span className="text-slate-400">Country</span><p className="font-medium text-slate-800 truncate">{countryLabel(t.country)}</p></div>
              <div><span className="text-slate-400">Currency</span><p className="font-medium text-slate-800">{t.currency ?? "—"}</p></div>
            </div>
            {t.adminEmail && <p className="text-xs text-slate-500 truncate">{t.adminEmail}</p>}
            <select
              className="w-full text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5"
              value={t.status}
              onChange={(e) => updateStatus(t.slug, e.target.value)}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
            </select>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to={`/platform/tenants/${t.slug}`} className="flex-1 text-center rounded-md bg-blue-600 py-2 text-xs font-medium text-white">
                View details
              </Link>
              <button type="button" onClick={() => openEdit(t)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                Edit
              </button>
              <button type="button" onClick={() => openFeatures(t.slug)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                Modules
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>No schools to display.</div>
        )}
      </div>

      <SchoolFormModal
        open={modalOpen}
        mode={modalMode}
        tenant={editTenant}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(true)}
      />

      {/* Feature flags drawer */}
      {featuresSlug && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={() => setFeaturesSlug(null)}>
          <div
            className="w-full max-w-md h-full bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Module flags</h2>
                <p className="text-xs text-slate-500 truncate font-mono">/{featuresSlug}</p>
              </div>
              <button type="button" onClick={() => setFeaturesSlug(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {featuresLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : features.length === 0 ? (
                <p className="text-sm text-slate-500">No modules in catalog.</p>
              ) : (
                features.map((f) => (
                  <label
                    key={f.code}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800 min-w-0 truncate">{f.name}</span>
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) =>
                        setFeatures((prev) =>
                          prev.map((x) => (x.code === f.code ? { ...x, enabled: e.target.checked } : x)),
                        )
                      }
                      className="shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                disabled={savingFeatures || featuresLoading}
                onClick={saveFeatures}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingFeatures ? "Saving…" : "Save module flags"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loginSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={() => setLoginSlug(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Login as school admin</h3>
            <p className="text-sm text-slate-600">
              Opens the school ERP in a new tab signed in as that school&apos;s administrator (or first active user).
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={loginReadOnly}
                onChange={(e) => setLoginReadOnly(e.target.checked)}
              />
              Read-only shadow mode (cannot edit data)
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={() => setLoginSlug(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-1"
                disabled={loginLoading}
                onClick={loginAsSchoolAdmin}
              >
                {loginLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Open school ERP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
