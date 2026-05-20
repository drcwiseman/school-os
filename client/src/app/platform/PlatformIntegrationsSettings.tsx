import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Blocks,
  Plug,
  Search,
  Loader2,
  CheckCircle2,
  Circle,
  X,
  Save,
  Zap,
  Copy,
  ExternalLink,
  RefreshCw,
  Building2,
  Package,
  Filter,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type IntegrationEntry = {
  code: string;
  name: string;
  description: string;
  category: string;
  benefits: string[];
  popular?: boolean;
  docsUrl?: string;
};

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

type IntegrationConfig = {
  code: string;
  enabled: boolean;
  configured: boolean;
  credentials: Record<string, string>;
  notes: string;
  updatedAt: string | null;
  schema: { fields: FieldDef[]; webhookPath?: string; docsHint?: string };
  webhookUrl: string | null;
};

type Hub = {
  summary: { total: number; connected: number; enabled: number; popular: number };
  webhookBaseUrl: string;
  catalog: IntegrationEntry[];
  configs: IntegrationConfig[];
};

const CATEGORY_LABELS: Record<string, string> = {
  payments: "Payments",
  communications: "Communications",
  productivity: "Productivity",
  accounting: "Accounting",
  analytics: "Analytics",
  education: "Education",
};

const CATEGORY_STYLES: Record<string, string> = {
  payments: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  communications: "bg-sky-50 text-sky-700 ring-sky-600/20",
  productivity: "bg-violet-50 text-violet-700 ring-violet-600/20",
  accounting: "bg-amber-50 text-amber-700 ring-amber-600/20",
  analytics: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  education: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

type StatusFilter = "all" | "connected" | "enabled" | "available";

function StatusBadge({ config }: { config: IntegrationConfig }) {
  if (config.enabled && config.configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
        <CheckCircle2 size={11} /> Connected
      </span>
    );
  }
  if (config.configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20">
        <CheckCircle2 size={11} /> Configured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-500/20">
      <Circle size={11} /> Not set up
    </span>
  );
}

export const PlatformIntegrationsSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState<Hub | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(false);
  const [formCreds, setFormCreds] = useState<Record<string, string>>({});
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadHub = useCallback(async () => {
    const r = await api.get("/api/platform/settings/integrations");
    setHub(r.data as Hub);
    return r.data as Hub;
  }, []);

  useEffect(() => {
    loadHub()
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [loadHub, toast]);

  const configByCode = useMemo(() => {
    const m = new Map<string, IntegrationConfig>();
    hub?.configs.forEach((c) => m.set(c.code, c));
    return m;
  }, [hub]);

  const catalogByCode = useMemo(() => {
    const m = new Map<string, IntegrationEntry>();
    hub?.catalog.forEach((c) => m.set(c.code, c));
    return m;
  }, [hub]);

  const categories = useMemo(() => {
    const set = new Set(hub?.catalog.map((c) => c.category) ?? []);
    return ["all", ...Array.from(set).sort()];
  }, [hub]);

  const filtered = useMemo(() => {
    if (!hub) return [];
    const q = search.trim().toLowerCase();
    return hub.catalog.filter((entry) => {
      const cfg = configByCode.get(entry.code);
      if (category !== "all" && entry.category !== category) return false;
      if (statusFilter === "connected" && !cfg?.configured) return false;
      if (statusFilter === "enabled" && !cfg?.enabled) return false;
      if (statusFilter === "available" && cfg?.configured) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.code.toLowerCase().includes(q)
      );
    });
  }, [hub, search, category, statusFilter, configByCode]);

  const selectedEntry = selectedCode ? catalogByCode.get(selectedCode) : null;
  const selectedConfig = selectedCode ? configByCode.get(selectedCode) : null;

  const openConfigure = (code: string) => {
    const cfg = configByCode.get(code);
    setSelectedCode(code);
    setFormEnabled(cfg?.enabled ?? false);
    setFormNotes(cfg?.notes ?? "");
    const creds: Record<string, string> = {};
    cfg?.schema.fields.forEach((f) => {
      const masked = cfg.credentials[f.key];
      creds[f.key] = masked === "••••••••" ? "" : (masked ?? "");
    });
    setFormCreds(creds);
  };

  const closePanel = () => setSelectedCode(null);

  const saveConfig = async () => {
    if (!selectedCode) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled: formEnabled,
        notes: formNotes,
        credentials: formCreds,
      };
      await api.patch(`/api/platform/settings/integrations/${selectedCode}`, payload);
      toast("Integration saved", "success");
      await loadHub();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!selectedCode) return;
    setTesting(true);
    try {
      const r = await api.post(`/api/platform/settings/integrations/${selectedCode}/test`);
      toast(r.data?.message ?? "Test complete", r.data?.ok ? "success" : "error");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setTesting(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied`, "success");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading integrations…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Blocks size={22} className="text-blue-600" />
            Integrations
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Connect payment gateways, messaging, accounting, and analytics at the platform level. Schools inherit enabled connectors when their plan includes the matching feature.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm inline-flex items-center gap-1 shrink-0"
          onClick={() => loadHub().then(() => toast("Refreshed", "success")).catch((e) => toast(e.message, "error"))}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Available", value: hub?.summary.total ?? 0 },
          { label: "Configured", value: hub?.summary.connected ?? 0, tone: "text-blue-600" },
          { label: "Enabled", value: hub?.summary.enabled ?? 0, tone: "text-emerald-600" },
          { label: "Popular", value: hub?.summary.popular ?? 0, tone: "text-violet-600" },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.tone ?? "text-slate-800"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between`}>
        <div>
          <p className="text-xs font-semibold text-slate-700">Inbound webhooks base URL</p>
          <p className="text-sm font-mono text-slate-600 mt-0.5 break-all">{hub?.webhookBaseUrl}</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm inline-flex items-center gap-1 shrink-0"
          onClick={() => hub && copyText(hub.webhookBaseUrl, "Webhook base URL")}
        >
          <Copy size={14} /> Copy
        </button>
      </div>

      <div className={`${CARD} p-4 space-y-3`}>
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input text-sm w-full pl-9"
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input text-sm w-full lg:w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="connected">Configured</option>
            <option value="enabled">Enabled</option>
            <option value="available">Not set up</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "all" ? "All categories" : CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((entry) => {
          const cfg = configByCode.get(entry.code)!;
          const catStyle = CATEGORY_STYLES[entry.category] ?? "bg-slate-100 text-slate-600 ring-slate-500/20";
          return (
            <article
              key={entry.code}
              className={`${CARD} p-4 flex flex-col hover:border-blue-200 transition-colors`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Plug size={18} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{entry.name}</p>
                    <span
                      className={`inline-block mt-0.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ring-1 ring-inset ${catStyle}`}
                    >
                      {CATEGORY_LABELS[entry.category] ?? entry.category}
                    </span>
                  </div>
                </div>
                {entry.popular && (
                  <span className="text-[10px] font-bold text-emerald-600 uppercase shrink-0">Popular</span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-3 flex-1 line-clamp-2">{entry.description}</p>
              <ul className="mt-2 space-y-0.5">
                {entry.benefits.slice(0, 2).map((b) => (
                  <li key={b} className="text-[11px] text-slate-500 truncate">
                    • {b}
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <StatusBadge config={cfg} />
                <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => openConfigure(entry.code)}>
                  Configure
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className={`${CARD} p-12 text-center text-slate-500`}>
          <Filter size={32} className="mx-auto text-slate-300 mb-2" />
          No integrations match your filters.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/platform/marketplace" className={`${CARD} p-4 hover:border-blue-200 transition-colors flex items-center gap-3`}>
          <Package size={20} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Marketplace & add-ons</p>
            <p className="text-xs text-slate-500">Paid modules and integration catalog overview</p>
          </div>
          <ExternalLink size={14} className="text-slate-400 ml-auto shrink-0" />
        </Link>
        <Link to="/platform/tenants" className={`${CARD} p-4 hover:border-blue-200 transition-colors flex items-center gap-3`}>
          <Building2 size={20} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Per-school overrides</p>
            <p className="text-xs text-slate-500">Enable features and add-ons on each tenant</p>
          </div>
          <ExternalLink size={14} className="text-slate-400 ml-auto shrink-0" />
        </Link>
      </div>

      {selectedCode && selectedEntry && selectedConfig && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={closePanel} />
          <aside className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full animate-in slide-in-from-right">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedEntry.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedCode}</p>
              </div>
              <button type="button" className="p-1 text-slate-400 hover:text-slate-700" onClick={closePanel}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-sm text-slate-600">{selectedEntry.description}</p>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} />
                Enable for platform (schools with matching plan)
              </label>

              {selectedConfig.schema.docsHint && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {selectedConfig.schema.docsHint}
                </p>
              )}

              {selectedConfig.webhookUrl && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Webhook URL (register at provider)</p>
                  <div className="flex gap-2">
                    <input className="input text-xs font-mono flex-1" readOnly value={selectedConfig.webhookUrl} />
                    <button
                      type="button"
                      className="btn-secondary text-xs px-2"
                      onClick={() => copyText(selectedConfig.webhookUrl!, "Webhook URL")}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Credentials</p>
                {selectedConfig.schema.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-slate-600">
                      {field.label}
                      {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    <input
                      type={field.type === "password" ? "password" : field.type === "email" ? "email" : "text"}
                      className="input text-sm mt-1 w-full font-mono"
                      placeholder={
                        field.placeholder ??
                        (configByCode.get(selectedCode)?.credentials[field.key] === "••••••••"
                          ? "Leave blank to keep current"
                          : undefined)
                      }
                      value={formCreds[field.key] ?? ""}
                      onChange={(e) => setFormCreds({ ...formCreds, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Internal notes</label>
                <textarea
                  className="input text-sm mt-1 w-full min-h-[72px]"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Support notes, rollout status, contact at vendor…"
                />
              </div>

              {selectedConfig.updatedAt && (
                <p className="text-[11px] text-slate-400">
                  Last updated {new Date(selectedConfig.updatedAt).toLocaleString()}
                </p>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-1 flex-1 justify-center"
                disabled={saving}
                onClick={saveConfig}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
              <button
                type="button"
                className="btn-secondary text-sm inline-flex items-center gap-1"
                disabled={testing}
                onClick={testConnection}
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Test
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
