import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, Save, Mail, Send, Download, Upload } from "lucide-react";
import { useAuth } from "../state/AuthContext";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, DEFAULT_COUNTRY, DEFAULT_CURRENCY, currencyForCountry } from "../../lib/currencies";

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
  const { moduleEnabled, setAuth, user, schoolSlug: authSlug, permissions, roles, modules } = useAuth();
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
  const [smtp, setSmtp] = useState<SmtpForm>(emptySmtp);
  const [testEmail, setTestEmail] = useState("");
  const [comms, setComms] = useState({
    smsProvider: "",
    smsSenderId: "",
    whatsappEnabled: false,
    pushEnabled: false,
    emailBrandingName: "",
  });
  const [tab, setTab] = useState<"general" | "brand" | "policies" | "payments" | "data">("general");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [reportCardTpl, setReportCardTpl] = useState("default");
  const [certTpl, setCertTpl] = useState("default");
  const [idCardTpl, setIdCardTpl] = useState("default");
  const [gradingScale, setGradingScale] = useState("percentage");
  const [academicYear, setAcademicYear] = useState("");
  const [lateThreshold, setLateThreshold] = useState(15);
  const [absentThreshold, setAbsentThreshold] = useState(3);
  const [latePenalty, setLatePenalty] = useState(0);
  const [curriculumFw, setCurriculumFw] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [payStripe, setPayStripe] = useState("");
  const [payPaypal, setPayPaypal] = useState("");
  const [importJson, setImportJson] = useState("");

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
        const raw = (s.smtpSettingsJson ?? {}) as SmtpForm;
        setSmtp({
          ...emptySmtp,
          ...raw,
          port: raw.port ?? 587,
          password: "",
        });
        const c = (s.communicationsJson ?? {}) as typeof comms;
        setComms({
          smsProvider: c.smsProvider ?? "",
          smsSenderId: c.smsSenderId ?? "",
          whatsappEnabled: c.whatsappEnabled ?? false,
          pushEnabled: c.pushEnabled ?? false,
          emailBrandingName: c.emailBrandingName ?? "",
        });
        const ext = (s.brandingExtendedJson ?? {}) as Record<string, unknown>;
        setLogoUrl(String(ext.logoUrl ?? ""));
        setPrimaryColor(String(ext.primaryColor ?? "#6366f1"));
        setReportCardTpl(String(ext.reportCardTemplate ?? "default"));
        setCertTpl(String(ext.certificateTemplate ?? "default"));
        setIdCardTpl(String(ext.idCardTemplate ?? "default"));
        setGradingScale(String(ext.gradingScale ?? "percentage"));
        setAcademicYear(String(ext.academicYearDefault ?? ""));
        setLateThreshold(Number(ext.lateMinutesThreshold ?? 15));
        setAbsentThreshold(Number(ext.consecutiveAbsentThreshold ?? 3));
        setCustomDomain(String(ext.customDomain ?? ""));
        setCurriculumFw(s.curriculumFramework ?? "");
        setLatePenalty(s.latePenaltyPercent ?? 0);
        const pay = (s.paymentProvidersJson ?? {}) as Record<string, string>;
        setPayStripe(pay.stripePublicKey ?? "");
        setPayPaypal(pay.paypalClientId ?? "");
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
        country: country || DEFAULT_COUNTRY,
        currency,
        timezone,
        brandingJson: { logoText: schoolName, footer, logoUrl, primaryColor },
        brandingExtendedJson: {
          logoUrl,
          primaryColor,
          reportCardTemplate: reportCardTpl,
          certificateTemplate: certTpl,
          idCardTemplate: idCardTpl,
          gradingScale,
          academicYearDefault: academicYear,
          lateMinutesThreshold: lateThreshold,
          consecutiveAbsentThreshold: absentThreshold,
          customDomain,
        },
        communicationsJson: comms,
        paymentProvidersJson: { stripePublicKey: payStripe, paypalClientId: payPaypal },
        curriculumFramework: curriculumFw || undefined,
        latePenaltyPercent: latePenalty,
        featureFlagsJson: { results_visible: resultsVisible, fees_must_be_clear: feesMustBeClear },
      };
      if (moduleEnabled("custom_smtp")) {
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
      const res = await api.patch(`/s/${schoolSlug}/api/settings`, body);
      const saved = res.data;
      if (user && authSlug) {
        setAuth(user, authSlug, permissions, roles, modules, {
          country: saved?.country ?? (country || DEFAULT_COUNTRY),
          currency: saved?.currency ?? currency,
        });
      }
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

  const exportSettings = async () => {
    try {
      const res = await api.get(`/s/${schoolSlug}/api/settings/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `schoolos-settings-${schoolSlug}.json`;
      a.click();
      toast("Settings exported", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const importSettings = async () => {
    try {
      const parsed = JSON.parse(importJson);
      const payload = parsed.settings ?? parsed;
      await api.post(`/s/${schoolSlug}/api/settings/import`, {
        brandingJson: payload.brandingJson,
        brandingExtendedJson: payload.brandingExtendedJson,
        communicationsJson: payload.communicationsJson,
        paymentProvidersJson: payload.paymentProvidersJson,
        country: payload.country,
        currency: payload.currency,
        timezone: payload.timezone,
        curriculumFramework: payload.curriculumFramework,
        latePenaltyPercent: payload.latePenaltyPercent,
      });
      toast("Settings imported", "success");
      window.location.reload();
    } catch (err: any) {
      toast(err.message ?? "Invalid JSON", "error");
    }
  };

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "brand" as const, label: "Branding" },
    { id: "policies" as const, label: "Policies" },
    { id: "payments" as const, label: "Payments" },
    { id: "data" as const, label: "Import / export" },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-slate-400 mt-1">Enterprise branding, policies, gateways, and communications</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t.id ? "bg-primary-600/30 text-primary-200" : "text-slate-400 hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">General</h3>
        <div>
          <label className="label">Country</label>
          <select
            className="input"
            value={country || DEFAULT_COUNTRY}
            onChange={(e) => {
              const cc = e.target.value;
              setCountry(cc);
              setCurrency(currencyForCountry(cc));
            }}
          >
            {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">Defaults to Uganda when not set.</p>
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
      </div>}

      {tab === "brand" && <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">Branding &amp; templates</h3>
        <div>
          <label className="label">Display name on documents</label>
          <input className="input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
        </div>
        <div>
          <label className="label">Primary brand color</label>
          <input type="color" className="h-10 w-20 rounded border border-slate-700" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </div>
        <div>
          <label className="label">Footer text</label>
          <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className="label">Report card template</label>
            <select className="input" value={reportCardTpl} onChange={(e) => setReportCardTpl(e.target.value)}>
              <option value="default">Default</option><option value="compact">Compact</option><option value="detailed">Detailed</option>
            </select></div>
          <div><label className="label">Certificate template</label>
            <select className="input" value={certTpl} onChange={(e) => setCertTpl(e.target.value)}>
              <option value="default">Default</option><option value="formal">Formal</option>
            </select></div>
          <div><label className="label">ID card template</label>
            <select className="input" value={idCardTpl} onChange={(e) => setIdCardTpl(e.target.value)}>
              <option value="default">Default</option><option value="photo">Photo ID</option>
            </select></div>
        </div>
        <div>
          <label className="label">Custom domain (white-label)</label>
          <input className="input" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="portal.yourschool.edu" />
        </div>
      </div>}

      {tab === "general" && <div className="card p-6 space-y-3">
        <h3 className="text-white font-semibold">Portal</h3>
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={resultsVisible} onChange={(e) => setResultsVisible(e.target.checked)} />
          Parents/students can view published results
        </label>
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={feesMustBeClear} onChange={(e) => setFeesMustBeClear(e.target.checked)} />
          Hide results until fees are fully paid
        </label>
      </div>}

      {tab === "general" && <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">Communications</h3>
        <p className="text-xs text-slate-500">SMS, WhatsApp, and email branding for campaigns. WhatsApp requires platform integration enabled.</p>
        <input className="input" placeholder="SMS provider label" value={comms.smsProvider} onChange={(e) => setComms({ ...comms, smsProvider: e.target.value })} />
        <input className="input" placeholder="SMS sender ID" value={comms.smsSenderId} onChange={(e) => setComms({ ...comms, smsSenderId: e.target.value })} />
        <input className="input" placeholder="Email from display name" value={comms.emailBrandingName} onChange={(e) => setComms({ ...comms, emailBrandingName: e.target.value })} />
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={comms.whatsappEnabled} onChange={(e) => setComms({ ...comms, whatsappEnabled: e.target.checked })} />
          Prefer WhatsApp for campaigns when available
        </label>
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={comms.pushEnabled} onChange={(e) => setComms({ ...comms, pushEnabled: e.target.checked })} />
          Enable push notifications (PWA)
        </label>
      </div>}

      {tab === "policies" && <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">Academic &amp; attendance policies</h3>
        <div>
          <label className="label">Grading system</label>
          <select className="input" value={gradingScale} onChange={(e) => setGradingScale(e.target.value)}>
            <option value="percentage">Percentage</option>
            <option value="letter">Letter grades</option>
            <option value="gpa">GPA 4.0</option>
          </select>
        </div>
        <div>
          <label className="label">Default curriculum framework</label>
          <input className="input" value={curriculumFw} onChange={(e) => setCurriculumFw(e.target.value)} placeholder="e.g. CBC, IGCSE" />
        </div>
        <div>
          <label className="label">Default academic year label</label>
          <input className="input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025/2026" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Late threshold (minutes)</label>
            <input type="number" className="input" value={lateThreshold} onChange={(e) => setLateThreshold(Number(e.target.value))} /></div>
          <div><label className="label">Consecutive absences alert</label>
            <input type="number" className="input" value={absentThreshold} onChange={(e) => setAbsentThreshold(Number(e.target.value))} /></div>
        </div>
        <div>
          <label className="label">Late fee penalty (%)</label>
          <input type="number" className="input" value={latePenalty} onChange={(e) => setLatePenalty(Number(e.target.value))} />
        </div>
      </div>}

      {tab === "payments" && <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">Payment gateway keys</h3>
        <p className="text-xs text-slate-500">Store public/client keys only — secrets belong in platform integrations.</p>
        <input className="input" placeholder="Stripe publishable key" value={payStripe} onChange={(e) => setPayStripe(e.target.value)} />
        <input className="input" placeholder="PayPal client ID" value={payPaypal} onChange={(e) => setPayPaypal(e.target.value)} />
      </div>}

      {tab === "data" && <div className="card p-6 space-y-4">
        <h3 className="text-white font-semibold">Settings backup</h3>
        <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={exportSettings}>
          <Download className="w-4 h-4" /> Export JSON
        </button>
        <textarea className="input min-h-[120px] font-mono text-xs" placeholder="Paste exported JSON to import…" value={importJson} onChange={(e) => setImportJson(e.target.value)} />
        <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={importSettings}>
          <Upload className="w-4 h-4" /> Import
        </button>
      </div>}

      {tab === "general" && <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-400" />
          <h3 className="text-white font-semibold">Custom email (SMTP)</h3>
        </div>
        {!moduleEnabled("custom_smtp") ? (
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
      </div>}

      {tab !== "data" && <button type="button" className="btn-primary" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save settings</>}
      </button>}
    </div>
  );
};
