import React, { useEffect, useState } from "react";
import { Save, Loader2, BarChart3, Globe } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm p-5";

export const PlatformMarketing: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    siteName: "",
    siteUrl: "",
    defaultTitle: "",
    defaultDescription: "",
    defaultKeywords: "",
    ogImage: "",
    gaMeasurementId: "",
    gtmContainerId: "",
    plausibleDomain: "",
    twitterHandle: "",
  });

  useEffect(() => {
    api.get("/api/platform/settings/marketing")
      .then((r) => setForm({ ...form, ...r.data }))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/api/platform/settings/marketing", form);
      toast("Marketing & analytics saved", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      <div className={CARD}>
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Globe size={20} className="text-blue-600" />
          Marketing, SEO &amp; analytics
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Controls the public site at your marketing domain — titles, meta tags, Google Analytics, GTM, and Plausible.
        </p>
      </div>

      <div className={`${CARD} space-y-4`}>
        <h2 className="text-sm font-bold text-slate-900">SEO defaults</h2>
        {[
          { key: "siteName", label: "Brand name" },
          { key: "siteUrl", label: "Public site URL" },
          { key: "defaultTitle", label: "Default page title" },
          { key: "defaultDescription", label: "Meta description" },
          { key: "defaultKeywords", label: "Meta keywords" },
          { key: "ogImage", label: "Open Graph image path" },
          { key: "twitterHandle", label: "Twitter / X handle" },
        ].map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-slate-600">{f.label}</label>
            <input
              className="input text-sm mt-1 w-full"
              value={(form as Record<string, string>)[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className={`${CARD} space-y-4`}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-600" />
          Analytics
        </h2>
        <div>
          <label className="text-xs font-medium text-slate-600">Google Analytics 4 measurement ID</label>
          <input
            className="input text-sm mt-1 w-full font-mono"
            placeholder="G-XXXXXXXXXX"
            value={form.gaMeasurementId}
            onChange={(e) => setForm({ ...form, gaMeasurementId: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Google Tag Manager container ID</label>
          <input
            className="input text-sm mt-1 w-full font-mono"
            placeholder="GTM-XXXXXXX"
            value={form.gtmContainerId}
            onChange={(e) => setForm({ ...form, gtmContainerId: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Plausible domain</label>
          <input
            className="input text-sm mt-1 w-full"
            placeholder="school.bclimaxtech.com"
            value={form.plausibleDomain}
            onChange={(e) => setForm({ ...form, plausibleDomain: e.target.value })}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? "Saving…" : "Save marketing settings"}
      </button>
    </div>
  );
};
