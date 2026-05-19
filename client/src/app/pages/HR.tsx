import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { useAuth } from "../state/AuthContext";
import { ModuleCrud } from "../components/ModuleCrud";
import { Download, Upload } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const STAFF_CSV_TEMPLATE = "employeeNo,firstName,lastName,email,department\nE001,Jane,Doe,jane@school.com,Admin";

export const HR: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<"staff" | "leave">("staff");
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState(STAFF_CSV_TEMPLATE);
  const [importing, setImporting] = useState(false);
  const [staffKey, setStaffKey] = useState(0);
  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm ${active ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  const exportCsv = async () => {
    try {
      const res = await fetch(`${API_BASE}/s/${schoolSlug}/api/hr/staff/export/csv`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "staff.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast("Export downloaded", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const importCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/hr/staff/import/csv`, { csv: csvText });
      toast(`Imported ${res.data?.imported ?? 0} staff`, "success");
      setShowImport(false);
      setStaffKey((k) => k + 1);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <HRHeader />
      <HRTabs tab={tab} setTab={setTab} tabCls={tabCls} />
      {tab === "staff" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {hasPermission("hr.view") && (
              <button type="button" className="btn-ghost" onClick={exportCsv}>
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
            {hasPermission("hr.manage") && (
              <button type="button" className="btn-ghost" onClick={() => setShowImport((v) => !v)}>
                <Upload className="w-4 h-4" /> {showImport ? "Cancel import" : "Import CSV"}
              </button>
            )}
          </div>
          {showImport && hasPermission("hr.manage") && (
            <form onSubmit={importCsv} className="card p-6 space-y-3">
              <h3 className="font-semibold text-white">Import staff from CSV</h3>
              <p className="text-sm text-slate-400">Header: employeeNo, firstName, lastName, email, department</p>
              <textarea className="input font-mono text-xs min-h-[120px]" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
              <button type="submit" className="btn-primary" disabled={importing}>
                {importing ? "Importing…" : "Run import"}
              </button>
            </form>
          )}
          <ModuleCrud key={staffKey} title="Staff" apiPath="hr/staff" allowDelete deletePermission="hr.manage"
            columns={[{ key: "employeeNo", label: "Emp #" }, { key: "firstName", label: "First" }, { key: "lastName", label: "Last" }, { key: "department", label: "Dept" }]}
            fields={[
              { name: "employeeNo", label: "Employee No", required: true },
              { name: "firstName", label: "First name", required: true },
              { name: "lastName", label: "Last name", required: true },
              { name: "department", label: "Department" },
            ]} />
          <StaffContractsPanel schoolSlug={schoolSlug!} hasPermission={hasPermission} toast={toast} />
        </>
      ) : (
        <LeaveRequestsPanel schoolSlug={schoolSlug!} hasPermission={hasPermission} toast={toast} />
      )}
    </div>
  );
};

function HRHeader() {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">Human Resources</h1>
        <p className="text-slate-400 mt-1">Staff directory and leave management</p>
      </div>
    </div>
  );
}

function HRTabs({ tab, setTab, tabCls }: { tab: string; setTab: (t: "staff" | "leave") => void; tabCls: (a: boolean) => string }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setTab("staff")} className={tabCls(tab === "staff")}>Staff</button>
      <button type="button" onClick={() => setTab("leave")} className={tabCls(tab === "leave")}>Leave</button>
    </div>
  );
}

type LeaveRow = {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  staffFirstName?: string;
  staffLastName?: string;
  employeeNo?: string;
};

function LeaveRequestsPanel({ schoolSlug, hasPermission, toast }: { schoolSlug: string; hasPermission: (p: string) => boolean; toast: (m: string, t?: "success" | "error") => void }) {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staffId: "", startDate: "", endDate: "", reason: "" });
  const [conflictWarning, setConflictWarning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows((await api.get(`/s/${schoolSlug}/api/hr/leave`)).data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/hr/staff`).then((r) => setStaffList(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => {
    if (!form.staffId || !form.startDate || !form.endDate) {
      setConflictWarning(false);
      return;
    }
    const params = new URLSearchParams({
      staffId: form.staffId,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    api.get(`/s/${schoolSlug}/api/hr/leave/check?${params}`)
      .then((r) => setConflictWarning(!!r.data?.hasConflict))
      .catch(() => setConflictWarning(false));
  }, [form.staffId, form.startDate, form.endDate, schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conflictWarning) {
      toast("Leave overlaps an existing request", "error");
      return;
    }
    try {
      await api.post(`/s/${schoolSlug}/api/hr/leave`, form);
      toast("Leave request submitted", "success");
      setShowForm(false);
      setForm({ staffId: "", startDate: "", endDate: "", reason: "" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      await api.patch(`/s/${schoolSlug}/api/hr/leave/${id}`, { status });
      toast(`Leave ${status}`, "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className={viewMode === "list" ? "btn-primary text-sm" : "btn-ghost text-sm"} onClick={() => setViewMode("list")}>List</button>
          <button type="button" className={viewMode === "calendar" ? "btn-primary text-sm" : "btn-ghost text-sm"} onClick={() => setViewMode("calendar")}>Calendar</button>
        </div>
        {hasPermission("hr.view") && (
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New request"}
          </button>
        )}
      </div>
      {showForm && (
        <form onSubmit={submit} className="card p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="label">Staff</label>
              <select className="input" required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Select staff…</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.employeeNo} — {s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start</label>
              <input className="input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input className="input" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Reason</label>
              <input className="input" placeholder="Optional" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          {conflictWarning && (
            <p className="text-sm text-amber-400">Warning: dates overlap another pending or approved leave for this staff member.</p>
          )}
          <button type="submit" className="btn-primary">Submit</button>
        </form>
      )}
      {viewMode === "calendar" ? (
        <LeaveCalendar rows={rows} />
      ) : (
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Period</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No leave requests.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{r.employeeNo ? `${r.employeeNo} — ` : ""}{r.staffFirstName} {r.staffLastName}</td>
                <td className="text-sm">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</td>
                <td className="text-slate-400">{r.reason || "—"}</td>
                <td className="capitalize">{r.status}</td>
                <td>
                  {r.status === "pending" && hasPermission("hr.manage") && (
                    <div className="flex gap-2">
                      <button type="button" className="btn-ghost text-xs text-emerald-400" onClick={() => setStatus(r.id, "approved")}>Approve</button>
                      <button type="button" className="btn-ghost text-xs text-red-400" onClick={() => setStatus(r.id, "rejected")}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

type StaffMember = { id: string; employeeNo: string; firstName: string; lastName: string };
type ContractRow = { id: string; salary: number; startDate: string; endDate?: string | null };

function StaffContractsPanel({ schoolSlug, hasPermission, toast }: { schoolSlug: string; hasPermission: (p: string) => boolean; toast: (m: string, t?: "success" | "error") => void }) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [form, setForm] = useState({ salary: "", startDate: "", endDate: "" });
  const [closeDates, setCloseDates] = useState<Record<string, string>>({});
  const [salaryEdits, setSalaryEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/hr/staff`).then((r) => setStaffList(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => {
    if (!selectedStaff) { setContracts([]); return; }
    api.get(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts`).then((r) => setContracts(r.data ?? [])).catch((err: any) => toast(err.message, "error"));
  }, [selectedStaff, schoolSlug]);

  const addContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    const cents = Math.round(parseFloat(form.salary) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { toast("Enter a valid salary", "error"); return; }
    try {
      await api.post(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts`, {
        salary: cents,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
      });
      toast("Contract added", "success");
      setForm({ salary: "", startDate: "", endDate: "" });
      const r = await api.get(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts`);
      setContracts(r.data ?? []);
    } catch (err: any) { toast(err.message, "error"); }
  };

  const updateSalary = async (contractId: string) => {
    if (!selectedStaff) return;
    const cents = Math.round(parseFloat(salaryEdits[contractId]) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { toast("Enter a valid salary", "error"); return; }
    try {
      await api.patch(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts/${contractId}`, { salary: cents });
      toast("Salary updated", "success");
      const r = await api.get(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts`);
      setContracts(r.data ?? []);
    } catch (err: any) { toast(err.message, "error"); }
  };

  const closeContract = async (contractId: string) => {
    if (!selectedStaff) return;
    const endDate = closeDates[contractId];
    if (!endDate) { toast("Pick an end date", "error"); return; }
    try {
      await api.patch(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts/${contractId}`, { endDate });
      toast("Contract updated", "success");
      const r = await api.get(`/s/${schoolSlug}/api/hr/staff/${selectedStaff}/contracts`);
      setContracts(r.data ?? []);
    } catch (err: any) { toast(err.message, "error"); }
  };

  if (!hasPermission("hr.view")) return null;

  return (
    <div className="card p-6 space-y-4">
      <h3 className="font-semibold text-white">Employment contracts</h3>
      <div>
        <label className="label">Staff member</label>
        <select className="input" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
          <option value="">Select staff…</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.employeeNo} — {s.firstName} {s.lastName}</option>
          ))}
        </select>
      </div>
      {selectedStaff && (
        <>
          <ul className="text-sm space-y-1 text-slate-300">
            {contracts.length === 0 ? (
              <li className="text-slate-500">No contracts on file.</li>
            ) : contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-slate-800/50">
                <span>
                  ${(c.salary / 100).toFixed(2)} / yr — {new Date(c.startDate).toLocaleDateString()}
                  {c.endDate ? ` – ${new Date(c.endDate).toLocaleDateString()}` : " (open)"}
                </span>
                {!c.endDate && hasPermission("hr.manage") && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      className="input text-xs w-28"
                      type="number"
                      step="0.01"
                      placeholder="New salary"
                      value={salaryEdits[c.id] ?? ""}
                      onChange={(e) => setSalaryEdits({ ...salaryEdits, [c.id]: e.target.value })}
                    />
                    <button type="button" className="btn-ghost text-xs" onClick={() => updateSalary(c.id)}>Update salary</button>
                    <input
                      className="input text-xs w-36"
                      type="date"
                      value={closeDates[c.id] ?? ""}
                      onChange={(e) => setCloseDates({ ...closeDates, [c.id]: e.target.value })}
                    />
                    <button type="button" className="btn-ghost text-xs" onClick={() => closeContract(c.id)}>Set end date</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {hasPermission("hr.manage") && (
            <form onSubmit={addContract} className="grid md:grid-cols-4 gap-3 items-end border-t border-slate-800 pt-4">
              <div>
                <label className="label">Annual salary (USD)</label>
                <input className="input" type="number" step="0.01" required value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              </div>
              <div>
                <label className="label">Start date</label>
                <input className="input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="label">End date (optional)</label>
                <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary">Add contract</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function hasStaffOverlap(leaves: LeaveRow[]) {
  const ids = leaves.map((l) => l.staffId);
  return new Set(ids).size < ids.length;
}

function LeaveCalendar({ rows }: { rows: LeaveRow[] }) {
  const [month, setMonth] = useState(() => new Date());
  const approved = rows.filter((r) => r.status === "approved");
  const active = rows.filter((r) => r.status === "approved" || r.status === "pending");
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const startPad = new Date(year, monthIdx, 1).getDay();

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (day: number) => `${year}-${pad(monthIdx + 1)}-${pad(day)}`;

  const onLeave = (day: number) => {
    const d = dateStr(day);
    return approved.filter((l) => {
      const s = l.startDate.slice(0, 10);
      const e = l.endDate.slice(0, 10);
      return d >= s && d <= e;
    });
  };

  const conflictsOnDay = (day: number) => {
    const d = dateStr(day);
    const dayActive = active.filter((l) => {
      const s = l.startDate.slice(0, 10);
      const e = l.endDate.slice(0, 10);
      return d >= s && d <= e;
    });
    return hasStaffOverlap(dayActive);
  };

  const prev = () => setMonth(new Date(year, monthIdx - 1, 1));
  const next = () => setMonth(new Date(year, monthIdx + 1, 1));

  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="card p-5 space-y-4">
      <div className="flex justify-between items-center">
        <button type="button" className="btn-ghost text-sm" onClick={prev}>← Prev</button>
        <h3 className="font-semibold text-white">{month.toLocaleString("default", { month: "long", year: "numeric" })}</h3>
        <button type="button" className="btn-ghost text-sm" onClick={next}>Next →</button>
      </div>
      <p className="text-xs text-slate-500">Approved leave · amber border = overlapping requests for same staff</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="min-h-[72px]" />;
          const leaves = onLeave(day);
          const conflict = conflictsOnDay(day);
          return (
            <div key={day} className={`min-h-[72px] rounded border p-1 text-left ${
              conflict ? "border-amber-500/60 bg-amber-500/10" : leaves.length ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800"
            }`}>
              <span className="text-xs text-slate-400">{day}</span>
              {leaves.map((l) => (
                <p key={l.id} className="text-[10px] text-emerald-300 truncate mt-0.5" title={`${l.staffFirstName} ${l.staffLastName}`}>
                  {l.staffFirstName?.[0]}{l.staffLastName}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
