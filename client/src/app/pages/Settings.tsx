import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, Save, Mail, Send } from "lucide-react";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, DEFAULT_COUNTRY, DEFAULT_CURRENCY } from "../../lib/currencies";

type SmtpForm = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  password: string;
  passwordConfigured?: boolean;
};

const emptySmtp: SmtpForm = {
  enabled: false,
  host: "",
  port: 587,
  secure: false,
  user: "",
  fromEmail: "",
  fromName: "",
  password: "",
};

export const Settings: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [timezone, setTimezone] = useState("UTC");
  const [schoolName, setSchoolName] = useState("");
  const [footer, setFooter] = useState("");
  const [resultsVisible, setResultsVisible] = useState(true);
  const [feesMustBeClear, setFeesMustBeClear] = useState(false);
  const [customSmtpAllowed, setCustomSmtpAllowed] = useState(false);
  const [smtp, setSmtp] = useState<SmtpForm>(emptySmtp);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/s/${schoolSlug}/api/settings`);
        const s = res.data;
        setCountry(s.country ?? DEFAULT_COUNTRY);
        setCurrency(s.currency ?? DEFAULT_CURRENCY);
        setTimezone(s.timezone ?? "Africa/Kampala");
        const branding = (s.brandingJson ?? {}) as Record<string, string>;
        setSchoolName(branding.logoText ?? branding.name ?? "");
        setFooter(branding.footer ?? "");
        const flags = (s.featureFlagsJson ?? {}) as Record<string, boolean>;
        setResultsVisible(flags.results_visible !== false);
        setFeesMustBeClear(flags.fees_must_be_clear === true);
        setCustomSmtpAllowed(Boolean(s.customSmtpAllowed));
        const raw = (s.smtpSettingsJson ?? {}) as SmtpForm;
        setSmtp({
          ...emptySmtp,
          ...raw,
          port: raw.port ?? 587,
          password: "",
        });
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
      const body: Record<string, unknown> = {
        country: country || undefined,
        currency,
        timezone,
        brandingJson: { logoText: schoolName, footer },
        featureFlagsJson: { results_visible: resultsVisible, fees_must_be_clear: feesMustBeClear },
      };
      if (customSmtpAllowed) {
        const smtpPayload: Record<string, unknown> = {
          enabled: smtp.enabled,
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          fromEmail: smtp.fromEmail,
          fromName: smtp.fromName,
        };
        if (smtp.password) smtpPayload.password = smtp.password;
        body.smtpSettingsJson = smtpPayload;
      }
      await api.patch(`/s/${schoolSlug}/api/settings`, body);
      toast("Settings saved", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    try {
      const smtpPayload: Record<string, unknown> = {
        enabled: smtp.enabled,
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        user: smtp.user,
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
      };
      if (smtp.password) smtpPayload.password = smtp.password;
      const res = await api.post(`/s/${schoolSlug}/api/settings/smtp/test`, {
        testEmail: testEmail || undefined,
        smtpSettingsJson: smtpPayload,
      });
      toast(res.message ?? "Test email sent", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setTestingSmtp(false);
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
          <p className="text-slate-400 mt-1">School branding, locale, portal rules, and email delivery</p>
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
          <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Kampala" />
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

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-400" />
          <h3 className="text-white font-semibold">Custom email (SMTP)</h3>
        </div>
        {!customSmtpAllowed ? (
          <p className="text-sm text-slate-400">
            Custom SMTP is not on your plan. Ask your platform admin to assign the{" "}
            <span className="font-mono text-slate-300">custom_smtp</span> feature to your subscription tier.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Send invoices, announcements, and campaigns from your school&apos;s own email address (Gmail, Microsoft 365, or any SMTP server).
            </p>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input
                type="checkbox"
                checked={smtp.enabled}
                onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
              />
              Enable custom SMTP for this school
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">SMTP host</label>
                <input
                  className="input"
                  placeholder="smtp.gmail.com"
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Port</label>
                <input
                  type="number"
                  className="input"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) || 587 })}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={smtp.secure}
                    onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
                  />
                  Use SSL/TLS (port 465)
                </label>
              </div>
              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  autoComplete="off"
                  value={smtp.user}
                  onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  placeholder={smtp.passwordConfigured ? "•••••••• (unchanged)" : "App password"}
                  value={smtp.password}
                  onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                />
              </div>
              <div>
                <label className="label">From email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="noreply@school.ac.ug"
                  value={smtp.fromEmail}
                  onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="label">From name</label>
                <input
                  className="input"
                  placeholder="Greenfield Academy"
                  value={smtp.fromName}
                  onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50">
              <input
                type="email"
                className="input flex-1 min-w-[200px]"
                placeholder="Test recipient (defaults to your login)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1"
                disabled={testingSmtp || !smtp.host}
                onClick={testSmtp}
              >
                {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send test
              </button>
            </div>
          </>
        )}
      </div>

      <button type="button" className="btn-primary" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save settings</>}
      </button>
    </div>
  );
};
