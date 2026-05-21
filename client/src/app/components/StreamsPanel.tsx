import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "./Toast";
import { Loader2, Plus } from "lucide-react";

export const StreamsPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/academics/classes`)
      .then((res) => setClasses(res.data ?? []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  useEffect(() => {
    if (!schoolSlug || !classId) { setStreams([]); return; }
    api.get(`/s/${schoolSlug}/api/academics/classes/${classId}/streams`)
      .then((res) => setStreams(res.data ?? []))
      .catch(() => setStreams([]));
  }, [schoolSlug, classId]);

  const addStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !name.trim()) return;
    try {
      await api.post(`/s/${schoolSlug}/api/academics/classes/${classId}/streams`, { name });
      setName("");
      const res = await api.get(`/s/${schoolSlug}/api/academics/classes/${classId}/streams`);
      setStreams(res.data ?? []);
      toast("Stream added", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="card p-6 space-y-4">
      <h3 className="font-semibold text-white">Streams by class</h3>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input max-w-md">
        <option value="">Select class…</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.name} (level {c.level})</option>
        ))}
      </select>
      {classId && (
        <>
          <ul className="divide-y divide-slate-800">
            {streams.length === 0 ? (
              <li className="text-sm text-slate-500 py-4">No streams yet.</li>
            ) : streams.map((s) => (
              <li key={s.id} className="py-2 text-slate-300">{s.name}</li>
            ))}
          </ul>
          <form onSubmit={addStream} className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="text-xs text-slate-500">New stream</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. East" required />
            </div>
            <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> Add</button>
          </form>
        </>
      )}
    </div>
  );
};
