import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { formatMoneyMinor, DEFAULT_CURRENCY } from "../../../lib/currencies";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type TxRow = {
  id: string;
  type: "payment" | "expense";
  tenantSlug: string;
  tenantName: string;
  amount: number;
  currency: string;
  amountDisplayMinor: number;
  method: string | null;
  reference: string | null;
  receiptNo: string | null;
  invoiceNo: string | null;
  studentName: string | null;
  description: string | null;
  category: string | null;
  status: "completed" | "voided";
  occurredAt: string;
};

type LedgerData = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    totalTransactions: number;
    paymentCount: number;
    expenseCount: number;
    voidedPayments: number;
    volumeTotal: number;
    volume30d: number;
    expensesTotal: number;
    expenses30d: number;
    netFlow: number;
    schoolsActive: number;
    byMethod: Record<string, number>;
  };
  transactions: TxRow[];
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatMethod(method: string | null) {
  if (!method) return "—";
  return method.replace(/_/g, " ");
}

function TypeBadge({ type, status }: { type: TxRow["type"]; status: TxRow["status"] }) {
  if (status === "voided") {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-slate-100 text-slate-500 line-through">
        Voided
      </span>
    );
  }
  if (type === "payment") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
        <ArrowDownLeft size={11} /> Payment in
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-orange-50 text-orange-700 ring-orange-600/20">
      <ArrowUpRight size={11} /> Expense out
    </span>
  );
}

export const TransactionsHub: React.FC = () => {
  const { toast } = useToast();
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "payment" | "expense">("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [showVoided, setShowVoided] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/transactions");
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

  const schools = useMemo(() => {
    if (!ledger) return [];
    const map = new Map<string, string>();
    for (const t of ledger.transactions) {
      map.set(t.tenantSlug, t.tenantName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ledger]);

  const methods = useMemo(() => {
    if (!ledger) return [];
    return Object.keys(ledger.summary.byMethod).sort();
  }, [ledger]);

  const filtered = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.transactions.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!showVoided && r.status === "voided") return false;
      if (methodFilter !== "all" && (r.method?.toLowerCase() ?? "") !== methodFilter) return false;
      if (schoolFilter !== "all" && r.tenantSlug !== schoolFilter) return false;
      if (!q) return true;
      return (
        r.tenantName.toLowerCase().includes(q) ||
        r.tenantSlug.toLowerCase().includes(q) ||
        (r.studentName?.toLowerCase().includes(q) ?? false) ||
        (r.invoiceNo?.toLowerCase().includes(q) ?? false) ||
        (r.receiptNo?.toLowerCase().includes(q) ?? false) ||
        (r.reference?.toLowerCase().includes(q) ?? false) ||
        (r.description?.toLowerCase().includes(q) ?? false) ||
        (r.method?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [ledger, search, typeFilter, methodFilter, schoolFilter, showVoided]);

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
              <ArrowRightLeft size={20} className="text-blue-600" />
              Global transactions
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Fee payments collected and school expenses across all tenants, in{" "}
              <span className="font-mono font-medium">{cur}</span> ({ledger?.fxProvider ?? "FX"}).
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
              to="/platform/invoices"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Invoices
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Payments in", value: formatMoneyMinor(summary?.volumeTotal ?? 0, cur) },
          { label: "30-day inflow", value: formatMoneyMinor(summary?.volume30d ?? 0, cur) },
          { label: "Expenses out", value: formatMoneyMinor(summary?.expensesTotal ?? 0, cur) },
          { label: "Net flow", value: formatMoneyMinor(summary?.netFlow ?? 0, cur) },
          { label: "Payments", value: String(summary?.paymentCount ?? 0) },
          { label: "Expenses", value: String(summary?.expenseCount ?? 0) },
          { label: "Voided", value: String(summary?.voidedPayments ?? 0) },
          { label: "Schools", value: String(summary?.schoolsActive ?? 0) },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 text-slate-900 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {methods.length > 0 && (
        <div className={`${CARD} p-3`}>
          <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Payment methods (volume)</p>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs text-slate-700">
                <span className="capitalize">{formatMethod(m)}</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {formatMoneyMinor(ledger!.summary.byMethod[m] ?? 0, cur)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search school, student, receipt, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="all">All types</option>
          <option value="payment">Payments in</option>
          <option value="expense">Expenses out</option>
        </select>
        <select className="input text-sm w-auto" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="all">All methods</option>
          {methods.map((m) => (
            <option key={m} value={m}>{formatMethod(m)}</option>
          ))}
        </select>
        <select className="input text-sm w-auto max-w-[200px]" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="all">All schools</option>
          {schools.map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 px-2">
          <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
          Show voided
        </label>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={`${r.type}-${r.id}`} className={`hover:bg-slate-50/80 ${r.status === "voided" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(r.occurredAt)}</td>
                  <td className="px-4 py-3"><TypeBadge type={r.type} status={r.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={14} className="text-slate-400 shrink-0" />
                      <Link to={`/platform/tenants/${r.tenantSlug}`} className="font-medium text-slate-900 hover:text-blue-600 truncate">
                        {r.tenantName}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]">
                    {r.type === "payment" ? (
                      <>
                        <span className="text-slate-800">{r.studentName}</span>
                        {r.invoiceNo && <p className="font-mono text-[10px] text-slate-400">Inv {r.invoiceNo}</p>}
                        {r.receiptNo && <p className="font-mono text-[10px] text-slate-400">Rcpt {r.receiptNo}</p>}
                        {r.reference && <p className="text-[10px] text-slate-400 truncate">{r.reference}</p>}
                      </>
                    ) : (
                      <>
                        <span className="text-slate-800 truncate block">{r.description}</span>
                        {r.category && <p className="text-[10px] text-slate-400 capitalize">{r.category}</p>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-slate-600">{formatMethod(r.method)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums text-xs font-medium ${r.type === "expense" ? "text-orange-700" : "text-emerald-700"}`}>
                    {r.type === "expense" ? "−" : "+"}
                    {formatMoneyMinor(r.amountDisplayMinor, cur)}
                    {r.currency !== cur && (
                      <span className="text-[10px] text-slate-400 block">
                        ({formatMoneyMinor(r.amount, r.currency)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">
            {ledger?.transactions.length === 0
              ? "No transactions yet. Schools record payments and expenses in Finance."
              : "No transactions match your filters."}
          </p>
        )}
      </div>
    </div>
  );
};
