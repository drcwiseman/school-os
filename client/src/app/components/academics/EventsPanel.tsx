import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { Loader2, Trash2 } from "lucide-react";

const TYPES = [
  { value: "academic", label: "Academic" },
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
] as const;

export const EventsPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    eventType: "academic" as const,
    venue: "",
    startsAt: "",
    endsAt: "",
    audience: "all",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/events`);
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
      await api.post(`/s/${schoolSlug}/api/events`, {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      });
      toast("Event created", "success");
      setForm({ title: "", description: "", eventType: "academic", venue: "", startsAt: "", endsAt: "", audience: "all" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/events/${id}`);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5 grid md:grid-cols-2 gap-3">
        <h3 className="md:col-span-2 font-semibold text-white">Plan a school event</h3>
        <input className="input md:col-span-2" placeholder="Event title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className="input" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as typeof form.eventType })}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className="input" placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        <input className="input" type="datetime-local" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        <input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
          <option value="all">Everyone</option>
          <option value="parents">Parents</option>
          <option value="students">Students</option>
          <option value="staff">Staff</option>
        </select>
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary">Publish event</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr><th>Title</th><th>Type</th><th>When</th><th>Venue</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-white">{r.title}</td>
                <td className="capitalize">{r.eventType}</td>
                <td>{new Date(r.startsAt).toLocaleString()}</td>
                <td>{r.venue ?? "—"}</td>
                <td><button type="button" className="text-red-400" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="text-slate-500">No events scheduled.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
