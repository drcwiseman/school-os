import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Send,
  Server,
  FileText,
  Activity,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Save,
  Zap,
  Shield,
  ExternalLink,
  Megaphone,
} from "lucide-react";
import { api } from "../api/client";
import { PlatformEmailCampaignsPanel } from "./components/PlatformEmailCampaignsPanel";
import { useToast } from "../components/Toast";
import { PasswordInput } from "../components/PasswordInput";
import {
  EmailRichTextEditor,
  type EmailRichTextEditorHandle,
} from "./components/EmailRichTextEditor";
import "./components/email-editor.css";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type SmtpForm = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  password: string;
  passwordConfigured: boolean;
  source: "env" | "database" | "none";
};

type TemplateRow = {
  code: string;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: string[];
  enabled: boolean;
  updatedAt: string;
};

type LogRow = {
  id: string;
  templateCode: string | null;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type EmailHub = {
  smtp: SmtpForm | null;
  configured: boolean;
  summary: {
    sent24h: number;
    failed24h: number;
    totalSent: number;
    totalFailed: number;
    templatesEnabled: number;
    templatesTotal: number;
  };
  templates: TemplateRow[];
  recentLogs: LogRow[];
};

type Tab = "overview" | "smtp" | "templates" | "campaigns" | "activity";

const EMPTY_SMTP: SmtpForm = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  fromEmail: "",
  fromName: "SchoolOS Platform",
  enabled: true,
  password: "",
  passwordConfigured: false,
  source: "none",
};

function applyMergeVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function StatusPill({ configured, source }: { configured: boolean; source: SmtpForm["source"] }) {
  if (source === "env") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
        <Shield size={14} /> Server env (PLATFORM_SMTP_*)
      </span>
    );
  }
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <CheckCircle2 size={14} /> Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
      <AlertCircle size={14} /> Not configured
    </span>
  );
}

export const PlatformEmailSettings: React.FC = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState<EmailHub | null>(null);
  const [smtp, setSmtp] = useState<SmtpForm>(EMPTY_SMTP);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logFilter, setLogFilter] = useState("all");
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplText, setTplText] = useState("");
  const [tplEnabled, setTplEnabled] = useState(true);
  const [savingTpl, setSavingTpl] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [testTplTo, setTestTplTo] = useState("");
  const [sendingTestTpl, setSendingTestTpl] = useState(false);
  const editorRef = useRef<EmailRichTextEditorHandle>(null);

  const previewSampleVars = useMemo(
    () => ({
      siteName: smtp.fromName?.replace(/ Platform$/i, "") || "SchoolOS",
      name: "Alex Operator",
      loginUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/platform/login`,
      email: "operator@example.com",
      password: "TempPass-42",
      newPassword: "NewPass-99",
      roleLabel: "Support",
      sentAt: new Date().toLocaleString(),
    }),
    [smtp.fromName],
  );

  const livePreviewSubject = useMemo(
    () => applyMergeVars(tplSubject, previewSampleVars),
    [tplSubject, previewSampleVars],
  );
  const livePreviewHtml = useMemo(
    () => applyMergeVars(tplHtml, previewSampleVars),
    [tplHtml, previewSampleVars],
  );

  const loadHub = useCallback(async () => {
    const r = await api.get("/api/platform/settings/email");
    const data = r.data as EmailHub;
    setHub(data);
    if (data.smtp) setSmtp({ ...EMPTY_SMTP, ...data.smtp });
    setSelectedCode((prev) => prev ?? data.templates[0]?.code ?? null);
    return data;
  }, []);

  useEffect(() => {
    loadHub()
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [loadHub, toast]);

  const selectedTemplate = useMemo(
    () => hub?.templates.find((t) => t.code === selectedCode) ?? null,
    [hub, selectedCode],
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setTplSubject(selectedTemplate.subject);
    setTplHtml(selectedTemplate.bodyHtml);
    setTplText(selectedTemplate.bodyText ?? "");
    setTplEnabled(selectedTemplate.enabled);
  }, [selectedTemplate?.code]);

  const refreshPreview = async () => {
    if (!selectedCode) return;
    setLoadingPreview(true);
    try {
      const r = await api.get(`/api/platform/settings/email/templates/${selectedCode}/preview`);
      setTplSubject(r.data.subject);
      setTplHtml(r.data.html);
      toast("Preview synced from server", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoadingPreview(false);
    }
  };

  const saveSmtp = async () => {
    setSavingSmtp(true);
    try {
      const body: Record<string, unknown> = {
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        user: smtp.user,
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
        enabled: smtp.enabled,
      };
      if (smtp.password) body.password = smtp.password;
      const r = await api.patch("/api/platform/settings/email/smtp", body);
      setSmtp({ ...smtp, ...r.data, password: "" });
      toast("SMTP settings saved", "success");
      await loadHub();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSavingSmtp(false);
    }
  };

  const verifySmtp = async () => {
    setVerifying(true);
    try {
      await api.post("/api/platform/settings/email/smtp/verify");
      toast("SMTP connection verified", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setVerifying(false);
    }
  };

  const sendSmtpTest = async () => {
    if (!testEmail.trim()) {
      toast("Enter a test recipient email", "error");
      return;
    }
    setTesting(true);
    try {
      const body: Record<string, unknown> = { testEmail: testEmail.trim() };
      if (smtp.source !== "env") {
        body.host = smtp.host;
        body.port = smtp.port;
        body.secure = smtp.secure;
        body.user = smtp.user;
        body.fromEmail = smtp.fromEmail;
        body.fromName = smtp.fromName;
        if (smtp.password) body.password = smtp.password;
      }
      await api.post("/api/platform/settings/email/smtp/test", body);
      toast("Test email sent — check the inbox", "success");
      const data = await loadHub();
      setLogs(data.recentLogs);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setTesting(false);
    }
  };

  const saveTemplate = async () => {
    if (!selectedCode) return;
    setSavingTpl(true);
    try {
      await api.patch(`/api/platform/settings/email/templates/${selectedCode}`, {
        subject: tplSubject,
        bodyHtml: tplHtml,
        bodyText: tplText || undefined,
        enabled: tplEnabled,
      });
      toast("Template saved", "success");
      await loadHub();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSavingTpl(false);
    }
  };

  const sendTemplateTest = async () => {
    if (!selectedCode || !testTplTo.trim()) {
      toast("Enter recipient for test send", "error");
      return;
    }
    setSendingTestTpl(true);
    try {
      await api.post(`/api/platform/settings/email/templates/${selectedCode}/send-test`, {
        to: testTplTo.trim(),
      });
      toast("Template test sent", "success");
      const data = await loadHub();
      setLogs(data.recentLogs);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSendingTestTpl(false);
    }
  };

  const loadLogs = async (status = logFilter) => {
    setLoadingLogs(true);
    try {
      const q = new URLSearchParams({ status, limit: "200" });
      const r = await api.get(`/api/platform/settings/email/logs?${q}`);
      setLogs(r.data);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (tab === "activity") loadLogs();
  }, [tab, logFilter]);

  const envLocked = smtp.source === "env";
  const readOnly = envLocked;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading email settings…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Mail size={16} /> },
    { id: "smtp", label: "SMTP & sending", icon: <Server size={16} /> },
    { id: "templates", label: "Templates", icon: <FileText size={16} /> },
    { id: "campaigns", label: "Campaigns", icon: <Megaphone size={16} /> },
    { id: "activity", label: "Delivery log", icon: <Activity size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Email & delivery</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Configure platform SMTP, edit transactional templates, and monitor delivery — the same workflow as bulk email consoles (SendGrid, Mailchimp transactional).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill configured={hub?.configured ?? false} source={smtp.source} />
          <button
            type="button"
            className="btn-secondary text-sm inline-flex items-center gap-1"
            onClick={() => loadHub().then(() => toast("Refreshed", "success")).catch((e) => toast(e.message, "error"))}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sent (24h)", value: hub?.summary.sent24h ?? 0, tone: "text-emerald-600" },
          { label: "Failed (24h)", value: hub?.summary.failed24h ?? 0, tone: "text-rose-600" },
          { label: "Lifetime sent", value: hub?.summary.totalSent ?? 0, tone: "text-slate-800" },
          { label: "Active templates", value: `${hub?.summary.templatesEnabled ?? 0}/${hub?.summary.templatesTotal ?? 0}`, tone: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${CARD} p-5`}>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Server size={16} className="text-blue-600" /> Sending identity
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">From</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {smtp.fromName && smtp.fromEmail ? `"${smtp.fromName}" <${smtp.fromEmail}>` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">SMTP host</dt>
                <dd className="font-mono text-xs text-slate-700">{smtp.host || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Port / TLS</dt>
                <dd className="text-slate-700">
                  {smtp.port} {smtp.secure ? "(SSL)" : "(STARTTLS)"}
                </dd>
              </div>
            </dl>
            <button type="button" className="btn-primary text-sm mt-4" onClick={() => setTab("smtp")}>
              Configure SMTP
            </button>
          </div>

          <div className={`${CARD} p-5`}>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-violet-600" /> Transactional templates
            </h2>
            <ul className="mt-3 space-y-2">
              {hub?.templates.map((t) => (
                <li key={t.code} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="font-medium text-slate-800">{t.name}</span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      t.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.enabled ? "Active" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-secondary text-sm mt-4" onClick={() => setTab("templates")}>
              Edit templates
            </button>
          </div>

          <div className={`${CARD} p-5 lg:col-span-2`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent delivery</h2>
              <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setTab("activity")}>
                View all
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Recipient</th>
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(hub?.recentLogs ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No platform emails sent yet. Send an SMTP test to verify delivery.
                      </td>
                    </tr>
                  ) : (
                    hub?.recentLogs.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">{row.recipient}</td>
                        <td className="py-2.5 pr-4 max-w-[200px] truncate" title={row.subject}>
                          {row.subject}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`text-[11px] font-semibold capitalize ${
                              row.status === "sent" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              School-level bulk campaigns appear in{" "}
              <Link to="/platform/logs" className="text-blue-600 hover:underline">
                System Logs
              </Link>{" "}
              (per-tenant delivery_logs).
            </p>
          </div>
        </div>
      )}

      {tab === "smtp" && (
        <div className="space-y-4">
          {envLocked && (
            <div className={`${CARD} p-4 bg-indigo-50 border-indigo-200`}>
              <p className="text-sm text-indigo-900">
                SMTP is controlled by server environment variables (<code className="text-xs">PLATFORM_SMTP_*</code>).
                Remove them from the VPS to edit settings in this console.
              </p>
            </div>
          )}

          <div className={`${CARD} p-5 space-y-4`}>
            <h2 className="text-sm font-semibold text-slate-900">SMTP server</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={smtp.enabled}
                disabled={readOnly}
                onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
              />
              Enable platform email sending
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Host</label>
                <input
                  className="input text-sm mt-1 w-full"
                  placeholder="smtp.sendgrid.net"
                  value={smtp.host}
                  disabled={readOnly}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Port</label>
                <input
                  type="number"
                  className="input text-sm mt-1 w-full"
                  value={smtp.port}
                  disabled={readOnly}
                  onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) || 587 })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Username</label>
                <input
                  className="input text-sm mt-1 w-full"
                  value={smtp.user}
                  disabled={readOnly}
                  onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Password</label>
                <PasswordInput
                  className="input text-sm mt-1 w-full"
                  placeholder={smtp.passwordConfigured ? "•••••••• (unchanged)" : "App password"}
                  value={smtp.password}
                  disabled={readOnly}
                  onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">From email</label>
                <input
                  type="email"
                  className="input text-sm mt-1 w-full"
                  value={smtp.fromEmail}
                  disabled={readOnly}
                  onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">From name</label>
                <input
                  className="input text-sm mt-1 w-full"
                  value={smtp.fromName}
                  disabled={readOnly}
                  onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={smtp.secure}
                disabled={readOnly}
                onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
              />
              Use SSL/TLS on connect (port 465)
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-1"
                disabled={savingSmtp || readOnly}
                onClick={saveSmtp}
              >
                {savingSmtp ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save SMTP
              </button>
              <button
                type="button"
                className="btn-secondary text-sm inline-flex items-center gap-1"
                disabled={verifying || !hub?.configured}
                onClick={verifySmtp}
              >
                {verifying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Verify connection
              </button>
            </div>
          </div>

          <div className={`${CARD} p-5`}>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Send size={16} /> Send test email
            </h2>
            <p className="text-xs text-slate-500 mt-1">Delivers the SMTP test template to confirm inbox placement.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input
                type="email"
                className="input text-sm flex-1"
                placeholder="you@company.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center justify-center gap-1"
                disabled={testing}
                onClick={sendSmtpTest}
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send test
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Popular providers: SendGrid (smtp.sendgrid.net:587), Amazon SES, Mailgun, Gmail (smtp.gmail.com + app password).
            Platform emails power{" "}
            <Link to="/platform/users" className="text-blue-600 hover:underline">
              operator invites
            </Link>{" "}
            and password resets.
          </p>
        </div>
      )}

      {tab === "templates" && selectedTemplate && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className={`${CARD} lg:col-span-3 p-3`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">Templates</p>
            <ul className="mt-1 space-y-0.5">
              {hub?.templates.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setSelectedCode(t.code)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCode === t.code ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t.name}
                  <span className="block text-[10px] text-slate-400 capitalize">{t.category}</span>
                </button>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-9 space-y-4">
            <div className={`${CARD} p-5 space-y-4`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{selectedTemplate.name}</h2>
                  {selectedTemplate.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedTemplate.description}</p>
                  )}
                </div>
                {selectedTemplate.code !== "smtp_test" && (
                  <label className="flex items-center gap-2 text-xs shrink-0">
                    <input
                      type="checkbox"
                      checked={tplEnabled}
                      onChange={(e) => setTplEnabled(e.target.checked)}
                    />
                    Enabled
                  </label>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Subject line</label>
                <input
                  className="input text-sm mt-1 w-full font-mono"
                  value={tplSubject}
                  onChange={(e) => setTplSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Email body</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Rich text editor — use the toolbar for styling. Click merge tags to insert at cursor, or switch to HTML source for advanced edits.
                </p>
                <EmailRichTextEditor
                  key={selectedCode ?? "editor"}
                  ref={editorRef}
                  value={tplHtml}
                  onChange={setTplHtml}
                  placeholder="Compose your email…"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Plain text (optional)</label>
                <textarea
                  className="input text-sm mt-1 w-full font-mono min-h-[80px]"
                  value={tplText}
                  onChange={(e) => setTplText(e.target.value)}
                  placeholder="Auto-generated from HTML if empty"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Merge variables — click to insert</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-800 font-mono"
                      onClick={() => {
                        editorRef.current?.insertMergeTag(v);
                        toast(`Inserted {{${v}}}`, "success");
                      }}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-sm inline-flex items-center gap-1"
                  disabled={savingTpl}
                  onClick={saveTemplate}
                >
                  {savingTpl ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save template
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  disabled={loadingPreview}
                  onClick={refreshPreview}
                >
                  {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  Reset from saved
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-600 mb-2">Send test with sample data</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="input text-sm flex-1"
                    placeholder="test@example.com"
                    value={testTplTo}
                    onChange={(e) => setTestTplTo(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={sendingTestTpl}
                    onClick={sendTemplateTest}
                  >
                    {sendingTestTpl ? <Loader2 size={14} className="animate-spin" /> : "Send"}
                  </button>
                </div>
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Eye size={16} className="text-slate-500" />
                  Live preview
                </h3>
                <span className="text-[11px] text-slate-400">Sample merge data applied</span>
              </div>
              <div className="email-preview-frame">
                <div className="email-preview-inbox">
                  <div className="email-preview-inbox-header">{livePreviewSubject || "—"}</div>
                  <div
                    className="email-preview-inbox-body"
                    dangerouslySetInnerHTML={{ __html: livePreviewHtml }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "campaigns" && <PlatformEmailCampaignsPanel />}

      {tab === "activity" && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Platform delivery log</h2>
            <select
              className="input text-sm w-auto"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          {loadingLogs ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="animate-spin inline mr-2" size={18} /> Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        No delivery events yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.recipient}</td>
                        <td className="px-4 py-3 text-slate-600">{row.templateCode ?? "—"}</td>
                        <td className="px-4 py-3 max-w-[180px] truncate" title={row.subject}>
                          {row.subject}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold capitalize ${
                              row.status === "sent" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {row.status === "sent" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-rose-600 max-w-[200px] truncate" title={row.error ?? ""}>
                          {row.error ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center gap-1">
            <ExternalLink size={12} />
            Tenant bulk SMS/email campaigns: <Link to="/platform/logs" className="text-blue-600 hover:underline">System Logs</Link>
          </div>
        </div>
      )}
    </div>
  );
};
