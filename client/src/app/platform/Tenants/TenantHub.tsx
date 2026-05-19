import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Settings } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "../../../lib/currencies";

export const TenantHub: React.FC = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [features, setFeatures] = useState<any[]>([]);
  const [form, setForm] = useState({
    slug: "", name: "", adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: "",
    planCode: "starter", country: "KE", currency: "KES",
  });

  const load = async () => {
    const [t, p] = await Promise.all([api.get("/api/platform/tenants"), api.get("/api/platform/plans")]);
    setTenants(t.data ?? []);
    setPlans(p.data ?? []);
  };

  useEffect(() => { load().catch((e) => toast(e.message, "error")); }, []);

  const provision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/platform/tenants", form);
      toast("School provisioned", "success");
      setForm({ ...form, slug: "", name: "", adminEmail: "", adminPassword: "" });
      await load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const loadFeatures = async (slug: string) => {
    setSelectedSlug(slug);
    if (!slug) return setFeatures([]);
    const res = await api.get(`/api/platform/tenants/${slug}/features`);
    setFeatures(res.data ?? []);
  };

  const saveFeatures = async () => {
    if (!selectedSlug) return;
    await api.patch(`/api/platform/tenants/${selectedSlug}/features`, {
      features: features.map((f) => ({ code: f.code, enabled: f.enabled })),
    });
    toast("Features saved", "success");
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Schools</h1>
      <p className="mt-1 text-sm text-slate-500">Each tenant is one school. Provision a <strong>school administrator</strong> account; staff are added in HR later.</p>

      <ul className="flex flex-wrap gap-2 text-xs">
        {tenants.map((t) => (
          <li key={t.id}>
            <Link to={`/platform/tenants/${t.slug}`} className="text-indigo-600 hover:underline font-medium">
              {t.name}
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={provision} className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Plus size={16} /> Provision school</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input text-sm" placeholder="slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
            <input className="input text-sm" placeholder="School name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input text-sm" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
              {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <select className="input text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
            <input className="input text-sm sm:col-span-2" type="email" placeholder="Admin email" required value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            <input className="input text-sm" type="password" placeholder="Password" required value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
            <select className="input text-sm" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">Provision</button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Settings size={16} /> Module flags</h3>
          <select className="input text-sm" value={selectedSlug} onChange={(e) => loadFeatures(e.target.value)}>
            <option value="">Select school…</option>
            {tenants.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
          </select>
          {features.map((f) => (
            <label key={f.code} className="flex justify-between text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
              {f.name}
              <input type="checkbox" checked={f.enabled} onChange={(e) => setFeatures((prev) => prev.map((x) => x.code === f.code ? { ...x, enabled: e.target.checked } : x))} />
            </label>
          ))}
          {selectedSlug && (
            <button type="button" className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700" onClick={saveFeatures}>
              Save flags
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
