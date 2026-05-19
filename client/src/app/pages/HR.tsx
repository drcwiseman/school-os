import React, { useState } from "react";
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
        <ModuleCrud title="Leave requests" apiPath="hr/leave"
          columns={[{ key: "staffId", label: "Staff" }, { key: "status", label: "Status" }, { key: "startDate", label: "From", render: (r) => new Date(r.startDate).toLocaleDateString() }]}
          fields={[
            { name: "staffId", label: "Staff UUID", required: true },
            { name: "startDate", label: "Start", type: "date", required: true },
            { name: "endDate", label: "End", type: "date", required: true },
            { name: "reason", label: "Reason" },
          ]} />
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
