import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, Save } from "lucide-react";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "../../lib/currencies";

export const Settings: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [schoolName, setSchoolName] = useState("");
  const [footer, setFooter] = useState("");
  const [resultsVisible, setResultsVisible] = useState(true);
  const [feesMustBeClear, setFeesMustBeClear] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/s/${schoolSlug}/api/settings`);
        const s = res.data;
        setCountry(s.country ?? "");
        setCurrency(s.currency ?? "USD");
        setTimezone(s.timezone ?? "UTC");
        const branding = (s.brandingJson ?? {}) as Record<string, string>;
        setSchoolName(branding.logoText ?? branding.name ?? "");
        setFooter(branding.footer ?? "");
        const flags = (s.featureFlagsJson ?? {}) as Record<string, boolean>;
        setResultsVisible(flags.results_visible !== false);
        setFeesMustBeClear(flags.fees_must_be_clear === true);
      } catch (err: any) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolSlug]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/s/${schoolSlug}/api/settings`, {
        country: country || undefined,
        currency,
        timezone,
        brandingJson: { logoText: schoolName, footer },
        featureFlagsJson: { results_visible: resultsVisible, fees_must_be_clear: feesMustBeClear },
      });
      toast("Settings saved", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-slate-400 mt-1">School branding, locale, and portal rules</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">General</h3>
        <div>
          <label className="label">Country</label>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">—</option>
            {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Default currency</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Timezone</label>
          <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Nairobi" />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">Branding (PDFs &amp; reports)</h3>
        <div>
          <label className="label">Display name on documents</label>
          <input className="input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
        </div>
        <div>
          <label className="label">Footer text</label>
          <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} />
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <h3 className="text-white font-semibold">Portal</h3>
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={resultsVisible} onChange={(e) => setResultsVisible(e.target.checked)} />
          Parents/students can view published results
        </label>
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={feesMustBeClear} onChange={(e) => setFeesMustBeClear(e.target.checked)} />
          Hide results until fees are fully paid
        </label>
      </div>

      <button type="button" className="btn-primary" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save settings</>}
      </button>
    </div>
  );
};
