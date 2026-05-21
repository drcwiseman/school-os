import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Search, Plus, Loader2, Download, Upload, Cake, Pencil } from "lucide-react";

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
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ admissionNumber: "", firstName: "", lastName: "", gender: "", status: "active" });
  const [savingEdit, setSavingEdit] = useState(false);

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

  const openEdit = (s: Student) => {
    setEditTarget(s);
    setEditForm({
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender ?? "",
      status: s.status,
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await api.patch(`/s/${schoolSlug}/api/students/${editTarget.id}`, {
        admissionNumber: editForm.admissionNumber,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        gender: editForm.gender || undefined,
        status: editForm.status,
      });
      toast("Student updated", "success");
      setEditTarget(null);
      fetchStudents();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingEdit(false);
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
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Inactive
          </span>
        );
      case "graduated":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Graduated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 capitalize">
            {status}
          </span>
        );
    }
  };

  const avatar = (s: Student) => {
    if (s.photoUrl) {
      return (
        <div className="relative group flex shrink-0">
          <img src={s.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700/50 shadow-md group-hover:scale-105 transition-transform duration-250" />
          <div className="absolute inset-0 rounded-xl ring-1 ring-black/10 dark:ring-white/10 pointer-events-none" />
        </div>
      );
    }
    const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
    const charCodeSum = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
    const gradients = [
      "from-blue-500/25 to-indigo-500/25 text-blue-400 border-blue-500/30",
      "from-emerald-500/25 to-teal-500/25 text-emerald-400 border-emerald-500/30",
      "from-purple-500/25 to-pink-500/25 text-purple-400 border-purple-500/30",
      "from-amber-500/25 to-orange-500/25 text-amber-400 border-amber-500/30",
      "from-cyan-500/25 to-sky-500/25 text-cyan-400 border-cyan-500/30",
      "from-rose-500/25 to-red-500/25 text-rose-400 border-rose-500/30"
    ];
    const gradient = gradients[charCodeSum % gradients.length];
    return (
      <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold tracking-wider border shadow-sm`}>
        {initials}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student Directory</h1>
          <p className="text-slate-400 text-sm mt-1">Manage, filter, and view all student records across classes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission("students.view") && (
            <button 
              type="button" 
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white transition-all duration-300 backdrop-blur-md shadow-sm" 
              onClick={exportCsv}
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          {hasPermission("students.create") && (
            <>
              <button 
                type="button" 
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white transition-all duration-300 backdrop-blur-md shadow-sm" 
                onClick={() => setShowImport((v) => !v)}
              >
                <Upload className="w-4 h-4" /> {showImport ? "Cancel Import" : "Import CSV"}
              </button>
              <Link 
                to={`/s/${schoolSlug}/students/new`} 
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300"
              >
                <Plus className="w-4 h-4" /> Add Student
              </Link>
            </>
          )}
        </div>
      </div>

      {birthdays.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-500/5 to-purple-500/5 dark:from-pink-950/10 dark:to-purple-950/10 p-5 backdrop-blur-xl shadow-lg flex flex-wrap items-center gap-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400 shrink-0 shadow-sm">
            <Cake className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white text-sm font-semibold">Upcoming Student Birthdays</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-slate-400 text-xs">
              {birthdays.map((b: any, i) => (
                <span key={b.id} className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-200">{b.firstName} {b.lastName}</span> 
                  <span className="text-pink-400 font-medium">({b.daysUntil === 0 ? "today 🎂" : `${b.daysUntil}d`})</span>
                  {i < birthdays.length - 1 && <span className="text-slate-600">•</span>}
                </span>
              ))}
            </div>
          </div>
          <Link 
            to={`/s/${schoolSlug}/students/birthdays`} 
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 transition-all duration-300 shadow-sm"
          >
            View All
          </Link>
        </div>
      )}

      {showImport && hasPermission("students.create") && (
        <form onSubmit={importCsv} className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Import Students from CSV</h3>
            <span className="text-xs text-slate-400">Separate values with commas</span>
          </div>
          <textarea 
            className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[120px]" 
            value={csvText} 
            onChange={(e) => setCsvText(e.target.value)} 
          />
          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => setShowImport(false)} 
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200" 
              disabled={importing}
            >
              {importing ? "Importing…" : "Run Import"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Roll / Admission No.</label>
            <input 
              className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
              placeholder="e.g. 2026-001" 
              value={roll} 
              onChange={(e) => setRoll(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Student Name</label>
            <input 
              className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
              placeholder="e.g. Jane" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Class Filter</label>
            <select 
              className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
              value={classId} 
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <button 
              type="button" 
              className="w-full px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2" 
              onClick={applyFilters}
            >
              <Search className="w-4 h-4" /> Apply Filters
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-700/40 bg-slate-950/20">
          <div className="table-wrap">
            <table className="table w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/30">
                  <th className="w-14 px-4 py-3.5" />
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Admission No.</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Gender</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Stream</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Parent</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Address</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="text-sm">Loading students...</span>
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-500 italic">
                      No student records found matching the filters.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">{avatar(s)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300 font-semibold">{s.admissionNumber}</td>
                      <td className="px-4 py-3 font-semibold text-white">{s.firstName} {s.lastName}</td>
                      <td className="px-4 py-3 capitalize text-sm text-slate-300">{s.gender ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-200 text-sm font-medium">{s.className ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{s.streamName ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 max-w-[140px] truncate">{s.primaryParentName ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate">{s.address ?? "—"}</td>
                      <td className="px-4 py-3">{getStatusBadge(s.status)}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link 
                          to={`/s/${schoolSlug}/students/${s.id}`} 
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all"
                        >
                          View
                        </Link>
                        {hasPermission("students.edit") && (
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {hasPermission("students.delete") && (
                          <ConfirmAction
                            label="Remove"
                            confirmMessage={`Are you sure you want to delete ${s.firstName} ${s.lastName}?`}
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

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={saveEdit} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Edit student</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Admission number</label>
                <input required className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm" value={editForm.admissionNumber} onChange={(e) => setEditForm({ ...editForm, admissionNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">First name</label>
                  <input required className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Last name</label>
                  <input required className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Gender</label>
                  <select className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm" value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                  <select className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="graduated">Graduated</option>
                    <option value="transferred">Transferred</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded-xl text-sm text-slate-400" onClick={() => setEditTarget(null)}>Cancel</button>
              <button type="submit" disabled={savingEdit} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
