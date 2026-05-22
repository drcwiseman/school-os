import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSchoolSlug } from "../hooks/useSchoolSlug";
import { schoolPath } from "../lib/tenant-host";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import {
  Loader2, Save, Mail, Send, Download, Upload, Globe, Palette, Shield, CreditCard,
  BookOpen, MessageSquare, Layers, Database, Sun, Moon, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";
import { useAuth } from "../state/AuthContext";
import { applyTenantAppearance } from "../utils/theme";
import {
  COUNTRY_OPTIONS, CURRENCY_OPTIONS, DEFAULT_COUNTRY, DEFAULT_CURRENCY,
  countryLabel, currencyForCountry,
} from "../../lib/currencies";
import { SchoolImageUpload, fileToBase64Payload } from "../components/SchoolImageUpload";
import { DemoDataPanel } from "../components/admin/DemoDataPanel";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function resolveMediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

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

type FeatureRow = { code: string; name: string; description: string; category: string; enabled: boolean };

const emptySmtp: SmtpForm = {
  enabled: false, host: "", port: 587, secure: false, user: "", fromEmail: "", fromName: "", password: "",
};

const TIMEZONES = [
  "Africa/Kampala", "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg",
  "UTC", "Europe/London", "America/New_York", "Asia/Dubai",
];

type Tab = "general" | "brand" | "portal" | "academic" | "payments" | "email" | "modules" | "data";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Globe },
  { id: "brand", label: "Branding", icon: Palette },
  { id: "portal", label: "Portal & comms", icon: MessageSquare },
  { id: "academic", label: "Academic", icon: BookOpen },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "email", label: "Email (SMTP)", icon: Mail },
  { id: "modules", label: "Modules", icon: Layers },
  { id: "data", label: "Demo & backup", icon: Database },
];

type DomainInfo = {
  customDomain?: string;
  domainVerified?: boolean;
  dnsRecords?: { cname?: { host: string; value: string } | null; aRecord?: { host: string; value: string } | null };
  urls?: {
    recommendedStaffLogin?: string;
    recommendedPortalLogin?: string;
    custom?: { staffLogin?: string; portalLogin?: string } | null;
  };
};

export const Settings: React.FC = () => {
  const schoolSlug = useSchoolSlug();
  const { toast } = useToast();
  const { setAuth, user, schoolSlug: authSlug, permissions, roles, modules, hasPermission, country: authCountry, currency: authCurrency } = useAuth();
  const canManage = hasPermission("settings.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [tab, setTab] = useState<Tab>("general");
  const [customSmtpAllowed, setCustomSmtpAllowed] = useState(false);

  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [timezone, setTimezone] = useState("Africa/Kampala");
  const [schoolName, setSchoolName] = useState("");
  const [footer, setFooter] = useState("");
  const [resultsVisible, setResultsVisible] = useState(true);
  const [feesMustBeClear, setFeesMustBeClear] = useState(false);
  const [smtp, setSmtp] = useState<SmtpForm>(emptySmtp);
  const [testEmail, setTestEmail] = useState("");
  const [comms, setComms] = useState({
    smsProvider: "", smsSenderId: "", whatsappEnabled: false, pushEnabled: false, emailBrandingName: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
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
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const [payPaypalEnabled, setPayPaypalEnabled] = useState(false);
  const [payPaypalClientId, setPayPaypalClientId] = useState("");
  const [payPesapalEnabled, setPayPesapalEnabled] = useState(false);
  const [payPesapalKey, setPayPesapalKey] = useState("");
  const [payPesapalSecret, setPayPesapalSecret] = useState("");
  const [payPesapalSecretConfigured, setPayPesapalSecretConfigured] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [featureRows, setFeatureRows] = useState<FeatureRow[]>([]);
  const [featureSearch, setFeatureSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, featRes] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/settings`),
        api.get(`/s/${schoolSlug}/api/settings/features`).catch(() => ({ data: [] })),
      ]);
      const s = res.data;
      setCustomSmtpAllowed(Boolean(s.customSmtpAllowed));
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
      setSmtp({ ...emptySmtp, ...raw, port: raw.port ?? 587, password: "" });
      const c = (s.communicationsJson ?? {}) as typeof comms;
      setComms({
        smsProvider: c.smsProvider ?? "",
        smsSenderId: c.smsSenderId ?? "",
        whatsappEnabled: c.whatsappEnabled ?? false,
        pushEnabled: c.pushEnabled ?? false,
        emailBrandingName: c.emailBrandingName ?? "",
      });
      const ext = (s.brandingExtendedJson ?? {}) as Record<string, unknown>;
      const logoPath = String(branding.logoUrl ?? ext.logoUrl ?? "");
      setLogoUrl(logoPath ? resolveMediaUrl(logoPath) : "");
      setPrimaryColor(String(ext.primaryColor ?? "#6366f1"));
      const theme = (s.themeJson ?? {}) as { mode?: "light" | "dark"; accent?: string };
      setThemeMode(theme.mode ?? "dark");
      if (theme.accent) setPrimaryColor(theme.accent);
      setReportCardTpl(String(ext.reportCardTemplate ?? "default"));
      setCertTpl(String(ext.certificateTemplate ?? "default"));
      setIdCardTpl(String(ext.idCardTemplate ?? "default"));
      setGradingScale(String(ext.gradingScale ?? "percentage"));
      setAcademicYear(String(ext.academicYearDefault ?? ""));
      setLateThreshold(Number(ext.lateMinutesThreshold ?? 15));
      setAbsentThreshold(Number(ext.consecutiveAbsentThreshold ?? 3));
      setCustomDomain(String(ext.customDomain ?? s.domain?.customDomain ?? ""));
      setDomainInfo((s.domain as DomainInfo) ?? null);
      setCurriculumFw(s.curriculumFramework ?? "");
      setLatePenalty(s.latePenaltyPercent ?? 0);
      const pay = (s.paymentProvidersJson ?? {}) as Record<string, Record<string, unknown>>;
      const paypal = (pay.paypal ?? {}) as { enabled?: boolean; clientId?: string };
      const pesapal = (pay.pesapal ?? {}) as {
        enabled?: boolean; consumerKey?: string; consumerSecretConfigured?: boolean;
      };
      setPayPaypalEnabled(Boolean(paypal.enabled ?? pay.paypalClientId));
      setPayPaypalClientId(String(paypal.clientId ?? pay.paypalClientId ?? ""));
      setPayPesapalEnabled(Boolean(pesapal.enabled ?? pay.pesapalConsumerKey));
      setPayPesapalKey(String(pesapal.consumerKey ?? pay.pesapalConsumerKey ?? ""));
      setPayPesapalSecret("");
      setPayPesapalSecretConfigured(Boolean(pesapal.consumerSecretConfigured));
      setFeatureRows(featRes.data ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const filteredFeatures = useMemo(() => {
    const q = featureSearch.trim().toLowerCase();
    if (!q) return featureRows;
    return featureRows.filter((f) =>
      f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q) || f.category.toLowerCase().includes(q),
    );
  }, [featureRows, featureSearch]);

  const featuresByCategory = useMemo(() => {
    const map: Record<string, FeatureRow[]> = {};
    for (const f of filteredFeatures) {
      (map[f.category] = map[f.category] || []).push(f);
    }
    return map;
  }, [filteredFeatures]);

  const toggleFeature = (code: string, enabled: boolean) => {
    setFeatureRows((rows) => rows.map((r) => (r.code === code ? { ...r, enabled } : r)));
  };

  const uploadLogo = async (file: File) => {
    if (!schoolSlug || !canManage) return;
    setUploadingLogo(true);
    try {
      const payload = await fileToBase64Payload(file);
      const res = await api.post(`/s/${schoolSlug}/api/settings/branding/logo`, payload);
      const path = (res.data?.logoUrl ?? "") as string;
      setLogoUrl(resolveMediaUrl(path) + `?v=${Date.now()}`);
      setLogoVersion((v) => v + 1);
      toast("Logo uploaded — click Save settings to keep other changes", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Logo upload failed", "error");
    } finally {
      setUploadingLogo(false);
    }
  };

  const logoPreview = logoUrl ? (logoUrl.includes("?") ? logoUrl : `${logoUrl}?v=${logoVersion}`) : "";

  const verifyDomain = async () => {
    if (!schoolSlug || !canManage) return;
    setVerifyingDomain(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/settings/domain/verify`);
      setDomainInfo((res.data?.domain as DomainInfo) ?? domainInfo);
      toast(res.message ?? "Domain verified", "success");
    } catch (err: unknown) {
      const e = err as Error & { data?: { domain?: DomainInfo } };
      if (e.data?.domain) setDomainInfo(e.data.domain);
      toast(e.message || "DNS verification failed", "error");
    } finally {
      setVerifyingDomain(false);
    }
  };

  const save = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        country: country || DEFAULT_COUNTRY,
        currency,
        timezone,
        brandingJson: {
          logoText: schoolName, name: schoolName, footer,
          logoUrl: (() => {
            if (!logoUrl) return "";
            const bare = logoUrl.split("?")[0];
            if (API_BASE && bare.startsWith(API_BASE)) return bare.slice(API_BASE.length);
            return bare;
          })(),
          primaryColor,
        },
        brandingExtendedJson: {
          logoUrl, primaryColor, reportCardTemplate: reportCardTpl, certificateTemplate: certTpl,
          idCardTemplate: idCardTpl, gradingScale, academicYearDefault: academicYear,
          lateMinutesThreshold: lateThreshold, consecutiveAbsentThreshold: absentThreshold, customDomain,
        },
        themeJson: { mode: themeMode, accent: primaryColor },
        communicationsJson: comms,
        paymentProvidersJson: {
          paypal: { enabled: payPaypalEnabled, clientId: payPaypalClientId.trim() || undefined },
          pesapal: {
            enabled: payPesapalEnabled,
            consumerKey: payPesapalKey.trim() || undefined,
            ...(payPesapalSecret ? { consumerSecret: payPesapalSecret } : {}),
          },
        },
        curriculumFramework: curriculumFw.trim() || undefined,
        latePenaltyPercent: Math.round(Number(latePenalty) || 0),
        featureFlagsJson: {
          results_visible: resultsVisible,
          fees_must_be_clear: feesMustBeClear,
        },
      };
      const smtpReady = smtp.enabled && smtp.host.trim() && smtp.fromEmail.trim();
      if (customSmtpAllowed && smtpReady) {
        const smtpPayload: Record<string, unknown> = {
          enabled: true,
          host: smtp.host.trim(),
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user.trim(),
          fromEmail: smtp.fromEmail.trim(),
          fromName: smtp.fromName.trim(),
        };
        if (smtp.password) smtpPayload.password = smtp.password;
        body.smtpSettingsJson = smtpPayload;
      } else if (customSmtpAllowed) {
        body.smtpSettingsJson = { enabled: false };
      }
      if (featureRows.length) {
        body.featureFlagsJson = {
          ...(body.featureFlagsJson as Record<string, boolean>),
          ...Object.fromEntries(featureRows.map((f) => [f.code, f.enabled])),
        };
      }
      const res = await api.patch(`/s/${schoolSlug}/api/settings`, body);
      const saved = res.data;
      applyTenantAppearance({ mode: themeMode, accent: primaryColor });
      if (user && authSlug) {
        setAuth(user, authSlug, permissions, roles, modules, {
          country: saved?.country ?? country,
          currency: saved?.currency ?? currency,
        });
      }
      if (saved?.domain) setDomainInfo(saved.domain as DomainInfo);
      toast("Settings saved", "success");
      load();
    } catch (err: unknown) {
      const apiErr = err as Error & { errors?: { field: string; message: string }[] };
      const detail = apiErr.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
      toast(detail || apiErr.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    try {
      const smtpPayload: Record<string, unknown> = {
        enabled: smtp.enabled, host: smtp.host, port: smtp.port, secure: smtp.secure,
        user: smtp.user, fromEmail: smtp.fromEmail, fromName: smtp.fromName,
      };
      if (smtp.password) smtpPayload.password = smtp.password;
      const res = await api.post(`/s/${schoolSlug}/api/settings/smtp/test`, {
        testEmail: testEmail || undefined,
        smtpSettingsJson: smtpPayload,
      });
      toast(res.message ?? "Test email sent", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "SMTP test failed", "error");
    } finally {
      setTestingSmtp(false);
    }
  };

  const exportSettings = async () => {
    try {
      const res = await api.get(`/s/${schoolSlug}/api/settings/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `schoolos-settings-${schoolSlug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast("Settings exported", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
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
      setImportJson("");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Invalid JSON", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-24">
      <div className="page-header flex-col sm:flex-row gap-4">
        <div>
          <h1 className="page-title">School settings</h1>
          <p className="text-slate-400 mt-1">
            {schoolName || "Your school"} · {countryLabel(country || authCountry)} · {currency || authCurrency}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {schoolSlug && (
            <>
              <Link to={schoolPath(schoolSlug, "admin")} className="btn-ghost text-sm">Administration</Link>
              <Link to={schoolPath(schoolSlug, "security")} className="btn-ghost text-sm"><Shield className="w-4 h-4 inline" /> Security</Link>
            </>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="card p-4 border border-amber-800/40 bg-amber-950/20 text-sm text-amber-200">
          View-only — you need <code className="text-amber-100">settings.manage</code> to change settings.
        </div>
      )}

      <div className="flex flex-wrap gap-2 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              tab === id ? "bg-primary-600 text-white shadow-lg shadow-primary-900/30" : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Locale &amp; region</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Country</label>
              <select
                className="input"
                disabled={!canManage}
                value={country || DEFAULT_COUNTRY}
                onChange={(e) => { setCountry(e.target.value); setCurrency(currencyForCountry(e.target.value)); }}
              >
                {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Default currency</label>
              <select className="input" disabled={!canManage} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
              <p className="text-xs text-slate-500 mt-1">Used on Finance, Reports, and invoices.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Timezone</label>
              <select className="input" disabled={!canManage} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                {!TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === "brand" && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white">Identity</h3>
            <div>
              <label className="label">School display name</label>
              <input className="input" disabled={!canManage} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>
            <SchoolImageUpload
              label="School logo"
              hint="Shown on PDFs, emails, and the staff app header."
              previewSrc={logoPreview}
              uploading={uploadingLogo}
              disabled={!canManage}
              onUpload={uploadLogo}
              onClear={canManage ? () => { setLogoUrl(""); setLogoVersion((v) => v + 1); } : undefined}
            />
            <div>
              <label className="label">Footer on PDFs / emails</label>
              <input className="input" disabled={!canManage} value={footer} onChange={(e) => setFooter(e.target.value)} />
            </div>
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <h4 className="text-sm font-medium text-slate-300">Custom domain</h4>
              <p className="text-xs text-slate-500">
                Point your domain at SchoolOS, verify DNS, then staff and parents can sign in at clean URLs like{" "}
                <code className="text-slate-400">https://portal.yourschool.edu/login</code> (no <code className="text-slate-400">/s/slug</code> in the browser).
              </p>
              <div>
                <label className="label">Hostname</label>
                <input
                  className="input"
                  disabled={!canManage}
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="portal.yourschool.edu"
                />
              </div>
              {customDomain.trim() && (
                <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4 space-y-3 text-sm">
                  <p className="text-slate-400">After saving, add one of these DNS records at your registrar:</p>
                  {domainInfo?.dnsRecords?.cname && (
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wide">CNAME (recommended)</span>
                      <p className="font-mono text-slate-200 mt-1">
                        {domainInfo.dnsRecords.cname.host} → {domainInfo.dnsRecords.cname.value}
                      </p>
                    </div>
                  )}
                  {domainInfo?.dnsRecords?.aRecord?.value && (
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wide">A record (alternative)</span>
                      <p className="font-mono text-slate-200 mt-1">
                        {domainInfo.dnsRecords.aRecord.host} → {domainInfo.dnsRecords.aRecord.value}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {domainInfo?.domainVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle2 className="w-4 h-4" /> Verified — live on your domain
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                        <AlertCircle className="w-4 h-4" /> Pending DNS verification
                      </span>
                    )}
                    {canManage && (
                      <button type="button" className="btn-ghost text-xs" disabled={verifyingDomain} onClick={verifyDomain}>
                        <RefreshCw className={`w-3.5 h-3.5 inline ${verifyingDomain ? "animate-spin" : ""}`} />
                        {verifyingDomain ? "Checking…" : "Verify DNS"}
                      </button>
                    )}
                  </div>
                  {(domainInfo?.urls?.recommendedStaffLogin || domainInfo?.urls?.custom?.staffLogin) && (
                    <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-800">
                      <p>Staff login: <span className="text-primary-300 break-all">{domainInfo.urls?.recommendedStaffLogin ?? domainInfo.urls?.custom?.staffLogin}</span></p>
                      <p>Parent portal: <span className="text-primary-300 break-all">{domainInfo.urls?.recommendedPortalLogin ?? domainInfo.urls?.custom?.portalLogin}</span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white">Staff app theme</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="label mb-0">Accent</label>
              <input type="color" className="h-10 w-14 rounded border border-slate-700 disabled:opacity-50" disabled={!canManage} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              <button type="button" disabled={!canManage} className={`btn-ghost text-sm ${themeMode === "dark" ? "ring-1 ring-primary-500" : ""}`} onClick={() => setThemeMode("dark")}>
                <Moon className="w-4 h-4 inline" /> Dark
              </button>
              <button type="button" disabled={!canManage} className={`btn-ghost text-sm ${themeMode === "light" ? "ring-1 ring-primary-500" : ""}`} onClick={() => setThemeMode("light")}>
                <Sun className="w-4 h-4 inline" /> Light
              </button>
              {canManage && (
                <button type="button" className="btn-ghost text-xs" onClick={() => applyTenantAppearance({ mode: themeMode, accent: primaryColor })}>
                  Preview theme
                </button>
              )}
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white">Document templates</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Report cards</label>
                <select className="input" disabled={!canManage} value={reportCardTpl} onChange={(e) => setReportCardTpl(e.target.value)}>
                  <option value="default">Default</option><option value="compact">Compact</option><option value="detailed">Detailed</option>
                </select>
              </div>
              <div>
                <label className="label">Certificates</label>
                <select className="input" disabled={!canManage} value={certTpl} onChange={(e) => setCertTpl(e.target.value)}>
                  <option value="default">Default</option><option value="formal">Formal</option>
                </select>
              </div>
              <div>
                <label className="label">ID cards</label>
                <select className="input" disabled={!canManage} value={idCardTpl} onChange={(e) => setIdCardTpl(e.target.value)}>
                  <option value="default">Default (front + back)</option>
                  <option value="uganda_national">Uganda national ID style</option>
                  <option value="makerere">Makerere / university style</option>
                  <option value="photo">Photo ID (uses default layout)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">PDF includes front and back with barcode. Applies to student and staff cards.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "portal" && (
        <div className="space-y-4">
          <div className="card p-6 space-y-3">
            <h3 className="font-semibold text-white">Parent &amp; student portal</h3>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input type="checkbox" disabled={!canManage} checked={resultsVisible} onChange={(e) => setResultsVisible(e.target.checked)} />
              Parents/students can view published exam results
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input type="checkbox" disabled={!canManage} checked={feesMustBeClear} onChange={(e) => setFeesMustBeClear(e.target.checked)} />
              Hide results until all fees are paid
            </label>
            <a href={`/s/${schoolSlug}/portal/login`} target="_blank" rel="noreferrer" className="text-primary-400 text-sm hover:underline inline-block mt-2">
              Open portal login →
            </a>
          </div>
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white">Communications</h3>
            <p className="text-xs text-slate-500">SMS, WhatsApp, and email display names for Messaging.</p>
            <input className="input" disabled={!canManage} placeholder="SMS provider label" value={comms.smsProvider} onChange={(e) => setComms({ ...comms, smsProvider: e.target.value })} />
            <input className="input" disabled={!canManage} placeholder="SMS sender ID" value={comms.smsSenderId} onChange={(e) => setComms({ ...comms, smsSenderId: e.target.value })} />
            <input className="input" disabled={!canManage} placeholder="Email from display name" value={comms.emailBrandingName} onChange={(e) => setComms({ ...comms, emailBrandingName: e.target.value })} />
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input type="checkbox" disabled={!canManage} checked={comms.whatsappEnabled} onChange={(e) => setComms({ ...comms, whatsappEnabled: e.target.checked })} />
              Prefer WhatsApp when integration is configured
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input type="checkbox" disabled={!canManage} checked={comms.pushEnabled} onChange={(e) => setComms({ ...comms, pushEnabled: e.target.checked })} />
              Enable push notifications (PWA)
            </label>
          </div>
        </div>
      )}

      {tab === "academic" && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Academic &amp; attendance policies</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Grading system</label>
              <select className="input" disabled={!canManage} value={gradingScale} onChange={(e) => setGradingScale(e.target.value)}>
                <option value="percentage">Percentage</option>
                <option value="letter">Letter grades</option>
                <option value="gpa">GPA 4.0</option>
              </select>
            </div>
            <div>
              <label className="label">Curriculum framework</label>
              <input className="input" disabled={!canManage} value={curriculumFw} onChange={(e) => setCurriculumFw(e.target.value)} placeholder="CBC, IGCSE, UNEB…" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Default academic year label</label>
              <input className="input" disabled={!canManage} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025/2026" />
            </div>
            <div>
              <label className="label">Late threshold (minutes)</label>
              <input type="number" className="input" disabled={!canManage} min={0} value={lateThreshold} onChange={(e) => setLateThreshold(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Consecutive absences alert</label>
              <input type="number" className="input" disabled={!canManage} min={1} value={absentThreshold} onChange={(e) => setAbsentThreshold(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Late fee penalty (%)</label>
              <input type="number" className="input" disabled={!canManage} min={0} max={100} value={latePenalty} onChange={(e) => setLatePenalty(Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Enable gateways parents can use on the portal. Pesapal is recommended for Uganda and East Africa.
          </p>
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">Pesapal</h3>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" disabled={!canManage} checked={payPesapalEnabled} onChange={(e) => setPayPesapalEnabled(e.target.checked)} />
                Enabled
              </label>
            </div>
            <p className="text-xs text-slate-500">Card, mobile money, and bank via Pesapal v3. Register IPN URL: <span className="font-mono text-slate-400">/api/webhooks/pesapal</span></p>
            <div>
              <label className="label">Consumer key</label>
              <input className="input font-mono text-sm" disabled={!canManage || !payPesapalEnabled} value={payPesapalKey} onChange={(e) => setPayPesapalKey(e.target.value)} placeholder="From Pesapal merchant dashboard" />
            </div>
            <div>
              <label className="label">Consumer secret</label>
              <input type="password" className="input font-mono text-sm" disabled={!canManage || !payPesapalEnabled} value={payPesapalSecret} onChange={(e) => setPayPesapalSecret(e.target.value)} placeholder={payPesapalSecretConfigured ? "•••••••• (leave blank to keep)" : "Consumer secret"} />
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">PayPal</h3>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" disabled={!canManage} checked={payPaypalEnabled} onChange={(e) => setPayPaypalEnabled(e.target.checked)} />
                Enabled
              </label>
            </div>
            <div>
              <label className="label">Client ID</label>
              <input className="input font-mono text-sm" disabled={!canManage || !payPaypalEnabled} value={payPaypalClientId} onChange={(e) => setPayPaypalClientId(e.target.value)} placeholder="PayPal REST app client ID" />
            </div>
          </div>
        </div>
      )}

      {tab === "email" && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-400" />
            <h3 className="font-semibold text-white">Custom SMTP</h3>
          </div>
          {!customSmtpAllowed ? (
            <p className="text-sm text-slate-400">
              Not on your plan. Ask your platform admin to enable the <span className="font-mono text-slate-300">custom_smtp</span> feature for this school.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-400">Send invoices, campaigns, and notices from your school email (Gmail, Microsoft 365, etc.).</p>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" disabled={!canManage} checked={smtp.enabled} onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })} />
                Enable custom SMTP
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">SMTP host</label>
                  <input className="input" disabled={!canManage} placeholder="smtp.gmail.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input type="number" className="input" disabled={!canManage} value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) || 587 })} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-slate-300 text-sm">
                    <input type="checkbox" disabled={!canManage} checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} />
                    SSL/TLS (465)
                  </label>
                </div>
                <div>
                  <label className="label">Username</label>
                  <input className="input" disabled={!canManage} autoComplete="off" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" disabled={!canManage} autoComplete="new-password" placeholder={smtp.passwordConfigured ? "•••••••• (unchanged)" : "App password"} value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} />
                </div>
                <div>
                  <label className="label">From email</label>
                  <input type="email" className="input" disabled={!canManage} value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} />
                </div>
                <div>
                  <label className="label">From name</label>
                  <input className="input" disabled={!canManage} value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} />
                </div>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800">
                  <input type="email" className="input flex-1 min-w-[200px]" placeholder="Test recipient" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                  <button type="button" className="btn-secondary" disabled={testingSmtp || !smtp.host} onClick={testSmtp}>
                    {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send test
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "modules" && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Enabled modules</h3>
          <p className="text-sm text-slate-400">
            Toggle features included in your subscription. Disabled modules hide sidebar links for staff.
          </p>
          <input className="input" placeholder="Search modules…" value={featureSearch} onChange={(e) => setFeatureSearch(e.target.value)} />
          {Object.keys(featuresByCategory).length === 0 ? (
            <p className="text-slate-500 text-sm">No modules match your search.</p>
          ) : (
            Object.entries(featuresByCategory).map(([cat, rows]) => (
              <div key={cat}>
                <p className="text-xs uppercase text-slate-500 mb-2">{cat}</p>
                <div className="space-y-2">
                  {rows.map((f) => (
                    <label key={f.code} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 cursor-pointer hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={!canManage}
                        checked={f.enabled}
                        onChange={(e) => toggleFeature(f.code, e.target.checked)}
                      />
                      <div>
                        <p className="text-white text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{f.code}</p>
                        {f.description && <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "data" && (
        <div className="space-y-4">
          <DemoDataPanel schoolSlug={schoolSlug!} showAdminLink />
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Settings backup</h3>
          <p className="text-sm text-slate-400">Export or import branding, policies, and communications JSON (not student data).</p>
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={exportSettings}>
            <Download className="w-4 h-4" /> Export JSON
          </button>
          <textarea className="input min-h-[140px] font-mono text-xs" disabled={!canManage} placeholder="Paste exported JSON to import…" value={importJson} onChange={(e) => setImportJson(e.target.value)} />
          {canManage && (
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={importSettings}>
              <Upload className="w-4 h-4" /> Import settings
            </button>
          )}
        </div>
        </div>
      )}

      {canManage && tab !== "data" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3 flex justify-end max-w-4xl mx-auto">
          <button type="button" className="btn-primary min-w-[160px]" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save settings</>}
          </button>
        </div>
      )}
    </div>
  );
};
