import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, downloadPdf } from "../../api/client";
import { useToast } from "../../components/Toast";
import { Loader2 } from "lucide-react";

export const StudentTransfersPage: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<{ id: string; label: string }[]>([]);
  const [form, setForm] = useState({
    studentId: "", destinationSchool: "", destinationBranch: "", reason: "", effectiveDate: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/student-mgmt/transfers`);
      setRows(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/students?limit=200`).then((r) => {
      setStudents((r.data ?? []).map((s: any) => ({
        id: s.id, label: `${s.firstName} ${s.lastName} (${s.admissionNumber})`,
      })));
    }).catch(() => {});
  }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/student-mgmt/transfers`, form);
    toast("Transfer initiated", "success");
    setForm({ studentId: "", destinationSchool: "", destinationBranch: "", reason: "", effectiveDate: "" });
    load();
  };

  const complete = async (id: string, studentId: string) => {
    await api.patch(`/s/${schoolSlug}/api/student-mgmt/transfers/${id}`, { status: "completed", issueTc: true });
    toast("Transfer completed", "success");
    load();
    await downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/transfer-certificate?transferId=${id}`);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">School transfers</h2>
      <form onSubmit={submit} className="card p-4 grid sm:grid-cols-2 gap-3 max-w-3xl">
        <select className="input" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
          <option value="">Student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input className="input" placeholder="Destination school" required value={form.destinationSchool} onChange={(e) => setForm({ ...form, destinationSchool: e.target.value })} />
        <input className="input" placeholder="Branch (optional)" value={form.destinationBranch} onChange={(e) => setForm({ ...form, destinationBranch: e.target.value })} />
        <input type="date" className="input" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="submit" className="btn-primary text-sm sm:col-span-2">Start transfer</button>
      </form>
      <ul className="space-y-2">
        {rows.map((r: any) => (
          <li key={r.transfer.id} className="card p-4 flex flex-wrap justify-between gap-2">
            <div>
              <p className="text-white font-medium">{r.student.firstName} {r.student.lastName}</p>
              <p className="text-slate-400 text-sm">→ {r.transfer.destinationSchool}{r.transfer.destinationBranch ? ` (${r.transfer.destinationBranch})` : ""}</p>
              <span className="badge-gray capitalize">{r.transfer.status}</span>
            </div>
            {r.transfer.status === "pending" && (
              <button type="button" className="btn-primary text-xs" onClick={() => complete(r.transfer.id, r.student.id)}>
                Complete & print TC
              </button>
            )}
            {r.transfer.tcIssuedAt && (
              <button type="button" className="btn-ghost text-xs" onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${r.student.id}/pdf/transfer-certificate?transferId=${r.transfer.id}`)}>
                Download TC
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
