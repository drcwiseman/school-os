import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  currencyForCountry,
} from "../../../lib/currencies";

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  country?: string;
  currency?: string;
  planCode?: string;
  planName?: string;
};

type Plan = { id: string; code: string; name: string };

const emptyCreate = {
  slug: "",
  name: "",
  adminEmail: "",
  adminPassword: "",
  adminFirstName: "Admin",
  adminLastName: "User",
  planCode: "starter",
  country: DEFAULT_COUNTRY,
  currency: DEFAULT_CURRENCY,
};

export const SchoolFormModal: React.FC<{
  open: boolean;
  mode: "create" | "edit";
  tenant?: TenantRow | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, mode, tenant, onClose, onSaved }) => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editPlan, setEditPlan] = useState("starter");

  useEffect(() => {
    if (!open) return;
    api.get("/api/platform/plans").then((r) => setPlans(r.data ?? [])).catch(() => {});
    if (mode === "edit" && tenant) {
      setEditName(tenant.name);
      setEditStatus(tenant.status);
      setEditPlan(tenant.planCode ?? "starter");
    } else {
      setCreateForm(emptyCreate);
    }
  }, [open, mode, tenant]);

  if (!open) return null;

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/platform/tenants", createForm);
      toast("School provisioned", "success");
      onSaved();
      onClose();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    try {
      if (editName.trim() && editName !== tenant.name) {
        await api.patch(`/api/platform/tenants/${tenant.slug}`, { name: editName.trim() });
      }
      if (editStatus !== tenant.status) {
        await api.patch(`/api/platform/tenants/${tenant.slug}/status`, { status: editStatus });
      }
      if (editPlan !== (tenant.planCode ?? "")) {
        await api.patch(`/api/platform/tenants/${tenant.slug}/plan`, { planCode: editPlan });
      }
      toast("School updated", "success");
      onSaved();
      onClose();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === "create" ? "Add school" : "Edit school"}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={submitCreate} className="p-6 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="input text-sm"
                placeholder="slug (school-a)"
                required
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              />
              <input
                className="input text-sm"
                placeholder="School name"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
              <select
              className="input text-sm"
              value={createForm.country}
              onChange={(e) => {
                const country = e.target.value;
                setCreateForm({
                  ...createForm,
                  country,
                  currency: currencyForCountry(country),
                });
              }}
            >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <select className="input text-sm" value={createForm.currency} onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <input
                className="input text-sm sm:col-span-2"
                type="email"
                placeholder="Admin email"
                autoComplete="off"
                required
                value={createForm.adminEmail}
                onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
              />
              <input
                className="input text-sm sm:col-span-2"
                type="password"
                placeholder="Admin password (min 8)"
                autoComplete="new-password"
                required
                minLength={8}
                value={createForm.adminPassword}
                onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
              />
              <select className="input text-sm sm:col-span-2" value={createForm.planCode} onChange={(e) => setCreateForm({ ...createForm, planCode: e.target.value })}>
                {plans.map((p) => (
                  <option key={p.id} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Provisioning…" : "Create school"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitEdit} className="p-6 space-y-4">
            <p className="text-xs text-slate-500">Slug: <span className="font-mono text-slate-700">{tenant?.slug}</span></p>
            <div>
              <label className="text-xs font-medium text-slate-600">School name</label>
              <input className="input text-sm mt-1 w-full" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select className="input text-sm mt-1 w-full" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Plan</label>
              <select className="input text-sm mt-1 w-full" value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
