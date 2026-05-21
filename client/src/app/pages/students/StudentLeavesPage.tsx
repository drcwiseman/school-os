import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { Loader2 } from "lucide-react";

export const StudentLeavesPage: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ studentId: "", startDate: "", endDate: "", reason: "" });
  const [students, setStudents] = useState<{ id: string; label: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/student-mgmt/leaves`);
      setRows(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/students?limit=200`).then((r) => {
      const list = (r.data ?? r.items ?? []).map((s: any) => ({
        id: s.id,
        label: `${s.firstName} ${s.lastName} (${s.admissionNumber})`,
      }));
      setStudents(list);
    }).catch(() => {});
  }, [schoolSlug]);

  const review = async (id: string, status: "approved" | "rejected") => {
    await api.patch(`/s/${schoolSlug}/api/student-mgmt/leaves/${id}`, { status });
    toast(`Leave ${status}`, "success");
    load();
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/student-mgmt/leaves`, form);
    toast("Leave recorded", "success");
    setForm({ studentId: "", startDate: "", endDate: "", reason: "" });
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Student leave requests</h2>
      <form onSubmit={createAdmin} className="card p-4 grid sm:grid-cols-2 gap-3 max-w-3xl">
        <select className="input" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
          <option value="">Select student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input type="date" className="input" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Reason" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="submit" className="btn-primary text-sm sm:col-span-2">Record leave (admin)</button>
      </form>
      <ul className="space-y-2">
        {rows.map((r: any) => (
          <li key={r.leave.id} className="card p-4 flex flex-wrap justify-between gap-2">
            <div>
              <p className="text-white font-medium">{r.student.firstName} {r.student.lastName}</p>
              <p className="text-slate-400 text-sm">{new Date(r.leave.startDate).toLocaleDateString()} – {new Date(r.leave.endDate).toLocaleDateString()}</p>
              <p className="text-slate-300 text-sm">{r.leave.reason}</p>
              <span className="badge-gray capitalize mt-1 inline-block">{r.leave.status}</span>
            </div>
            {r.leave.status === "pending" && (
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-xs" onClick={() => review(r.leave.id, "approved")}>Approve</button>
                <button type="button" className="btn-ghost text-xs" onClick={() => review(r.leave.id, "rejected")}>Reject</button>
              </div>
            )}
          </li>
        ))}
        {!rows.length && <p className="text-slate-500">No leave requests.</p>}
      </ul>
    </div>
  );
};
