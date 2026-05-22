import React, { useCallback, useEffect, useState } from "react";
import { api, downloadPdf } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Download, Loader2 } from "lucide-react";
import { minorFromMajor, moneyInputStep } from "../../../lib/currencies";
import { HRSetupBanner } from "./HRSetupBanner";

type StaffRow = { id: string; employeeNo: string; firstName: string; lastName: string; department?: string; jobTitle?: string };

export const HRDashboardStrip: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    api.get(`/s/${schoolSlug}/api/hr/dashboard`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setFailed(true); });
  }, [schoolSlug]);
  if (failed) return <HRSetupBanner />;
  if (!data) return null;
  const att = data.attendanceToday ?? {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4"><p className="text-slate-500 text-sm">Active staff</p><p className="text-2xl font-bold text-white">{data.activeStaff ?? 0}</p></div>
      <div className="card p-4"><p className="text-slate-500 text-sm">Present today</p><p className="text-2xl font-bold text-emerald-400">{att.present ?? 0}</p></div>
      <div className="card p-4"><p className="text-slate-500 text-sm">Absent / late</p><p className="text-2xl font-bold text-amber-400">{(att.absent ?? 0) + (att.late ?? 0)}</p></div>
      <div className="card p-4"><p className="text-slate-500 text-sm">Leave pending</p><p className="text-2xl font-bold text-white">{data.pendingLeave ?? 0}</p></div>
    </div>
  );
};

export const StaffAttendancePanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [reportRange, setReportRange] = useState({ from: "", to: "" });
  const [attendanceTableMissing, setAttendanceTableMissing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/hr/staff-attendance?date=${date}`)
      .then((r) => {
        const list = r.data?.rows ?? [];
        setAttendanceTableMissing(!!r.data?.attendanceTableMissing);
        setRows(list);
        const init: Record<string, string> = {};
        for (const row of list) {
          init[row.staff.id] = row.attendance?.status ?? "present";
        }
        setStatuses(init);
      })
      .catch((err: any) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [schoolSlug, date, toast]);

  useEffect(() => { load(); }, [load]);

  const saveAll = async () => {
    const records = Object.entries(statuses).map(([staffId, status]) => ({ staffId, status }));
    try {
      const res = await api.post(`/s/${schoolSlug}/api/hr/staff-attendance/bulk`, { date, records });
      toast(`Saved ${res.data?.saved ?? 0} attendance records`, "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const loadReport = async () => {
    const from = reportRange.from || date;
    const to = reportRange.to || date;
    try {
      const res = await api.get(`/s/${schoolSlug}/api/hr/staff-attendance/report?from=${from}&to=${to}`);
      setReport(res.data);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-4">
      {attendanceTableMissing && (
        <HRSetupBanner message="Staff attendance is not set up on the server yet. You can view the roster, but saving attendance requires db:repair." />
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Attendance date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {hasPermission("hr.manage") && (
          <button type="button" className="btn-primary" onClick={saveAll}>Save attendance</button>
        )}
      </div>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Employee</th><th>Department</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-slate-400">No active staff.</td></tr>
            ) : rows.map((row: any) => (
              <tr key={row.staff.id}>
                <td>{row.staff.employeeNo} — {row.staff.firstName} {row.staff.lastName}</td>
                <td className="text-slate-400">{row.staff.department ?? "—"}</td>
                <td>
                  <select
                    className="input text-sm"
                    disabled={!hasPermission("hr.manage")}
                    value={statuses[row.staff.id] ?? "present"}
                    onChange={(e) => setStatuses({ ...statuses, [row.staff.id]: e.target.value })}
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="on_leave">On leave</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-white">Attendance report</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <input className="input" type="date" value={reportRange.from} onChange={(e) => setReportRange({ ...reportRange, from: e.target.value })} />
          <input className="input" type="date" value={reportRange.to} onChange={(e) => setReportRange({ ...reportRange, to: e.target.value })} />
          <button type="button" className="btn-ghost" onClick={loadReport}>Generate</button>
        </div>
        {report?.rows?.length > 0 && (
          <table className="table text-sm">
            <thead><tr><th>Staff</th><th>Present</th><th>Absent</th><th>Late</th><th>On leave</th></tr></thead>
            <tbody>
              {report.rows.map((r: any) => (
                <tr key={r.staffId}>
                  <td>{r.employeeNo} {r.firstName} {r.lastName}</td>
                  <td>{r.present}</td><td>{r.absent}</td><td>{r.late}</td><td>{r.onLeave}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const StaffIdCardsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/hr/staff`).then((r) => setStaffList(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadOne = async (id: string) => {
    try {
      await downloadPdf(`/s/${schoolSlug}/api/hr/staff/${id}/pdf/id-card`);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const downloadBulk = async (all?: boolean) => {
    try {
      const q = all || selected.size === 0
        ? ""
        : `?staffIds=${[...selected].join(",")}`;
      await downloadPdf(`/s/${schoolSlug}/api/hr/staff/pdf/id-cards/bulk${q}`);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Generate professional staff ID cards (PDF). Select staff or print all active employees.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => downloadBulk(true)}>
          <Download className="w-4 h-4" /> All active staff
        </button>
        <button type="button" className="btn-ghost" onClick={() => downloadBulk(false)} disabled={selected.size === 0}>
          Selected ({selected.size})
        </button>
      </div>
      <ul className="space-y-2">
        {staffList.map((s) => (
          <li key={s.id} className="card p-4 flex justify-between items-center gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <span className="text-white">{s.employeeNo} — {s.firstName} {s.lastName}</span>
              <span className="text-slate-500 text-sm">{s.jobTitle ?? s.department ?? ""}</span>
            </label>
            <button type="button" className="btn-ghost text-xs" onClick={() => downloadOne(s.id)}>
              <Download className="w-3 h-3" /> PDF
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const PayrollTaxRulesPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission, formatMoney, currency } = useAuth();
  const amountStep = moneyInputStep(currency);
  const [rules, setRules] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", ratePercent: "", thresholdMinor: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/hr/tax-rules`).then((r) => setRules(r.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/hr/tax-rules`, {
      name: form.name,
      ratePercent: Number(form.ratePercent),
      thresholdMinor: form.thresholdMinor ? minorFromMajor(Number(form.thresholdMinor), currency) : 0,
    });
    toast("Tax rule added", "success");
    setForm({ name: "", ratePercent: "", thresholdMinor: "" });
    load();
  };

  return (
    <div className="space-y-3">
      {hasPermission("hr.manage") && (
        <form onSubmit={submit} className="card p-4 grid md:grid-cols-4 gap-3">
          <input className="input" required placeholder="Rule name (e.g. PAYE)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="number" required placeholder="Rate %" value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} />
          <input className="input" type="number" step={amountStep} placeholder={`Threshold (${currency})`} value={form.thresholdMinor} onChange={(e) => setForm({ ...form, thresholdMinor: e.target.value })} />
          <button type="submit" className="btn-primary">Add rule</button>
        </form>
      )}
      <ul className="text-sm text-slate-300 space-y-1">
        {rules.map((r) => (
          <li key={r.id}>{r.name}: {r.ratePercent}% above {r.thresholdMinor ? formatMoney(r.thresholdMinor) : formatMoney(0)}</li>
        ))}
      </ul>
    </div>
  );
};
