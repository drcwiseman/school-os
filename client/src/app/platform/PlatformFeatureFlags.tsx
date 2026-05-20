import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Loader2, Save, Building2 } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type FeatureRow = {
  code: string;
  name: string;
  description: string;
  category: string;
  enabledSchools: number;
  totalSchools: number;
};

export const PlatformFeatureFlags: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api
      .get("/api/platform/settings/feature-flags")
      .then((r) => setFeatures(r.data.features ?? []))
      .catch((e) => toast(e.message, "error"));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [toast]);

  const applyBulk = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post("/api/platform/settings/feature-flags/bulk", {
        featureCode: selected,
        enabled: bulkEnabled,
      });
      toast(`Updated all schools for ${selected}`, "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  const sel = features.find((f) => f.code === selected);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Flag size={22} className="text-violet-600" /> Feature flags
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enable modules across all schools at once. Checked = effective access (plan + school override).
          Per-school tweaks on{" "}
          <Link to="/platform/tenants" className="text-blue-600 hover:underline">each school detail</Link>.
          Schools already open in the ERP need <strong>Enter school</strong> again to refresh the sidebar.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${CARD} lg:col-span-2 overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <th className="px-4 py-3 text-left">Feature</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Schools enabled</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr
                  key={f.code}
                  className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${
                    selected === f.code ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelected(f.code)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{f.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{f.code}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{f.category}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.enabledSchools} / {f.totalSchools}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${CARD} p-5 space-y-4 h-fit`}>
          <h2 className="text-sm font-semibold text-slate-900">Bulk action</h2>
          {sel ? (
            <>
              <p className="text-sm text-slate-600">{sel.description}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={bulkEnabled} onChange={(e) => setBulkEnabled(e.target.checked)} />
                Enable for all schools
              </label>
              <button
                type="button"
                className="btn-primary text-sm w-full inline-flex items-center justify-center gap-1"
                disabled={saving}
                onClick={applyBulk}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Apply to {sel.totalSchools} schools
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a feature from the table.</p>
          )}
          <Link
            to="/platform/tenants"
            className="text-sm text-blue-600 inline-flex items-center gap-1 hover:underline"
          >
            <Building2 size={14} /> Per-school flags
          </Link>
        </div>
      </div>
    </div>
  );
};
