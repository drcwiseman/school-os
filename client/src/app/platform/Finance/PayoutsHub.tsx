import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  Plus,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { formatMoneyMinor, DEFAULT_CURRENCY } from "../../../lib/currencies";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type SchoolBalance = {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  currency: string;
  collectedMinor: number;
  paidOutMinor: number;
  availableMinor: number;
  collectedDisplayMinor: number;
  paidOutDisplayMinor: number;
  availableDisplayMinor: number;
  lastPayoutAt: string | null;
};

type PayoutRow = {
  id: string;
  tenantSlug: string;
  tenantName: string;
  amount: number;
  currency: string;
  amountDisplayMinor: number;
  status: string;
  reference: string | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
};

type LedgerData = {
  displayCurrency: string;
  summary: {
    totalCollected: number;
    totalPaidOut: number;
    totalAvailable: number;
    pendingPayouts: number;
    completedPayouts: number;
    schoolsWithBalance: number;
  };
  schools: SchoolBalance[];
  payouts: PayoutRow[];
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
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    processing: "bg-blue-50 text-blue-700 ring-blue-600/20",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    failed: "bg-red-50 text-red-700 ring-red-600/20",
    cancelled: "bg-slate-100 text-slate-500 ring-slate-400/20",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export const PayoutsHub: React.FC = () => {
  const { toast } = useToast();
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"balances" | "history">("balances");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [formSlug, setFormSlug] = useState("");
  const [formAmountMajor, setFormAmountMajor] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formStatus, setFormStatus] = useState<"completed" | "pending" | "processing">("completed");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/payouts");
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

  const schoolsWithBalance = useMemo(
    () => (ledger?.schools ?? []).filter((s) => s.availableMinor > 0),
    [ledger],
  );

  const openPayout = (school?: SchoolBalance) => {
    setFormSlug(school?.slug ?? "");
    setFormAmountMajor(school?.availableMinor ? String(school.availableMinor / 100) : "");
    setFormReference("");
    setFormNote("");
    setFormStatus("completed");
    setModalOpen(true);
  };

  const savePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSlug || !formAmountMajor.trim()) return;
    const amount = Math.round(parseFloat(formAmountMajor) * 100);
    if (Number.isNaN(amount) || amount <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/platform/payouts", {
        tenantSlug: formSlug,
        amount,
        reference: formReference || undefined,
        note: formNote || undefined,
        status: formStatus,
      });
      toast("Payout recorded", "success");
      setModalOpen(false);
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (payoutId: string, status: string) => {
    try {
      await api.patch(`/api/platform/payouts/${payoutId}`, { status });
      toast("Payout updated", "success");
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ledger?.schools ?? []).filter((s) => {
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
    });
  }, [ledger, search]);

  const filteredPayouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ledger?.payouts ?? []).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.tenantName.toLowerCase().includes(q) ||
        p.tenantSlug.toLowerCase().includes(q) ||
        (p.reference?.toLowerCase().includes(q) ?? false) ||
        (p.note?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [ledger, search, statusFilter]);

  const selectedSchool = ledger?.schools.find((s) => s.slug === formSlug);

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
              <Receipt size={20} className="text-blue-600" />
              School payouts
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Settle collected fee revenue to schools. Available = payments collected minus payouts already recorded ({cur} display).
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
              onClick={() => openPayout()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              Record payout
            </button>
            <Link
              to="/platform/transactions"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Transactions
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Collected", value: formatMoneyMinor(summary?.totalCollected ?? 0, cur) },
          { label: "Paid out", value: formatMoneyMinor(summary?.totalPaidOut ?? 0, cur) },
          { label: "Available", value: formatMoneyMinor(summary?.totalAvailable ?? 0, cur) },
          { label: "Pending", value: formatMoneyMinor(summary?.pendingPayouts ?? 0, cur) },
          { label: "Schools w/ balance", value: String(summary?.schoolsWithBalance ?? 0) },
          { label: "Payout records", value: String(ledger?.payouts.length ?? 0) },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 text-slate-900 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search school, reference, note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === "history" && (
          <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("balances")}
            className={`px-3 py-1 rounded ${tab === "balances" ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            Balances
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`px-3 py-1 rounded ${tab === "history" ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            Payout history
          </button>
        </div>
      </div>

      {tab === "balances" ? (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Collected</th>
                  <th className="px-4 py-3">Paid out</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Last payout</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchools.map((s) => (
                  <tr key={s.tenantId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        <Link to={`/platform/tenants/${s.slug}`} className="font-medium text-slate-900 hover:text-blue-600">
                          {s.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">{formatMoneyMinor(s.collectedDisplayMinor, cur)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{formatMoneyMinor(s.paidOutDisplayMinor, cur)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-semibold text-emerald-700">
                      {s.availableMinor > 0 ? formatMoneyMinor(s.availableDisplayMinor, cur) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(s.lastPayoutAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.availableMinor > 0 && (
                        <button
                          type="button"
                          onClick={() => openPayout(s)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Payout
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSchools.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">No schools match your search.</p>
          )}
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/platform/tenants/${p.tenantSlug}`} className="font-medium text-slate-900 hover:text-blue-600">
                        {p.tenantName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs font-medium">
                      {formatMoneyMinor(p.amountDisplayMinor, cur)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => updateStatus(p.id, "completed")} className="text-[10px] text-emerald-600 hover:underline">
                            Complete
                          </button>
                          <button type="button" onClick={() => updateStatus(p.id, "cancelled")} className="text-[10px] text-slate-500 hover:underline">
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPayouts.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">
              {ledger?.payouts.length === 0
                ? "No payouts recorded yet. Record a bank transfer when you settle fees to a school."
                : "No payouts match your filters."}
            </p>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Record payout</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={savePayout} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">School</label>
                <select className="input text-sm mt-1 w-full" required value={formSlug} onChange={(e) => setFormSlug(e.target.value)}>
                  <option value="">Select school…</option>
                  {schoolsWithBalance.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name} — {formatMoneyMinor(s.availableMinor, s.currency)} avail.
                    </option>
                  ))}
                  {(ledger?.schools ?? []).filter((s) => s.availableMinor <= 0).map((s) => (
                    <option key={s.slug} value={s.slug}>{s.name} (no balance)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Amount (major units)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  className="input text-sm mt-1 w-full"
                  value={formAmountMajor}
                  onChange={(e) => setFormAmountMajor(e.target.value)}
                />
                {selectedSchool && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Available: {formatMoneyMinor(selectedSchool.availableMinor, selectedSchool.currency)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Bank / transfer reference</label>
                <input className="input text-sm mt-1 w-full" value={formReference} onChange={(e) => setFormReference(e.target.value)} placeholder="TXN-2026-001" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Note</label>
                <textarea className="input text-sm mt-1 w-full min-h-[60px]" value={formNote} onChange={(e) => setFormNote(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Status</label>
                <select className="input text-sm mt-1 w-full" value={formStatus} onChange={(e) => setFormStatus(e.target.value as typeof formStatus)}>
                  <option value="completed">Completed (transferred)</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                </select>
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Record payout"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
