import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Loader2, Building2, Plus } from "lucide-react";
import { useToast } from "../components/Toast";

export const PlatformConsole: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [flags, setFlags] = useState({ results_visible: true, fees_must_be_clear: false });
  const [form, setForm] = useState({
    slug: "", name: "", adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: "", planCode: "starter",
  });

  const load = async () => {
    const [t, p] = await Promise.all([
      api.get("/api/platform/tenants"),
      api.get("/api/platform/plans"),
    ]);
    setTenants(t.data ?? []);
    setPlans(p.data ?? []);
  };

  useEffect(() => {
    (async () => {
      try {
        await api.get("/api/platform/auth/me");
        await load();
      } catch {
        navigate("/platform/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const provision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/platform/tenants", form);
      toast("School provisioned", "success");
      setForm({ slug: "", name: "", adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: "", planCode: "starter" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const saveFlags = async () => {
    if (!selectedSlug) return toast("Select a tenant", "error");
    try {
      await api.patch(`/api/platform/tenants/${selectedSlug}/feature-flags`, { flags });
      toast("Feature flags updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const logout = async () => {
    await api.post("/api/platform/auth/logout").catch(() => {});
    navigate("/platform/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Platform
          </h1>
          <button type="button" onClick={logout} className="text-sm text-slate-400 hover:text-white">Sign out</button>
        </div>

        <div className="card p-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Provision school</h2>
          <form onSubmit={provision} className="grid md:grid-cols-2 gap-3">
            <input className="input" placeholder="slug (school-c)" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <input className="input" placeholder="School name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" type="email" placeholder="Admin email" required value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            <input className="input" type="password" placeholder="Admin password" required value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
            <input className="input" placeholder="Admin first name" required value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} />
            <input className="input" placeholder="Admin last name" required value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} />
            <select className="input" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
            </select>
            <button type="submit" className="btn-primary md:col-span-2">Create tenant</button>
          </form>
        </div>

        <div className="card p-5">
          <h2 className="text-white font-semibold mb-3">Tenant feature flags</h2>
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <select className="input w-auto" value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
              <option value="">Select tenant…</option>
              {tenants.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input type="checkbox" checked={flags.results_visible} onChange={(e) => setFlags({ ...flags, results_visible: e.target.checked })} />
              Results visible
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input type="checkbox" checked={flags.fees_must_be_clear} onChange={(e) => setFlags({ ...flags, fees_must_be_clear: e.target.checked })} />
              Fees must be clear
            </label>
            <button type="button" className="btn-primary" onClick={saveFlags}>Save flags</button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-white font-semibold mb-3">Tenants ({tenants.length})</h2>
          <table className="w-full text-sm text-slate-300">
            <thead><tr className="text-slate-500 text-left"><th>Slug</th><th>Name</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>{t.slug}</td><td>{t.name}</td><td>{t.status}</td>
                  <td><Link className="text-primary-400" to={`/s/${t.slug}/login`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
