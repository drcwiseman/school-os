import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Building2, Loader2 } from "lucide-react";
import { useAuth } from "../state/AuthContext";

export const Campuses: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { moduleEnabled } = useAuth();
  const [campuses, setCampuses] = useState<any[]>([]);
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  if (!moduleEnabled("multi_campus")) {
    return (
      <div className="card p-8 text-center text-slate-400">
        Multi-campus is not enabled on your plan. Enable the <strong>multi_campus</strong> feature to manage branches.
      </div>
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/campuses`),
        api.get(`/s/${schoolSlug}/api/campuses/consolidated-report`),
      ]);
      setCampuses(c.data ?? []);
      setReport(r.data ?? []);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const create = async () => {
    await api.post(`/s/${schoolSlug}/api/campuses`, form);
    setForm({ name: "", code: "", address: "" });
    toast("Campus created", "success");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Building2 className="w-7 h-7" /> Campuses</h1>
      </div>
      <form className="card p-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input w-28" placeholder="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="input flex-1" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <button type="submit" className="btn-primary">Add campus</button>
      </form>
      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : (
        <>
          <div className="card p-5">{campuses.map((c) => <p key={c.id} className="text-slate-300">{c.name} ({c.code}) — {c.status}</p>)}</div>
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">Consolidated report</h3>
            {report.map((r) => (
              <p key={r.campus.id} className="text-slate-400 text-sm">{r.campus.name}: {r.students} students · invoiced {(r.invoiced / 100).toFixed(0)}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
