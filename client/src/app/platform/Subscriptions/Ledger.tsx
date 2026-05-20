import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Landmark,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { formatMoneyMinor, DEFAULT_CURRENCY } from "../../../lib/currencies";
import {
  BILLING_INTERVAL_LABELS,
  formatPeriodPrice,
  type BillingInterval,
} from "../../../lib/billing-intervals";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type LedgerData = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    saasMrr: number;
    saasArr: number;
    saasLifetimeTotal: number;
    feeVolumeTotal: number;
    feeVolume30d: number;
    activeBillableSchools: number;
    subscribedSchools: number;
    renewalsNext30d: number;
    overdueRenewals: number;
  };
  schools: Array<{
    tenantId: string;
    slug: string;
    name: string;
    status: string;
    planName: string | null;
    planCode: string | null;
    billingInterval: BillingInterval | null;
    resolvedCurrency: string | null;
    periodAmount: number | null;
    mrrMinor: number;
    mrrDisplayMinor: number;
    renewsAt: string | null;
    feeVolumeTotal: number;
    feeVolume30d: number;
    feeVolumeDisplayMinor: number;
    feeVolume30dDisplayMinor: number;
    overdue: boolean;
  }>;
  recentPayments: Array<{
    id: string;
    tenantSlug: string;
    tenantName: string;
    amount: number;
    currency: string;
    amountDisplayMinor: number;
    method: string;
    paidAt: string;
  }>;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

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

export const RevenueLedger: React.FC = () => {
  const { toast } = useToast();
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "suspended">("all");
  const [viewFilter, setViewFilter] = useState<"all" | "subscribed" | "overdue" | "fees">("all");
  const [tab, setTab] = useState<"schools" | "payments">("schools");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/revenue/ledger");
      setLedger(res.data);
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

  const cur = ledger?.displayCurrency ?? DEFAULT_CURRENCY;
  const summary = ledger?.summary;

  const filteredSchools = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.schools.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (viewFilter === "subscribed" && !r.planCode) return false;
      if (viewFilter === "overdue" && !r.overdue) return false;
      if (viewFilter === "fees" && r.feeVolumeDisplayMinor <= 0) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.planName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [ledger, search, statusFilter, viewFilter]);

  const filteredPayments = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.recentPayments.filter((p) => {
      if (!q) return true;
      return (
        p.tenantName.toLowerCase().includes(q) ||
        p.tenantSlug.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q)
      );
    });
  }, [ledger, search]);

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
              <Landmark size={20} className="text-blue-600" />
              Global revenue ledger
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Platform SaaS MRR from school subscriptions plus fee payment volume schools collect (converted to{" "}
              <span className="font-mono font-medium">{cur}</span> via {ledger?.fxProvider ?? "live FX"}).
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
              to="/platform/subscriptions"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Subscriptions
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "SaaS MRR", value: formatMoneyMinor(summary?.saasMrr ?? 0, cur) },
          { label: "SaaS ARR", value: formatMoneyMinor(summary?.saasArr ?? 0, cur) },
          { label: "Lifetime buyoffs", value: formatMoneyMinor(summary?.saasLifetimeTotal ?? 0, cur) },
          { label: "Fee volume (all)", value: formatMoneyMinor(summary?.feeVolumeTotal ?? 0, cur) },
          { label: "Fees (30 days)", value: formatMoneyMinor(summary?.feeVolume30d ?? 0, cur) },
          { label: "Subscribed", value: String(summary?.subscribedSchools ?? 0) },
          { label: "Renewals (30d)", value: String(summary?.renewalsNext30d ?? 0) },
          { label: "Overdue", value: String(summary?.overdueRenewals ?? 0), warn: (summary?.overdueRenewals ?? 0) > 0 },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3 ${s.warn ? "ring-1 ring-amber-300" : ""}`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${s.warn ? "text-amber-700" : "text-slate-900"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search school, plan, payment method…"
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
        {tab === "schools" && (
          <select className="input text-sm w-auto" value={viewFilter} onChange={(e) => setViewFilter(e.target.value as typeof viewFilter)}>
            <option value="all">All schools</option>
            <option value="subscribed">Has subscription</option>
            <option value="overdue">Overdue renewal</option>
            <option value="fees">Has fee payments</option>
          </select>
        )}
        <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("schools")}
            className={`px-3 py-1 rounded ${tab === "schools" ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            Per school
          </button>
          <button
            type="button"
            onClick={() => setTab("payments")}
            className={`px-3 py-1 rounded ${tab === "payments" ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            Recent payments
          </button>
        </div>
      </div>

      {tab === "schools" ? (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Plan / billing</th>
                  <th className="px-4 py-3">SaaS MRR</th>
                  <th className="px-4 py-3">Renews</th>
                  <th className="px-4 py-3">Fee vol. (30d)</th>
                  <th className="px-4 py-3">Fee vol. (all)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchools.map((r) => (
                  <tr key={r.tenantId} className={`hover:bg-slate-50/80 ${r.overdue ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={16} className="text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <Link to={`/platform/tenants/${r.slug}`} className="font-medium text-slate-900 hover:text-blue-600 truncate block">
                            {r.name}
                          </Link>
                          <p className="text-[11px] font-mono text-slate-500">/s/{r.slug}</p>
                        </div>
                        {r.overdue && (
                          <span title="Renewal overdue" className="text-amber-600 shrink-0">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.planName ? (
                        <>
                          <span className="font-medium text-slate-800">{r.planName}</span>
                          {r.billingInterval && (
                            <p className="text-[10px] text-slate-500">{BILLING_INTERVAL_LABELS[r.billingInterval]}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-amber-600">No plan</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-slate-700">
                      {r.mrrDisplayMinor > 0
                        ? formatMoneyMinor(r.mrrDisplayMinor, cur)
                        : r.billingInterval === "lifetime" && r.resolvedCurrency
                          ? formatPeriodPrice(
                              r.periodAmount,
                              null,
                              r.billingInterval,
                              r.resolvedCurrency,
                              formatMoneyMinor,
                            )
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.billingInterval === "lifetime" ? (
                        <span className="text-slate-400">Lifetime</span>
                      ) : r.renewsAt ? (
                        <span className={`inline-flex items-center gap-1 ${r.overdue ? "text-amber-700 font-medium" : ""}`}>
                          {r.overdue && <CalendarClock size={12} />}
                          {formatDate(r.renewsAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-slate-700">
                      {r.feeVolume30dDisplayMinor > 0 ? formatMoneyMinor(r.feeVolume30dDisplayMinor, cur) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-slate-700">
                      {r.feeVolumeDisplayMinor > 0 ? formatMoneyMinor(r.feeVolumeDisplayMinor, cur) : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSchools.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">No schools match your filters.</p>
          )}
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Paid at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <Link to={`/platform/tenants/${p.tenantSlug}`} className="font-medium text-slate-900 hover:text-blue-600">
                        {p.tenantName}
                      </Link>
                      <p className="text-[11px] font-mono text-slate-500">/s/{p.tenantSlug}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">
                      <span className="text-slate-800">{formatMoneyMinor(p.amountDisplayMinor, cur)}</span>
                      {p.currency !== cur && (
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({formatMoneyMinor(p.amount, p.currency)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-600">{p.method}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPayments.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">
              {ledger?.recentPayments.length === 0
                ? "No fee payments recorded yet across schools."
                : "No payments match your search."}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
