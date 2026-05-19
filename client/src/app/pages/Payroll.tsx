import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

type PayrollItem = {
  id: string;
  staffId: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  employeeNo: string;
  firstName: string;
  lastName: string;
};

type RunDetail = { run: { id: string; period: string; status: string }; items: PayrollItem[] };

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
  const { hasPermission } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const toggleRun = async (id: string) => {
    if (expandedRun === id) {
      setExpandedRun(null);
      setRunDetail(null);
      return;
    }
    setExpandedRun(id);
    setDetailLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/payroll/runs/${id}`);
      setRunDetail(res.data ?? null);
    } catch (e: any) {
      toast(e.message, "error");
      setExpandedRun(null);
    } finally {
      setDetailLoading(false);
    }
  };

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

  const removeRun = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/payroll/runs/${id}`);
      toast("Payroll run removed", "success");
      if (expandedRun === id) { setExpandedRun(null); setRunDetail(null); }
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

  const runTotals = runDetail?.items.reduce(
    (acc, i) => ({ gross: acc.gross + i.grossPay, net: acc.net + i.netPay }),
    { gross: 0, net: 0 },
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="text-slate-400 mt-1">Runs, line items, approvals, and payslips</p>
        </div>
      </div>

      {hasPermission("payroll.run") && (
        <form onSubmit={startRun} className="card p-4 flex gap-3 items-end">
          <PeriodField period={period} setPeriod={setPeriod} />
          <button type="submit" className="btn-primary">Run Payroll</button>
        </form>
      )}

      <SectionTable title="Payroll runs" headers={["", "Period", "Status", "Actions"]}>
        {runs.length === 0 ? (
          <tr><td colSpan={4} className="text-center py-8 text-slate-400">No payroll runs yet.</td></tr>
        ) : runs.map((r) => (
          <React.Fragment key={r.id}>
            <tr>
              <td className="w-8">
                <button type="button" className="btn-ghost p-1" onClick={() => toggleRun(r.id)} aria-label="Toggle line items">
                  {expandedRun === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </td>
              <td>{r.period}</td>
              <td className="capitalize">{r.status}</td>
              <td className="flex gap-2">
                {r.status === "draft" && hasPermission("payroll.approve") && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => approve(r.id)}>Approve</button>
                )}
                {r.status === "draft" && hasPermission("payroll.run") && (
                  <ConfirmAction
                    label="Remove"
                    confirmMessage={`Remove payroll run ${r.period}?`}
                    onConfirm={() => removeRun(r.id)}
                  />
                )}
              </td>
            </tr>
            {expandedRun === r.id && (
              <tr>
                <td colSpan={4} className="bg-slate-900/50 p-4">
                  {detailLoading ? (
                    <p className="text-sm text-slate-400">Loading line items…</p>
                  ) : !runDetail?.items.length ? (
                    <p className="text-sm text-slate-400">No line items.</p>
                  ) : (
                    <div className="space-y-2">
                      <table className="w-full text-sm text-slate-300">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th>Employee</th><th>Gross</th><th>Deductions</th><th>Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runDetail.items.map((i) => (
                            <tr key={i.id}>
                              <td>{i.employeeNo} — {i.firstName} {i.lastName}</td>
                              <td>{fmtMoney(i.grossPay)}</td>
                              <td>{fmtMoney(i.deductions)}</td>
                              <td className="text-emerald-400">{fmtMoney(i.netPay)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {runTotals && (
                        <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                          Totals: gross {fmtMoney(runTotals.gross)} · net {fmtMoney(runTotals.net)}
                        </p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </SectionTable>

      <SectionTable title="Payslips" headers={["Employee", "Period", "Net pay", "Issued"]}>
        {payslips.length === 0 ? (
          <tr><td colSpan={4} className="text-center py-8 text-slate-400">No payslips yet.</td></tr>
        ) : payslips.map((p) => {
          const data = (p.dataJson ?? {}) as Record<string, unknown>;
          return (
            <tr key={p.id}>
              <td>{p.employeeNo} — {p.firstName} {p.lastName}</td>
              <td>{String(data.period ?? "—")}</td>
              <td>{typeof data.net === "number" ? fmtMoney(data.net) : "—"}</td>
              <td>{new Date(p.issuedAt).toLocaleDateString()}</td>
            </tr>
          );
        })}
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
