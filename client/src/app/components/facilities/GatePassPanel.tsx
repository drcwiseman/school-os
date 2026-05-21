import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Loader2 } from "lucide-react";

type StudentOpt = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
  className?: string | null;
  streamName?: string | null;
};

type StaffOpt = { id: string; firstName: string; lastName: string; employeeNo: string };

export const GatePassPanel: React.FC<{
  schoolSlug: string;
  students: StudentOpt[];
  staff: StaffOpt[];
}> = ({ schoolSlug, students, staff }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [placement, setPlacement] = useState<any>(null);
  const [form, setForm] = useState({
    visitorName: "",
    visitorMobile: "",
    relationToStudent: "",
    studentId: "",
    passDate: "",
    inTime: "",
    authorizedByStaffId: "",
    purpose: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, list] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/gate-passes/dashboard`),
        api.get(`/s/${schoolSlug}/api/gate-passes?date=${date}`),
      ]);
      setDash(d.data);
      setRows(list.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, date, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!form.studentId || !schoolSlug) {
      setPlacement(null);
      return;
    }
    api.get(`/s/${schoolSlug}/api/gate-passes/students/${form.studentId}/placement`)
      .then((r) => setPlacement(r.data))
      .catch(() => setPlacement(null));
  }, [form.studentId, schoolSlug]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = {
      visitorName: form.visitorName,
      studentId: form.studentId,
      authorizedByStaffId: form.authorizedByStaffId,
    };
    if (form.visitorMobile) body.visitorMobile = form.visitorMobile;
    if (form.relationToStudent) body.relationToStudent = form.relationToStudent;
    if (form.passDate) body.passDate = form.passDate;
    if (form.inTime) body.inTime = new Date(form.inTime).toISOString();
    if (form.purpose) body.purpose = form.purpose;
    if (form.notes) body.notes = form.notes;
    await api.post(`/s/${schoolSlug}/api/gate-passes`, body);
    toast("Gate pass issued", "success");
    setForm({
      visitorName: "",
      visitorMobile: "",
      relationToStudent: "",
      studentId: "",
      passDate: date,
      inTime: "",
      authorizedByStaffId: form.authorizedByStaffId,
      purpose: "",
      notes: "",
    });
    load();
  };

  const checkout = async (id: string) => {
    await api.post(`/s/${schoolSlug}/api/gate-passes/${id}/checkout`, {});
    toast("Visitor checked out", "success");
    load();
  };

  const updateTimes = async (id: string, patch: { inTime?: string; outTime?: string }) => {
    const body: Record<string, string | null> = {};
    if (patch.inTime) body.inTime = new Date(patch.inTime).toISOString();
    if (patch.outTime) body.outTime = new Date(patch.outTime).toISOString();
    await api.patch(`/s/${schoolSlug}/api/gate-passes/${id}`, body);
    toast("Timing updated", "success");
    load();
  };

  const selectedStudent = students.find((s) => s.id === form.studentId);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-slate-500 text-sm">Today&apos;s passes</p><p className="text-2xl font-bold text-white">{dash.todayTotal ?? 0}</p></div>
          <div className="card p-4"><p className="text-slate-500 text-sm">On campus now</p><p className="text-2xl font-bold text-emerald-400">{dash.activeNow ?? 0}</p></div>
          <div className="card p-4"><p className="text-slate-500 text-sm">Checked out</p><p className="text-2xl font-bold text-slate-300">{dash.checkedOut ?? 0}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">View date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {hasPermission("gate_pass.manage") && (
        <form onSubmit={create} className="card p-5 space-y-4">
          <h3 className="font-semibold text-white">Issue gate pass</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input className="input" placeholder="Visitor name *" required value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} />
            <input className="input" placeholder="Mobile" value={form.visitorMobile} onChange={(e) => setForm({ ...form, visitorMobile: e.target.value })} />
            <input className="input" placeholder="Relation to student (e.g. Father)" value={form.relationToStudent} onChange={(e) => setForm({ ...form, relationToStudent: e.target.value })} />
            <select className="input" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Student *</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.admissionNumber} — {s.firstName} {s.lastName}
                  {s.className ? ` (${s.className}${s.streamName ? ` / ${s.streamName}` : ""})` : ""}
                </option>
              ))}
            </select>
            <select className="input" required value={form.authorizedByStaffId} onChange={(e) => setForm({ ...form, authorizedByStaffId: e.target.value })}>
              <option value="">Authorized by *</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.employeeNo} — {s.firstName} {s.lastName}</option>
              ))}
            </select>
            <input className="input" type="date" value={form.passDate || date} onChange={(e) => setForm({ ...form, passDate: e.target.value })} />
            <input className="input" type="datetime-local" placeholder="In-time (default now)" value={form.inTime} onChange={(e) => setForm({ ...form, inTime: e.target.value })} />
            <input className="input md:col-span-2" placeholder="Purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          {(placement || selectedStudent) && (
            <p className="text-sm text-slate-400">
              Student class: {placement?.className ?? selectedStudent?.className ?? "—"}
              {" · "}Section: {placement?.streamName ?? selectedStudent?.streamName ?? "—"}
            </p>
          )}
          <button type="submit" className="btn-primary">Issue pass</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Pass #</th>
              <th>Visitor</th>
              <th>Student</th>
              <th>Class / Section</th>
              <th>Date</th>
              <th>In</th>
              <th>Out</th>
              <th>Authorized by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-400">No gate passes for this date.</td></tr>
            ) : rows.map((row: any) => (
              <tr key={row.pass.id}>
                <td className="font-mono text-xs">{row.pass.passNumber}</td>
                <td>
                  <div>{row.pass.visitorName}</div>
                  <div className="text-xs text-slate-500">{row.pass.visitorMobile ?? "—"} · {row.pass.relationToStudent ?? "—"}</div>
                </td>
                <td>{row.student.admissionNumber} {row.student.firstName} {row.student.lastName}</td>
                <td className="text-slate-400">{row.className ?? "—"} / {row.streamName ?? "—"}</td>
                <td>{row.pass.passDate}</td>
                <td className="text-xs">{new Date(row.pass.inTime).toLocaleString()}</td>
                <td className="text-xs">{row.pass.outTime ? new Date(row.pass.outTime).toLocaleString() : "—"}</td>
                <td className="text-xs">{row.authorizer.employeeNo} {row.authorizer.firstName}</td>
                <td>
                  {hasPermission("gate_pass.manage") && !row.pass.outTime && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => checkout(row.pass.id)}>Check out</button>
                  )}
                  {hasPermission("gate_pass.manage") && (
                    <button
                      type="button"
                      className="btn-ghost text-xs ml-1"
                      onClick={() => {
                        const out = prompt("Out-time (YYYY-MM-DDTHH:mm local)", "");
                        if (out) updateTimes(row.pass.id, { outTime: out });
                      }}
                    >
                      Set out-time
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
