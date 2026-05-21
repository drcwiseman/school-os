import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Search, Plus, Loader2, Download, Upload, Cake } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const CSV_TEMPLATE = "admissionNumber,firstName,lastName,status,gender\n2026-001,Jane,Doe,active,female";

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  gender?: string | null;
  photoUrl?: string | null;
  className?: string | null;
  streamName?: string | null;
  primaryParentName?: string | null;
  address?: string | null;
}

type ClassRow = { id: string; name: string };

export const StudentsList: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roll, setRoll] = useState(searchParams.get("roll") ?? "");
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState(CSV_TEMPLATE);
  const [importing, setImporting] = useState(false);
  const [birthdays, setBirthdays] = useState<any[]>([]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (roll) params.set("roll", roll);
      if (name) params.set("name", name);
      if (classId) params.set("classId", classId);
      const res = await api.get(`/s/${schoolSlug}/api/students?${params}`);
      setStudents(res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, roll, name, classId]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/classes`).then((r) => setClasses(r.data ?? [])).catch(() => {});
    api.get(`/s/${schoolSlug}/api/student-mgmt/birthdays/upcoming?days=14`).then((r) => setBirthdays((r.data ?? []).slice(0, 5))).catch(() => {});
  }, [schoolSlug]);

  const applyFilters = () => {
    const p = new URLSearchParams();
    if (roll) p.set("roll", roll);
    if (name) p.set("name", name);
    if (classId) p.set("classId", classId);
    setSearchParams(p);
    fetchStudents();
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`${API_BASE}/s/${schoolSlug}/api/students/export/csv`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students.csv";
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
      const res = await api.post(`/s/${schoolSlug}/api/students/import/csv`, { csv: csvText });
      const count = res.data?.imported ?? res.imported ?? 0;
      toast(`Imported ${count} students`, "success");
      setShowImport(false);
      fetchStudents();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const removeStudent = async (id: string, label: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/students/${id}`);
      toast(`${label} removed`, "success");
      fetchStudents();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="badge-green">Active</span>;
      case "inactive": return <span className="badge-gray">Inactive</span>;
      case "graduated": return <span className="badge-blue">Graduated</span>;
      default: return <span className="badge-gray">{status}</span>;
    }
  };

  const avatar = (s: Student) => {
    if (s.photoUrl) {
      return <img src={s.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-600" />;
    }
    const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
    return (
      <span className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
        {initials}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">All students</h1>
        <div className="flex flex-wrap gap-2">
          {hasPermission("students.view") && (
            <button type="button" className="btn-ghost" onClick={exportCsv}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          {hasPermission("students.create") && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setShowImport((v) => !v)}>
                <Upload className="w-4 h-4" /> {showImport ? "Cancel import" : "Import CSV"}
              </button>
              <Link to={`/s/${schoolSlug}/students/new`} className="btn-primary">
                <Plus className="w-4 h-4" /> Add student
              </Link>
            </>
          )}
        </div>
      </div>

      {birthdays.length > 0 && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <Cake className="w-5 h-5 text-pink-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Upcoming birthdays</p>
            <p className="text-slate-400 text-xs truncate">
              {birthdays.map((b: any) => `${b.firstName} (${b.daysUntil === 0 ? "today" : `${b.daysUntil}d`})`).join(" · ")}
            </p>
          </div>
          <Link to={`/s/${schoolSlug}/students/birthdays`} className="btn-ghost text-xs shrink-0">View all</Link>
        </div>
      )}

      {showImport && hasPermission("students.create") && (
        <form onSubmit={importCsv} className="card p-6 space-y-3">
          <h3 className="font-semibold text-white">Import students from CSV</h3>
          <textarea className="input font-mono text-xs min-h-[120px]" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={importing}>{importing ? "Importing…" : "Run import"}</button>
        </form>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <label className="label">Roll / Adm. no.</label>
            <input className="input" placeholder="2026-001" value={roll} onChange={(e) => setRoll(e.target.value)} />
          </div>
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <label className="label">Name</label>
            <input className="input" placeholder="Jane" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="min-w-[140px] max-w-xs">
            <label className="label">Class</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" className="btn-primary" onClick={applyFilters}>
              <Search className="w-4 h-4" /> Apply
            </button>
          </div>
        </div>

        <div className="table-wrap rounded-xl overflow-hidden border border-slate-700/50">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12" />
                <th>Roll</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Class</th>
                <th>Stream</th>
                <th>Parent</th>
                <th>Address</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" /></td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">No students found.</td></tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id}>
                    <td>{avatar(s)}</td>
                    <td className="font-mono text-xs">{s.admissionNumber}</td>
                    <td className="font-medium text-white">{s.firstName} {s.lastName}</td>
                    <td className="capitalize text-sm">{s.gender ?? "—"}</td>
                    <td>{s.className ?? "—"}</td>
                    <td>{s.streamName ?? "—"}</td>
                    <td className="text-sm max-w-[140px] truncate">{s.primaryParentName ?? "—"}</td>
                    <td className="text-xs text-slate-400 max-w-[160px] truncate">{s.address ?? "—"}</td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td className="text-right space-x-2">
                      <Link to={`/s/${schoolSlug}/students/${s.id}`} className="btn-ghost text-xs inline-flex">View</Link>
                      {hasPermission("students.delete") && (
                        <ConfirmAction
                          label="Remove"
                          confirmMessage={`Remove ${s.firstName} ${s.lastName}?`}
                          onConfirm={() => removeStudent(s.id, `${s.firstName} ${s.lastName}`)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
