import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { Loader2, Trash2 } from "lucide-react";
import { useAcademicsLookups } from "./useAcademicsLookups";

const FOLDERS = ["general", "notes", "videos", "exams", "homework"];

export const StudyMaterialsPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { classes, subjects } = useAcademicsLookups();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    subjectId: "",
    classId: "",
    url: "",
    folder: "general",
    file: null as File | null,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/academics/materials`);
      setRows(res.data ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        subjectId: form.subjectId || undefined,
        classId: form.classId || undefined,
        url: form.url || undefined,
        folder: form.folder,
      };
      if (form.file) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = String(reader.result ?? "");
            resolve(s.includes(",") ? s.split(",")[1] : s);
          };
          reader.onerror = reject;
          reader.readAsDataURL(form.file!);
        });
        body.fileName = form.file.name;
        body.mimeType = form.file.type;
        body.contentBase64 = b64;
      }
      await api.post(`/s/${schoolSlug}/api/academics/materials`, body);
      toast("Material added", "success");
      setForm({ title: "", subjectId: "", classId: "", url: "", folder: "general", file: null });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/academics/materials/${id}`);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5 grid md:grid-cols-2 gap-3">
        <h3 className="md:col-span-2 font-semibold text-white">Upload study material</h3>
        <input className="input md:col-span-2" placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
          <option value="">Subject (optional)</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })}>
          {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <input className="input" type="url" placeholder="External link (optional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input className="input md:col-span-2" type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary">Save material</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Title</th><th>Folder</th><th>Resource</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td className="capitalize">{r.folder ?? "general"}</td>
                <td>
                  {r.filePath ? (
                    <a href={`/s/${schoolSlug}/api/academics/materials/${r.id}/file`} className="text-primary-400 text-xs" target="_blank" rel="noreferrer">Download {r.fileName}</a>
                  ) : r.url ? (
                    <a href={r.url} className="text-primary-400 text-xs" target="_blank" rel="noreferrer">Open link</a>
                  ) : "—"}
                </td>
                <td><button type="button" className="text-red-400" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="text-slate-500">No study materials yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const OnlineClassesPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { classes, subjects } = useAcademicsLookups();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", url: "", scheduledAt: "", classId: "", subjectId: "", durationMinutes: "60" });

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/academics/online-classes`);
      setRows(res.data ?? []);
    } catch (e: any) {
      const msg = e.message ?? "Could not load live classes";
      setApiError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (id: string) => {
    setSelectedId(id);
    const res = await api.get(`/s/${schoolSlug}/api/academics/online-classes/${id}/attendance`);
    setAttendance(res.data?.attendance ?? []);
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/academics/online-classes`, {
        title: form.title,
        url: form.url,
        classId: form.classId || undefined,
        subjectId: form.subjectId || undefined,
        scheduledAt: form.scheduledAt || undefined,
        durationMinutes: Number(form.durationMinutes) || 60,
      });
      toast("Live class saved", "success");
      setForm({ title: "", url: "", scheduledAt: "", classId: "", subjectId: "", durationMinutes: "60" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const initRoster = async (id: string) => {
    try {
      const res = await api.post(`/s/${schoolSlug}/api/academics/online-classes/${id}/init-roster`, {});
      toast(`Roster loaded (${res.data?.initialized ?? 0} students)`, "success");
      loadAttendance(id);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const saveAttendance = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/s/${schoolSlug}/api/academics/online-classes/${selectedId}/attendance`, {
        records: attendance.map((a) => ({
          studentId: a.studentId,
          status: a.status ?? "present",
          performanceScore: a.performanceScore != null ? Number(a.performanceScore) : undefined,
          notes: a.notes,
        })),
      });
      toast("Attendance saved", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const syncToDaily = async () => {
    if (!selectedId) return;
    try {
      const res = await api.post(`/s/${schoolSlug}/api/academics/online-classes/${selectedId}/sync-attendance`, {});
      toast(`Synced ${res.data?.synced ?? 0} records to daily attendance`, "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/academics/online-classes/${id}`);
      if (selectedId === id) { setSelectedId(""); setAttendance([]); }
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      {apiError && (
        <div className="card p-4 border border-red-900/50 text-sm text-slate-300">
          Live classes API error: <strong className="text-red-400">{apiError}</strong>. On the server run{" "}
          <code className="text-xs bg-slate-800 px-1 rounded">npm run db:repair --prefix server</code> then restart.
        </div>
      )}
      <form onSubmit={submit} className="card p-5 grid md:grid-cols-2 gap-3">
        <h3 className="md:col-span-2 font-semibold text-white">Schedule live class</h3>
        <input className="input" placeholder="Session title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="input" type="url" placeholder="Meeting URL" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} required>
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
          <option value="">Subject (optional)</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
        <input className="input" type="number" min={15} placeholder="Duration (min)" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
        <div className="md:col-span-2"><button type="submit" className="btn-primary">Add live class</button></div>
      </form>

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Title</th><th>When</th><th>Link</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selectedId === r.id ? "bg-slate-800/50" : ""}>
                <td>{r.title}</td>
                <td>{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : "—"}</td>
                <td><a href={r.url} className="text-primary-400 text-xs" target="_blank" rel="noreferrer">Join</a></td>
                <td className="space-x-2">
                  <button type="button" className="text-xs text-primary-400" onClick={() => loadAttendance(r.id)}>Attendance</button>
                  <button type="button" className="text-xs text-slate-400" onClick={() => initRoster(r.id)}>Load roster</button>
                  <button type="button" className="text-red-400" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="card p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <h3 className="font-semibold text-white flex-1">Session attendance & performance</h3>
            <button type="button" className="btn-secondary text-sm" onClick={saveAttendance}>Save</button>
            <button type="button" className="btn-ghost text-sm" onClick={syncToDaily}>Sync to daily attendance</button>
          </div>
          <table className="table text-sm">
            <thead><tr><th>Student</th><th>Status</th><th>Score %</th><th>Notes</th></tr></thead>
            <tbody>
              {attendance.map((a, i) => (
                <tr key={a.id ?? a.studentId}>
                  <td>{a.firstName} {a.lastName}</td>
                  <td>
                    <select
                      className="input py-1 text-xs"
                      value={a.status ?? "present"}
                      onChange={(e) => {
                        const next = [...attendance];
                        next[i] = { ...a, status: e.target.value };
                        setAttendance(next);
                      }}
                    >
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excused</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input w-16 py-1 text-xs"
                      type="number"
                      min={0}
                      max={100}
                      value={a.performanceScore ?? ""}
                      onChange={(e) => {
                        const next = [...attendance];
                        next[i] = { ...a, performanceScore: e.target.value };
                        setAttendance(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input py-1 text-xs"
                      value={a.notes ?? ""}
                      onChange={(e) => {
                        const next = [...attendance];
                        next[i] = { ...a, notes: e.target.value };
                        setAttendance(next);
                      }}
                    />
                  </td>
                </tr>
              ))}
              {!attendance.length && <tr><td colSpan={4} className="text-slate-500">Load roster to mark attendance.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
