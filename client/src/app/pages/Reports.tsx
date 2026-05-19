import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, downloadPdf } from "../api/client";
import { useToast } from "../components/Toast";
import { BarChart3, Download, Loader2 } from "lucide-react";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export const Reports: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<any>(null);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [pdfId, setPdfId] = useState("");
  const [pdfType, setPdfType] = useState<"invoice" | "receipt" | "report-card" | "payslip">("invoice");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, d, p] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/reports/finance/collections`),
          api.get(`/s/${schoolSlug}/api/reports/finance/debtors`),
          api.get(`/s/${schoolSlug}/api/reports/academics/performance`),
        ]);
        setCollections(c.data);
        setDebtors(d.data ?? []);
        setPerformance(p.data ?? []);
      } catch (err: any) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolSlug]);

  const exportPdf = async () => {
    if (!pdfId.trim()) return toast("Enter a record ID", "error");
    try {
      await downloadPdf(`/s/${schoolSlug}/api/reports/pdf/${pdfType}/${pdfId.trim()}`);
      toast("Download started", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-slate-400 mt-1">Summaries and PDF exports</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <BarChart3 className="w-5 h-5 text-primary-400 mb-2" />
          <p className="text-sm text-slate-400">Total invoiced</p>
          <p className="text-xl font-bold text-white">{formatMoney(Number(collections?.totalInvoiced ?? 0))}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-400">Total paid</p>
          <p className="text-xl font-bold text-white">{formatMoney(Number(collections?.totalPaid ?? 0))}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-400">Debtor accounts</p>
          <p className="text-xl font-bold text-white">{debtors.length}</p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-white mb-3">PDF export</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <select className="input w-auto" value={pdfType} onChange={(e) => setPdfType(e.target.value as typeof pdfType)}>
            <option value="invoice">Invoice</option>
            <option value="receipt">Receipt</option>
            <option value="report-card">Report card</option>
            <option value="payslip">Payslip</option>
          </select>
          <input className="input flex-1 min-w-[200px]" placeholder="Record UUID" value={pdfId} onChange={(e) => setPdfId(e.target.value)} />
          <button type="button" className="btn-primary" onClick={exportPdf}>
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-white mb-3">Recent report cards</h3>
        <ul className="text-sm text-slate-300 space-y-1">
          {performance.slice(0, 10).map((r) => (
            <li key={r.id}>{r.id.slice(0, 8)}… — {r.published ? "published" : "draft"}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
