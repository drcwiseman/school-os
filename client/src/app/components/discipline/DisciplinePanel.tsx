import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";

type StudentOpt = { id: string; firstName: string; lastName: string; admissionNumber?: string };

const CATEGORIES = [
  { value: "misconduct", label: "Misconduct" },
  { value: "bullying", label: "Bullying" },
  { value: "uniform", label: "Uniform" },
  { value: "lateness", label: "Lateness" },
  { value: "fighting", label: "Fighting" },
  { value: "property", label: "Property damage" },
  { value: "other", label: "Other" },
];

const SEVERITIES = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
  { value: "critical", label: "Critical" },
];

const StatCard: React.FC<{
  label: string;
  value: number;
  className?: string;
  onClick?: () => void;
}> = ({ label, value, className = "text-white", onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`card p-4 text-left w-full transition ${onClick ? "hover:border-amber-500/40 cursor-pointer" : "cursor-default"}`}
  >
    <p className="text-slate-500 text-sm">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${className}`}>{value}</p>
  </button>
);

export const DisciplinePanel: React.FC<{ schoolSlug: string; students: StudentOpt[] }> = ({ schoolSlug, students }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<{ total: number; minor: number; major: number } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    studentId: "",
    category: "misconduct",
    severity: "minor",
    description: "",
    incidentDate: "",
  });
  const [actionForm, setActionForm] = useState({ action: "", notes: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, list] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/discipline/dashboard`),
        api.get(`/s/${schoolSlug}/api/discipline/incidents/enriched`),
      ]);
      setDash(d.data);
      setRows(list.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setActions([]); return; }
    api.get(`/s/${schoolSlug}/api/discipline/incidents/${selectedId}/actions`)
      .then((r) => setActions(r.data ?? []))
      .catch(() => setActions([]));
  }, [selectedId, schoolSlug]);

  const createIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = {
      studentId: form.studentId,
      category: form.category,
      severity: form.severity,
      description: form.description,
    };
    if (form.incidentDate) body.incidentDate = form.incidentDate;
    if (editId) {
      await api.patch(`/s/${schoolSlug}/api/discipline/incidents/${editId}`, body);
      toast("Incident updated", "success");
    } else {
      await api.post(`/s/${schoolSlug}/api/discipline/incidents`, body);
      toast("Incident logged", "success");
    }
    setForm({ studentId: "", category: "misconduct", severity: "minor", description: "", incidentDate: "" });
    setEditId(null);
    load();
  };

  const startEdit = (row: any) => {
    const inc = row.incident;
    setEditId(inc.id);
    setForm({
      studentId: inc.studentId,
      category: inc.category,
      severity: inc.severity,
      description: inc.description,
      incidentDate: inc.incidentDate ? new Date(inc.incidentDate).toISOString().slice(0, 10) : "",
    });
    setSelectedId(inc.id);
  };

  const removeIncident = async (id: string) => {
    if (!window.confirm("Delete this incident and all follow-up actions?")) return;
    await api.delete(`/s/${schoolSlug}/api/discipline/incidents/${id}`);
    toast("Incident removed", "success");
    if (selectedId === id) setSelectedId("");
    load();
  };

  const addAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    await api.post(`/s/${schoolSlug}/api/discipline/incidents/${selectedId}/actions`, actionForm);
    toast("Action recorded", "success");
    setActionForm({ action: "", notes: "" });
    const r = await api.get(`/s/${schoolSlug}/api/discipline/incidents/${selectedId}/actions`);
    setActions(r.data ?? []);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total incidents" value={dash.total} />
          <StatCard label="Minor" value={dash.minor} className="text-slate-300" />
          <StatCard label="Major / critical" value={dash.major} className="text-amber-400" />
        </div>
      )}

      {hasPermission("discipline.manage") && (
        <form onSubmit={createIncident} className="card p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            {editId ? "Edit incident" : "Log incident"}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="label">Student</label>
              <select className="input" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.admissionNumber ? `${s.admissionNumber} — ` : ""}{s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-[72px]" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editId ? "Update" : "Save incident"}</button>
            {editId && (
              <button type="button" className="btn-ghost" onClick={() => { setEditId(null); setForm({ studentId: "", category: "misconduct", severity: "minor", description: "", incidentDate: "" }); }}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Description</th>
              <th>Actions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">No discipline incidents yet.</td></tr>
            ) : rows.map((row: any) => {
              const inc = row.incident;
              const name = `${row.student.admissionNumber ?? ""} ${row.student.firstName} ${row.student.lastName}`.trim();
              const sevClass = inc.severity === "critical" || inc.severity === "major" ? "text-amber-400" : "text-slate-400";
              return (
                <tr
                  key={inc.id}
                  className={selectedId === inc.id ? "bg-slate-800/60" : "cursor-pointer hover:bg-slate-800/30"}
                  onClick={() => setSelectedId(inc.id)}
                >
                  <td>{new Date(inc.incidentDate).toLocaleDateString()}</td>
                  <td>{name}</td>
                  <td className="capitalize">{inc.category}</td>
                  <td className={`capitalize ${sevClass}`}>{inc.severity}</td>
                  <td className="max-w-xs truncate">{inc.description}</td>
                  <td>{row.actionCount ?? 0}</td>
                  <td className="space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {hasPermission("discipline.manage") && (
                      <>
                        <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(row)}>Edit</button>
                        <button type="button" className="btn-ghost text-xs text-rose-400" onClick={() => removeIncident(inc.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-white">Follow-up actions</h3>
          {hasPermission("discipline.manage") && (
            <form onSubmit={addAction} className="flex flex-wrap gap-3 items-end">
              <input className="input flex-1 min-w-[200px]" placeholder="Action taken (e.g. parent call, detention)" required value={actionForm.action} onChange={(e) => setActionForm({ ...actionForm, action: e.target.value })} />
              <input className="input flex-1 min-w-[200px]" placeholder="Notes" value={actionForm.notes} onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })} />
              <button type="submit" className="btn-secondary">Add action</button>
            </form>
          )}
          <ul className="text-sm text-slate-300 space-y-2">
            {actions.length === 0 ? <li className="text-slate-500">No follow-up actions yet.</li> : actions.map((a) => (
              <li key={a.id} className="border-b border-slate-800 pb-2">
                <span className="text-white font-medium">{a.action}</span>
                <span className="text-slate-500 ml-2">{new Date(a.actionDate).toLocaleString()}</span>
                {a.notes && <p className="text-slate-400 mt-1">{a.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
