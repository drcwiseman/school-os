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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staffId: "", startDate: "", endDate: "", reason: "" });

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="flex justify-end">
        {hasPermission("hr.view") && (
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New request"}
          </button>
        )}
      </div>
      {showForm && (
        <form onSubmit={submit} className="card p-4 grid md:grid-cols-4 gap-3">
          <input className="input" required placeholder="Staff UUID" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} />
          <input className="input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className="input" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <input className="input" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <div className="md:col-span-4">
            <button type="submit" className="btn-primary">Submit</button>
          </div>
        </form>
      )}
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
    </div>
  );
}
