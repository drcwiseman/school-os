import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Loader2, HeartPulse } from "lucide-react";

type StudentOpt = { id: string; firstName: string; lastName: string; admissionNumber?: string };
type Tab = "visits" | "flags";

const FLAG_TYPES = [
  { value: "allergy", label: "Allergy" },
  { value: "asthma", label: "Asthma" },
  { value: "diabetes", label: "Diabetes" },
  { value: "epilepsy", label: "Epilepsy" },
  { value: "medication", label: "Ongoing medication" },
  { value: "dietary", label: "Dietary restriction" },
  { value: "other", label: "Other" },
];

const StatCard: React.FC<{ label: string; value: number; className?: string; onClick?: () => void }> = ({
  label, value, className = "text-white", onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`card p-4 text-left w-full transition ${onClick ? "hover:border-rose-500/40 cursor-pointer" : ""}`}
  >
    <p className="text-slate-500 text-sm">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${className}`}>{value}</p>
  </button>
);

export const HealthPanel: React.FC<{ schoolSlug: string; students: StudentOpt[] }> = ({ schoolSlug, students }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("visits");
  const [dash, setDash] = useState<{ visits: number; inSickbay: number; flags: number; activeFlags: number } | null>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitForm, setVisitForm] = useState({ studentId: "", complaint: "", treatment: "" });
  const [flagForm, setFlagForm] = useState({ studentId: "", flag: "allergy", notes: "" });
  const [editVisitId, setEditVisitId] = useState<string | null>(null);
  const [editFlagId, setEditFlagId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, v, f] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/health/dashboard`),
        api.get(`/s/${schoolSlug}/api/health/visits/enriched`),
        api.get(`/s/${schoolSlug}/api/health/flags/enriched`),
      ]);
      setDash(d.data);
      setVisits(v.data ?? []);
      setFlags(f.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const studentLabel = (s: { firstName: string; lastName: string; admissionNumber?: string }) =>
    `${s.admissionNumber ? `${s.admissionNumber} — ` : ""}${s.firstName} ${s.lastName}`;

  const saveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editVisitId) {
      await api.patch(`/s/${schoolSlug}/api/health/visits/${editVisitId}`, visitForm);
      toast("Visit updated", "success");
    } else {
      await api.post(`/s/${schoolSlug}/api/health/visits`, visitForm);
      toast("Visit logged", "success");
    }
    setVisitForm({ studentId: "", complaint: "", treatment: "" });
    setEditVisitId(null);
    load();
  };

  const saveFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editFlagId) {
      await api.patch(`/s/${schoolSlug}/api/health/flags/${editFlagId}`, flagForm);
      toast("Flag updated", "success");
    } else {
      await api.post(`/s/${schoolSlug}/api/health/flags`, flagForm);
      toast("Health flag added", "success");
    }
    setFlagForm({ studentId: "", flag: "allergy", notes: "" });
    setEditFlagId(null);
    load();
  };

  const discharge = async (id: string) => {
    await api.post(`/s/${schoolSlug}/api/health/visits/${id}/discharge`, {});
    toast("Student discharged from sickbay", "success");
    load();
  };

  const toggleFlag = async (id: string, active: boolean) => {
    await api.patch(`/s/${schoolSlug}/api/health/flags/${id}`, { active: !active });
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Sickbay visits" value={dash.visits} onClick={() => setTab("visits")} />
          <StatCard label="In sickbay now" value={dash.inSickbay} className="text-rose-400" onClick={() => setTab("visits")} />
          <StatCard label="Health flags" value={dash.flags} onClick={() => setTab("flags")} />
          <StatCard label="Active flags" value={dash.activeFlags} className="text-amber-400" onClick={() => setTab("flags")} />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button type="button" className={`tab-pill ${tab === "visits" ? "active" : ""}`} onClick={() => setTab("visits")}>Sickbay visits</button>
        <button type="button" className={`tab-pill ${tab === "flags" ? "active" : ""}`} onClick={() => setTab("flags")}>Health flags</button>
      </div>

      {tab === "visits" && (
        <>
          {hasPermission("health.manage") && (
            <form onSubmit={saveVisit} className="card p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-400" />
                {editVisitId ? "Edit visit" : "Log sickbay visit"}
              </h3>
              <div className="grid md:grid-cols-3 gap-3">
                <select className="input" required value={visitForm.studentId} onChange={(e) => setVisitForm({ ...visitForm, studentId: e.target.value })}>
                  <option value="">Student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{studentLabel(s)}</option>)}
                </select>
                <input className="input md:col-span-2" placeholder="Complaint / symptoms" required value={visitForm.complaint} onChange={(e) => setVisitForm({ ...visitForm, complaint: e.target.value })} />
                <input className="input md:col-span-3" placeholder="Treatment given" value={visitForm.treatment} onChange={(e) => setVisitForm({ ...visitForm, treatment: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">{editVisitId ? "Update" : "Save visit"}</button>
                {editVisitId && <button type="button" className="btn-ghost" onClick={() => { setEditVisitId(null); setVisitForm({ studentId: "", complaint: "", treatment: "" }); }}>Cancel</button>}
              </div>
            </form>
          )}
          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead><tr><th>Date</th><th>Student</th><th>Complaint</th><th>Treatment</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {visits.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">No sickbay visits yet.</td></tr>
                ) : visits.map((row: any) => {
                  const v = row.visit;
                  const inCare = !v.dischargedAt;
                  return (
                    <tr key={v.id}>
                      <td>{new Date(v.visitDate).toLocaleString()}</td>
                      <td>{studentLabel(row.student)}</td>
                      <td>{v.complaint}</td>
                      <td className="text-slate-400">{v.treatment ?? "—"}</td>
                      <td className={inCare ? "text-rose-400" : "text-emerald-400"}>{inCare ? "In sickbay" : "Discharged"}</td>
                      <td className="space-x-2 whitespace-nowrap">
                        {hasPermission("health.manage") && (
                          <>
                            {inCare && <button type="button" className="btn-ghost text-xs" onClick={() => discharge(v.id)}>Discharge</button>}
                            <button type="button" className="btn-ghost text-xs" onClick={() => { setEditVisitId(v.id); setVisitForm({ studentId: v.studentId, complaint: v.complaint, treatment: v.treatment ?? "" }); }}>Edit</button>
                            <button type="button" className="btn-ghost text-xs text-rose-400" onClick={async () => { if (window.confirm("Delete visit?")) { await api.delete(`/s/${schoolSlug}/api/health/visits/${v.id}`); toast("Removed", "success"); load(); } }}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "flags" && (
        <>
          {hasPermission("health.manage") && (
            <form onSubmit={saveFlag} className="card p-5 space-y-4">
              <h3 className="font-semibold text-white">{editFlagId ? "Edit health flag" : "Add health flag"}</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <select className="input" required value={flagForm.studentId} onChange={(e) => setFlagForm({ ...flagForm, studentId: e.target.value })}>
                  <option value="">Student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{studentLabel(s)}</option>)}
                </select>
                <select className="input" value={flagForm.flag} onChange={(e) => setFlagForm({ ...flagForm, flag: e.target.value })}>
                  {FLAG_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <input className="input" placeholder="Notes" value={flagForm.notes} onChange={(e) => setFlagForm({ ...flagForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">{editFlagId ? "Update" : "Save flag"}</button>
                {editFlagId && <button type="button" className="btn-ghost" onClick={() => { setEditFlagId(null); setFlagForm({ studentId: "", flag: "allergy", notes: "" }); }}>Cancel</button>}
              </div>
            </form>
          )}
          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead><tr><th>Student</th><th>Flag</th><th>Notes</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {flags.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No health flags on file.</td></tr>
                ) : flags.map((row: any) => {
                  const f = row.flag;
                  return (
                    <tr key={f.id}>
                      <td>{studentLabel(row.student)}</td>
                      <td className="capitalize">{f.flag}</td>
                      <td className="text-slate-400">{f.notes ?? "—"}</td>
                      <td className={f.active ? "text-amber-400" : "text-slate-500"}>{f.active ? "Active" : "Inactive"}</td>
                      <td className="space-x-2 whitespace-nowrap">
                        {hasPermission("health.manage") && (
                          <>
                            <button type="button" className="btn-ghost text-xs" onClick={() => toggleFlag(f.id, f.active)}>{f.active ? "Deactivate" : "Activate"}</button>
                            <button type="button" className="btn-ghost text-xs" onClick={() => { setEditFlagId(f.id); setFlagForm({ studentId: f.studentId, flag: f.flag, notes: f.notes ?? "" }); setTab("flags"); }}>Edit</button>
                            <button type="button" className="btn-ghost text-xs text-rose-400" onClick={async () => { if (window.confirm("Delete flag?")) { await api.delete(`/s/${schoolSlug}/api/health/flags/${f.id}`); toast("Removed", "success"); load(); } }}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
