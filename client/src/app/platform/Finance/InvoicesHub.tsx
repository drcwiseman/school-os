import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { formatMoneyMinor, DEFAULT_CURRENCY } from "../../../lib/currencies";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type InvoiceRow = {
  id: string;
  invoiceNo: string;
  tenantSlug: string;
  tenantName: string;
  studentName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  totalDisplayMinor: number;
  paidDisplayMinor: number;
  balanceDisplayMinor: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  overdue: boolean;
};

type LedgerData = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    totalInvoices: number;
    unpaidCount: number;
    overdueCount: number;
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    schoolsWithInvoices: number;
  };
  invoices: InvoiceRow[];
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
        <AlertTriangle size={11} /> Overdue
      </span>
    );
  }
  const styles: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    unpaid: "bg-amber-50 text-amber-700 ring-amber-600/20",
    partial: "bg-blue-50 text-blue-700 ring-blue-600/20",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export const InvoicesHub: React.FC = () => {
  const { toast } = useToast();
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid" | "partial" | "overdue">("all");
  const [schoolFilter, setSchoolFilter] = useState("all");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/invoices");
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
    for (const inv of ledger.invoices) {
      map.set(inv.tenantSlug, inv.tenantName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ledger]);

  const filtered = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.invoices.filter((r) => {
      if (schoolFilter !== "all" && r.tenantSlug !== schoolFilter) return false;
      if (statusFilter === "overdue" && !r.overdue) return false;
      if (statusFilter === "unpaid" && (r.balance <= 0 || r.overdue)) return false;
      if (statusFilter === "paid" && r.balance > 0) return false;
      if (statusFilter === "partial" && r.status !== "partial") return false;
      if (!q) return true;
      return (
        r.invoiceNo.toLowerCase().includes(q) ||
        r.tenantName.toLowerCase().includes(q) ||
        r.tenantSlug.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q)
      );
    });
  }, [ledger, search, statusFilter, schoolFilter]);

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
              <FileText size={20} className="text-blue-600" />
              Global invoices
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Student fee invoices across all schools (latest 500), consolidated in{" "}
              <span className="font-mono font-medium">{cur}</span> via {ledger?.fxProvider ?? "FX"}.
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
              to="/platform/subscriptions/ledger"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Revenue
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: "Invoices", value: String(summary?.totalInvoices ?? 0) },
          { label: "Schools", value: String(summary?.schoolsWithInvoices ?? 0) },
          { label: "Unpaid", value: String(summary?.unpaidCount ?? 0) },
          { label: "Overdue", value: String(summary?.overdueCount ?? 0), warn: (summary?.overdueCount ?? 0) > 0 },
          { label: "Invoiced", value: formatMoneyMinor(summary?.totalInvoiced ?? 0, cur) },
          { label: "Collected", value: formatMoneyMinor(summary?.totalPaid ?? 0, cur) },
          { label: "Outstanding", value: formatMoneyMinor(summary?.totalOutstanding ?? 0, cur) },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3 ${s.warn ? "ring-1 ring-red-300" : ""}`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 truncate ${s.warn ? "text-red-700" : "text-slate-900"}`}>
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
            placeholder="Search invoice no, school, student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="unpaid">Unpaid balance</option>
          <option value="partial">Partial</option>
          <option value="paid">Fully paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <select className="input text-sm w-auto max-w-[200px]" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="all">All schools</option>
          {schools.map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50/80 ${r.overdue ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.invoiceNo}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={14} className="text-slate-400 shrink-0" />
                      <Link to={`/platform/tenants/${r.tenantSlug}`} className="font-medium text-slate-900 hover:text-blue-600 truncate">
                        {r.tenantName}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs">{r.studentName}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">
                    {formatMoneyMinor(r.totalDisplayMinor, cur)}
                    {r.currency !== cur && (
                      <span className="text-[10px] text-slate-400 block">{formatMoneyMinor(r.totalAmount, r.currency)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs text-emerald-700">
                    {formatMoneyMinor(r.paidDisplayMinor, cur)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs font-medium text-slate-800">
                    {r.balance > 0 ? formatMoneyMinor(r.balanceDisplayMinor, cur) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} overdue={r.overdue} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">
            {ledger?.invoices.length === 0
              ? "No fee invoices recorded yet. Schools create invoices from their Finance module."
              : "No invoices match your filters."}
          </p>
        )}
      </div>
    </div>
  );
};
