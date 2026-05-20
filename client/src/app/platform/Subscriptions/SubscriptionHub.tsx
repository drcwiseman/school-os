import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  Tags,
  Building2,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { formatMoneyMinor, COUNTRY_OPTIONS } from "../../../lib/currencies";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type SubscriptionRow = {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  priceMonthly: number | null;
  resolvedCurrency: string | null;
  country: string | null;
  currency: string | null;
  startedAt: string | null;
  adminEmail: string | null;
};

type PlanOption = { id: string; code: string; name: string };

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    trial: "bg-amber-50 text-amber-700 ring-amber-600/20",
    suspended: "bg-red-50 text-red-700 ring-red-600/20",
  };
  const label = status === "active" ? "Active" : status === "trial" ? "Trial" : status === "suspended" ? "Suspended" : status;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export const SubscriptionHub: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "suspended">("all");
  const [showUnassigned, setShowUnassigned] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<SubscriptionRow | null>(null);
  const [formSlug, setFormSlug] = useState("");
  const [formPlan, setFormPlan] = useState("starter");
  const [formStarted, setFormStarted] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [subsRes, plansRes] = await Promise.all([
        api.get("/api/platform/subscriptions"),
        api.get("/api/platform/plans"),
      ]);
      setRows(subsRes.data ?? []);
      setPlans((plansRes.data ?? []).map((p: PlanOption) => ({ id: p.id, code: p.code, name: p.name })));
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

  const stats = useMemo(() => {
    const withPlan = rows.filter((r) => r.planCode);
    const unassigned = rows.filter((r) => !r.planCode);
    return {
      total: rows.length,
      subscribed: withPlan.length,
      unassigned: unassigned.length,
      active: rows.filter((r) => r.status === "active").length,
      trial: rows.filter((r) => r.status === "trial").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (planFilter === "unassigned" && r.planCode) return false;
      if (planFilter !== "all" && planFilter !== "unassigned" && (r.planCode ?? "") !== planFilter) return false;
      if (!showUnassigned && !r.planCode) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.planName?.toLowerCase().includes(q) ?? false) ||
        (r.adminEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, planFilter, statusFilter, showUnassigned]);

  const openAssign = (row?: SubscriptionRow) => {
    setEditRow(row ?? null);
    setFormSlug(row?.slug ?? "");
    setFormPlan(row?.planCode ?? plans[0]?.code ?? "starter");
    setFormStarted(row?.startedAt ? row.startedAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const saveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSlug) return;
    setSaving(true);
    try {
      const startedAt = formStarted ? new Date(formStarted).toISOString() : undefined;
      if (editRow?.planCode) {
        await api.patch(`/api/platform/subscriptions/${formSlug}`, {
          planCode: formPlan,
          startedAt,
        });
        toast("Subscription updated", "success");
      } else {
        await api.post("/api/platform/subscriptions", {
          tenantSlug: formSlug,
          planCode: formPlan,
          startedAt,
        });
        toast("Subscription assigned", "success");
      }
      setModalOpen(false);
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeSubscription = async (row: SubscriptionRow) => {
    if (!window.confirm(`Remove plan from "${row.name}"? The school will have no subscription tier until reassigned.`)) return;
    try {
      await api.delete(`/api/platform/subscriptions/${row.slug}`);
      toast("Subscription removed", "success");
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const unassignedSchools = useMemo(
    () => rows.filter((r) => !r.planCode),
    [rows],
  );

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
              <CreditCard size={20} className="text-blue-600" />
              School subscriptions
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Live subscriptions — which plan each school is on, when it started, and billing context.
              To edit plan tiers and prices, use{" "}
              <Link to="/platform/subscriptions/plans" className="text-blue-600 font-medium hover:underline inline-flex items-center gap-0.5">
                <Tags size={12} /> Plans &amp; Pricing
              </Link>.
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
            <button
              type="button"
              onClick={() => openAssign()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              Assign subscription
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Schools", value: stats.total },
          { label: "Subscribed", value: stats.subscribed },
          { label: "Unassigned", value: stats.unassigned },
          { label: "Active", value: stats.active },
          { label: "Trial", value: stats.trial },
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
            placeholder="Search school, plan, admin email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-auto" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="all">All plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.code}>{p.name}</option>
          ))}
          <option value="unassigned">Unassigned only</option>
        </select>
        <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 px-2">
          <input type="checkbox" checked={showUnassigned} onChange={(e) => setShowUnassigned(e.target.checked)} />
          Show schools without a plan
        </label>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">MRR</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.tenantId} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={16} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <Link to={`/platform/tenants/${r.slug}`} className="font-medium text-slate-900 hover:text-blue-600 truncate block">
                          {r.name}
                        </Link>
                        <p className="text-[11px] text-slate-500 font-mono truncate">/s/{r.slug}</p>
                        {r.adminEmail && <p className="text-[10px] text-slate-400 truncate">{r.adminEmail}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.planName ? (
                      <span className="font-medium text-slate-800">{r.planName}</span>
                    ) : (
                      <span className="text-amber-600 text-xs font-medium">No plan assigned</span>
                    )}
                    {r.planCode && <p className="text-[10px] font-mono text-slate-400">{r.planCode}</p>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {r.priceMonthly != null && r.resolvedCurrency
                      ? formatMoneyMinor(r.priceMonthly, r.resolvedCurrency)
                      : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(r.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.country ? COUNTRY_OPTIONS.find((c) => c.code === r.country)?.name ?? r.country : "—"}
                    {r.currency && <span className="font-mono ml-1">{r.currency}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <a
                        href={`/s/${r.slug}/login`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                        title="Open school"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button type="button" onClick={() => openAssign(r)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="Edit subscription">
                        <Pencil size={15} />
                      </button>
                      {r.planCode && (
                        <button type="button" onClick={() => removeSubscription(r)} className="p-1.5 rounded text-slate-500 hover:bg-red-50 hover:text-red-600" title="Remove subscription">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">No subscriptions match your filters.</p>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editRow?.planCode ? "Edit subscription" : "Assign subscription"}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveSubscription} className="p-6 space-y-4">
              {editRow ? (
                <p className="text-sm text-slate-600">
                  School: <span className="font-semibold text-slate-900">{editRow.name}</span>
                </p>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-600">School</label>
                  <select
                    className="input text-sm mt-1 w-full"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                  >
                    <option value="">Select school…</option>
                    {unassignedSchools.map((s) => (
                      <option key={s.tenantId} value={s.slug}>{s.name}</option>
                    ))}
                    {unassignedSchools.length === 0 && rows.map((s) => (
                      <option key={s.tenantId} value={s.slug}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600">Subscription plan</label>
                <select className="input text-sm mt-1 w-full" value={formPlan} onChange={(e) => setFormPlan(e.target.value)} required>
                  {plans.map((p) => (
                    <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Started date</label>
                <input type="date" className="input text-sm mt-1 w-full" value={formStarted} onChange={(e) => setFormStarted(e.target.value)} />
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : editRow?.planCode ? "Update subscription" : "Assign subscription"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
