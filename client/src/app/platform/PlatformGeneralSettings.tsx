import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Save, Settings, AlertTriangle } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type GeneralSettings = {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  timezone: string;
  defaultLocale: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  incidentBanner: string;
};

export const PlatformGeneralSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GeneralSettings | null>(null);

  const load = useCallback(async () => {
    const r = await api.get("/api/platform/settings/general");
    setForm(r.data as GeneralSettings);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [load, toast]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.patch("/api/platform/settings/general", form);
      toast("General settings saved", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex justify-center py-24 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading general settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={22} /> General settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform identity, support contacts, maintenance mode, and legal links. For public site SEO use{" "}
          <Link to="/platform/settings/marketing" className="text-blue-600 hover:underline">
            Marketing & SEO
          </Link>
          .
        </p>
      </div>

      {form.maintenanceMode && (
        <div className={`${CARD} p-4 flex gap-3 border-amber-200 bg-amber-50`}>
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <p className="text-sm text-amber-900">
            Maintenance mode is <strong>on</strong>. Schools may see the maintenance message on next load.
          </p>
        </div>
      )}

      <div className={`${CARD} p-5 space-y-4`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Platform name</label>
            <input
              className="input text-sm mt-1 w-full"
              value={form.platformName}
              onChange={(e) => setForm({ ...form, platformName: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Default locale</label>
            <input
              className="input text-sm mt-1 w-full"
              value={form.defaultLocale}
              onChange={(e) => setForm({ ...form, defaultLocale: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Support email</label>
            <input
              type="email"
              className="input text-sm mt-1 w-full"
              value={form.supportEmail}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Support phone</label>
            <input
              className="input text-sm mt-1 w-full"
              value={form.supportPhone}
              onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Timezone</label>
            <input
              className="input text-sm mt-1 w-full"
              placeholder="Africa/Kampala"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
          />
          Maintenance mode
        </label>
        <div>
          <label className="text-xs font-medium text-slate-600">Maintenance message</label>
          <textarea
            className="input text-sm mt-1 w-full min-h-[72px]"
            value={form.maintenanceMessage}
            onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Incident banner (optional)</label>
          <input
            className="input text-sm mt-1 w-full"
            placeholder="Shown to platform operators when set"
            value={form.incidentBanner}
            onChange={(e) => setForm({ ...form, incidentBanner: e.target.value })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Privacy policy URL</label>
            <input
              className="input text-sm mt-1 w-full"
              value={form.privacyPolicyUrl}
              onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Terms URL</label>
            <input
              className="input text-sm mt-1 w-full"
              value={form.termsUrl}
              onChange={(e) => setForm({ ...form, termsUrl: e.target.value })}
            />
          </div>
        </div>

        <button type="button" className="btn-primary text-sm inline-flex items-center gap-1" disabled={saving} onClick={save}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save general settings
        </button>
      </div>
    </div>
  );
};
