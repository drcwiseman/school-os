import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2 } from "lucide-react";

function SectionTable({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 font-semibold text-white">{title}</div>
      <table className="table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Payroll: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/payroll/runs`),
        api.get(`/s/${schoolSlug}/api/payroll/payslips`),
      ]);
      setRuns(r.data ?? []);
      setPayslips(p.data ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const startRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/payroll/runs`, { period });
      setPeriod("");
      toast("Payroll run created", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/payroll/runs/${id}/approve`, {});
      toast("Payroll approved — payslips generated", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
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
          <h1 className="page-title">Payroll</h1>
          <p className="text-slate-400 mt-1">Runs, approvals, and payslips</p>
        </div>
      </div>

      <form onSubmit={startRun} className="card p-4 flex gap-3 items-end">
        <PeriodField period={period} setPeriod={setPeriod} />
        <button type="submit" className="btn-primary">Run Payroll</button>
      </form>

      <SectionTable title="Payroll runs" headers={["Period", "Status", "Actions"]}>
        {runs.map((r) => (
          <tr key={r.id}>
            <td>{r.period}</td>
            <td className="capitalize">{r.status}</td>
            <td>
              {r.status === "draft" && (
                <button type="button" className="btn-ghost text-xs" onClick={() => approve(r.id)}>Approve</button>
              )}
            </td>
          </tr>
        ))}
      </SectionTable>

      <SectionTable title="Payslips" headers={["Staff", "Issued"]}>
        {payslips.map((p) => (
          <tr key={p.id}>
            <td className="font-mono text-xs">{p.staffId?.slice(0, 8)}</td>
            <td>{new Date(p.issuedAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </SectionTable>
    </div>
  );
};

function PeriodField({ period, setPeriod }: { period: string; setPeriod: (v: string) => void }) {
  return (
    <div className="flex-1">
      <label className="label">Period (e.g. 2026-05)</label>
      <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} required placeholder="2026-05" />
    </div>
  );
}
