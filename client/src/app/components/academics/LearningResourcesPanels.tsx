import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { Loader2, Trash2 } from "lucide-react";

export const StudyMaterialsPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", subject: "", url: "", classId: "" });

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
      await api.post(`/s/${schoolSlug}/api/academics/materials`, {
        title: form.title,
        subject: form.subject || undefined,
        url: form.url || undefined,
        classId: form.classId || undefined,
      });
      toast("Material added", "success");
      setForm({ title: "", subject: "", url: "", classId: "" });
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
        <div>
          <label className="label">Title</label>
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Resource URL (PDF, video, drive link)</label>
          <input className="input" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Class ID (optional)</label>
          <input className="input font-mono text-xs" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary">Add material</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Title</th><th>Subject</th><th>Link</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.subject ?? "—"}</td>
                <td>{r.url ? <a href={r.url} className="text-primary-400 text-xs" target="_blank" rel="noreferrer">Open</a> : "—"}</td>
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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", url: "", scheduledAt: "", classId: "" });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/academics/online-classes`);
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
      await api.post(`/s/${schoolSlug}/api/academics/online-classes`, {
        title: form.title,
        url: form.url,
        scheduledAt: form.scheduledAt || undefined,
        classId: form.classId || undefined,
      });
      toast("Live class link saved", "success");
      setForm({ title: "", url: "", scheduledAt: "", classId: "" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/academics/online-classes/${id}`);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5 grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Session title</label>
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Meeting URL (Zoom, Meet, Teams)</label>
          <input className="input" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div>
          <label className="label">Scheduled at</label>
          <input className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary">Add live class</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Title</th><th>When</th><th>Link</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : "—"}</td>
                <td><a href={r.url} className="text-primary-400 text-xs" target="_blank" rel="noreferrer">Join</a></td>
                <td><button type="button" className="text-red-400" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="text-slate-500">No live classes scheduled.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
