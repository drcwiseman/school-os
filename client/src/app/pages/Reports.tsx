import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, downloadPdf } from "../api/client";
import { useToast } from "../components/Toast";
import { BarChart3, Download, Loader2, Plus, Play, Trash2 } from "lucide-react";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

type SavedReport = {
  id: string;
  name: string;
  reportType: string;
  configJson: Record<string, unknown>;
  createdAt: string;
};

const REPORT_TYPES = [
  { value: "finance_collections", label: "Finance — collections summary" },
  { value: "finance_debtors", label: "Finance — debtors list" },
  { value: "attendance_summary", label: "Attendance — session count" },
  { value: "academics_performance", label: "Academics — report cards" },
];

export const Reports: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<any>(null);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [pdfId, setPdfId] = useState("");
  const [pdfType, setPdfType] = useState<"invoice" | "receipt" | "report-card" | "payslip">("invoice");
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("finance_debtors");
  const [runResult, setRunResult] = useState<{ name: string; rows: unknown[] } | null>(null);
  const [section, setSection] = useState<"dashboard" | "builder">("dashboard");

  const load = async () => {
    setLoading(true);
    try {
      const [c, d, p, b] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/reports/finance/collections`),
        api.get(`/s/${schoolSlug}/api/reports/finance/debtors`),
        api.get(`/s/${schoolSlug}/api/reports/academics/performance`),
        api.get(`/s/${schoolSlug}/api/reports/builder`).catch(() => ({ data: [] })),
      ]);
      setCollections(c.data);
      setDebtors(d.data ?? []);
      setPerformance(p.data ?? []);
      setSaved(b.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const exportPdf = async () => {
    if (!pdfId.trim()) return toast("Enter a record ID", "error");
    try {
      await downloadPdf(`/s/${schoolSlug}/api/reports/pdf/${pdfType}/${pdfId.trim()}`);
      toast("Download started", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const createReport = async () => {
    if (!newName.trim()) return toast("Name required", "error");
    try {
      await api.post(`/s/${schoolSlug}/api/reports/builder`, { name: newName, reportType: newType });
      setNewName("");
      toast("Report saved", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const runReport = async (id: string, name: string) => {
    try {
      const res = await api.post(`/s/${schoolSlug}/api/reports/builder/${id}/run`, {});
      setRunResult({ name, rows: res.data.rows ?? [] });
      setSection("builder");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const deleteReport = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/reports/builder/${id}`);
      toast("Deleted", "success");
      load();
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
          <p className="text-slate-400 mt-1">Summaries, saved report builder, and PDF exports</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={section === "dashboard" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setSection("dashboard")}>Dashboard</button>
          <button type="button" className={section === "builder" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setSection("builder")}>Builder</button>
        </div>
      </div>

      {section === "dashboard" && (
        <>
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
        </>
      )}

      {section === "builder" && (
        <>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Create saved report</h3>
            <div className="flex flex-wrap gap-3">
              <input className="input flex-1 min-w-[180px]" placeholder="Report name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <select className="input w-auto min-w-[220px]" value={newType} onChange={(e) => setNewType(e.target.value)}>
                {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="button" className="btn-primary" onClick={createReport}>
                <Plus className="w-4 h-4" /> Save
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">Saved reports</h3>
            {saved.length === 0 ? (
              <p className="text-sm text-slate-500">No saved reports yet.</p>
            ) : (
              <ul className="space-y-2">
                {saved.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm border-b border-slate-800 pb-2">
                    <div>
                      <p className="text-white font-medium">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.reportType}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary text-xs py-1" onClick={() => runReport(r.id, r.name)}>
                        <Play className="w-3 h-3" /> Run
                      </button>
                      <button type="button" className="btn-ghost text-xs text-red-400" onClick={() => deleteReport(r.id)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {runResult && (
            <div className="card p-5">
              <h3 className="font-semibold text-white mb-2">Results: {runResult.name}</h3>
              <pre className="text-xs text-slate-300 overflow-auto max-h-80 bg-slate-900/50 p-3 rounded-lg">
                {JSON.stringify(runResult.rows, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};
