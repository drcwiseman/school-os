import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { DollarSign, Loader2, Receipt } from "lucide-react";

function formatMoney(cents: number | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-primary-400" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export const Finance: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<"overview" | "debtors" | "receipts">("overview");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);

  useEffect(() => { load(); }, [schoolSlug, tab]);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "overview") {
        const [dash, inv] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/finance/dashboard`),
          api.get(`/s/${schoolSlug}/api/finance/invoices?limit=20`),
        ]);
        setStats(dash.data);
        setInvoices(inv.data || []);
      } else if (tab === "debtors") {
        setDebtors((await api.get(`/s/${schoolSlug}/api/finance/debtors`)).data ?? []);
      } else {
        setReceipts((await api.get(`/s/${schoolSlug}/api/finance/receipts`)).data ?? []);
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="text-slate-400 mt-1">Invoices, payments, and collections</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("overview")} className={tabBtn("overview")}>overview</button>
        <button type="button" onClick={() => setTab("debtors")} className={tabBtn("debtors")}>debtors</button>
        <button type="button" onClick={() => setTab("receipts")} className={tabBtn("receipts")}>receipts</button>
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Invoiced" value={formatMoney(stats?.totalInvoiced)} icon={DollarSign} />
            <StatCard label="Total Collected" value={formatMoney(stats?.totalPaid)} icon={Receipt} />
            <StatCard label="Unpaid Invoices" value={String(stats?.unpaidCount ?? 0)} icon={DollarSign} />
          </div>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Recent Invoices</h3></div>
            <table className="table">
              <thead><tr><th>Invoice No</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">No invoices yet.</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs">{inv.invoiceNo}</td>
                    <td>{formatMoney(inv.totalAmount)}</td>
                    <td>{formatMoney(inv.paidAmount)}</td>
                    <td className="capitalize">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "debtors" && (
        <div className="card overflow-hidden">
          <DebtorsSection debtors={debtors} formatMoney={formatMoney} />
        </div>
      )}

      {tab === "receipts" && (
        <div className="card overflow-hidden">
          <ReceiptsSection receipts={receipts} formatMoney={formatMoney} />
        </div>
      )}
    </div>
  );
};

function DebtorsSection({ debtors, formatMoney }: { debtors: any[]; formatMoney: (c?: number) => string }) {
  return (
    <>
      <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Debtors</h3></div>
      <table className="table">
        <thead><tr><th>Invoice</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          {debtors.map((d) => (
            <tr key={d.id}><td className="font-mono text-xs">{d.invoiceNo}</td><td>{formatMoney(d.balance)}</td><td>{d.status}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReceiptsSection({ receipts, formatMoney }: { receipts: any[]; formatMoney: (c?: number) => string }) {
  return (
    <>
      <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Receipts</h3></div>
      <table className="table">
        <thead><tr><th>Receipt No</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id}><td className="font-mono text-xs">{r.receiptNo}</td><td>{formatMoney(r.amount)}</td><td>{new Date(r.issuedAt).toLocaleDateString()}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
