import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import {
  Shield, Loader2, Key, Globe, Webhook, Activity, Smartphone, Download, Plus, Copy, Check,
} from "lucide-react";

type Tab = "sessions" | "mfa" | "activity" | "compliance" | "api-keys" | "webhooks" | "policy";

const TAB_META: { id: Tab; label: string; icon: React.ElementType; manageOnly?: boolean }[] = [
  { id: "sessions", label: "Sessions", icon: Smartphone },
  { id: "mfa", label: "Two-factor", icon: Shield },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "policy", label: "Access policy", icon: Globe, manageOnly: true },
  { id: "api-keys", label: "API keys", icon: Key, manageOnly: true },
  { id: "webhooks", label: "Webhooks", icon: Webhook, manageOnly: true },
  { id: "compliance", label: "Compliance", icon: Download, manageOnly: true },
];

const WEBHOOK_EVENTS = ["invoice.paid", "payment.received", "student.enrolled", "attendance.marked"];

export const Security: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("settings.manage");

  const [tab, setTab] = useState<Tab>("sessions");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState(false);
  const [activity, setActivity] = useState<any>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaUri, setMfaUri] = useState("");
  const [token, setToken] = useState("");
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [keyForm, setKeyForm] = useState({ name: "", scopes: "read" });
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [whForm, setWhForm] = useState({ url: "", events: "invoice.paid", secret: "" });
  const [ipList, setIpList] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = `/s/${schoolSlug}/api/security`;

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "sessions") {
        const path = allSessions && canManage ? `${base}/sessions/all` : `${base}/sessions`;
        setSessions((await api.get(path)).data ?? []);
      } else if (tab === "mfa") {
        const r = await api.get(`${base}/mfa/status`);
        setMfaEnabled(Boolean(r.data?.enabled));
      } else if (tab === "activity") {
        setActivity((await api.get(`${base}/activity`)).data);
      } else if (tab === "api-keys" && canManage) {
        setApiKeys((await api.get(`${base}/api-keys`)).data ?? []);
      } else if (tab === "webhooks" && canManage) {
        setWebhooks((await api.get(`${base}/webhooks`)).data ?? []);
      } else if (tab === "policy" && canManage) {
        const s = (await api.get(`${base}/settings`)).data ?? {};
        setIpList((s.ipAllowlist ?? []).join("\n"));
        setMfaRequired(Boolean(s.mfaRequired));
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [base, tab, allSessions, canManage, toast]);

  useEffect(() => { loadTab(); }, [loadTab]);

  const visibleTabs = TAB_META.filter((t) => !t.manageOnly || canManage);

  const revokeSession = async (id: string) => {
    await api.post(`${base}/sessions/${id}/revoke`, {});
    toast("Session revoked", "success");
    loadTab();
  };

  const revokeOthers = async () => {
    await api.post(`${base}/sessions/revoke-others`, {});
    toast("Other sessions signed out", "success");
    loadTab();
  };

  const copyKey = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-7 h-7 text-red-400" />
            Security
          </h1>
          <p className="text-slate-400 mt-1">Sessions, MFA, API access, webhooks, and compliance exports</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              tab === id ? "bg-red-600/90 text-white" : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {tab === "sessions" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <p className="text-sm text-slate-400">Active sign-ins for your account{allSessions && canManage ? " (all staff sessions)" : ""}.</p>
                <div className="flex gap-2">
                  {canManage && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => { setAllSessions(!allSessions); }}>
                      {allSessions ? "My sessions only" : "All school sessions"}
                    </button>
                  )}
                  <button type="button" className="btn-secondary text-xs" onClick={revokeOthers}>
                    Sign out other devices
                  </button>
                </div>
              </div>
              <div className="card overflow-hidden">
                <table className="table text-sm">
                  <thead>
                    <tr><th>Device</th><th>IP</th><th>Started</th><th>Expires</th><th></th></tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-slate-500">No active sessions.</td></tr>
                    ) : sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="text-slate-300 max-w-xs truncate" title={s.userAgent}>{s.userAgent?.slice(0, 48) || "Unknown"}</td>
                        <td className="font-mono text-xs text-slate-500">{s.ipAddress ?? "—"}</td>
                        <td className="text-slate-400 whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="text-slate-500 whitespace-nowrap">{new Date(s.expiresAt).toLocaleDateString()}</td>
                        <td>
                          <ConfirmAction label="Revoke" confirmMessage="Revoke this session?" onConfirm={() => revokeSession(s.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "mfa" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-white">Authenticator app (TOTP)</h3>
                <p className="text-sm text-slate-400">
                  Status:{" "}
                  <span className={mfaEnabled ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                    {mfaEnabled ? "Enabled" : "Not enabled"}
                  </span>
                </p>
                {!mfaEnabled && (
                  <>
                    <button type="button" className="btn-primary" onClick={async () => {
                      const r = await api.post(`${base}/mfa/setup`, {});
                      setMfaUri(r.data?.uri ?? "");
                      toast("Scan the URI in Google Authenticator or similar", "success");
                    }}>Generate setup code</button>
                    {mfaUri && (
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <p className="text-xs text-slate-500 mb-2">Provisioning URI (paste in authenticator if QR unavailable):</p>
                        <code className="text-xs text-slate-300 break-all">{mfaUri}</code>
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="label">6-digit code</label>
                        <input className="input" maxLength={6} placeholder="000000" value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} />
                      </div>
                      <button type="button" className="btn-primary" disabled={token.length !== 6} onClick={async () => {
                        await api.post(`${base}/mfa/enable`, { token });
                        toast("MFA enabled", "success");
                        setMfaUri("");
                        setToken("");
                        setMfaEnabled(true);
                      }}>Enable MFA</button>
                    </div>
                  </>
                )}
                {mfaEnabled && (
                  <div className="flex gap-2 items-end pt-2 border-t border-slate-800">
                    <div className="flex-1">
                      <label className="label">Code to disable</label>
                      <input className="input" maxLength={6} value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} />
                    </div>
                    <button type="button" className="btn-secondary text-red-400" disabled={token.length !== 6} onClick={async () => {
                      await api.post(`${base}/mfa/disable`, { token });
                      toast("MFA disabled", "success");
                      setToken("");
                      setMfaEnabled(false);
                    }}>Disable MFA</button>
                  </div>
                )}
              </div>
              {canManage && (
                <div className="card p-6 space-y-3">
                  <h3 className="font-semibold text-white">School policy</h3>
                  <p className="text-sm text-slate-400">Require MFA for all staff — configure under Access policy tab, or enable here after saving policy.</p>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={mfaRequired} onChange={(e) => setMfaRequired(e.target.checked)} />
                    Require MFA for staff (saved with access policy)
                  </label>
                </div>
              )}
            </div>
          )}

          {tab === "activity" && activity && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">Recent events</h3>
                <div className="max-h-96 overflow-y-auto space-y-2 text-sm">
                  {(activity.recent ?? []).slice(0, 30).map((log: any) => (
                    <div key={log.id} className="flex justify-between gap-2 border-b border-slate-800 pb-2">
                      <code className="text-xs text-primary-300">{log.action}</code>
                      <span className="text-slate-500 text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                  {!(activity.recent?.length) && <p className="text-slate-500">No activity yet.</p>}
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">By action type</h3>
                <ul className="space-y-2 text-sm">
                  {(activity.byAction ?? []).map((a: any) => (
                    <li key={a.action} className="flex justify-between text-slate-300">
                      <code className="text-xs">{a.action}</code>
                      <span className="text-slate-500">{a.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === "policy" && canManage && (
            <form className="card p-6 space-y-4 max-w-2xl" onSubmit={async (e) => {
              e.preventDefault();
              await api.put(`${base}/settings`, {
                ipAllowlist: ipList.split("\n").map((s) => s.trim()).filter(Boolean),
                mfaRequired,
              });
              toast("Security policy saved", "success");
            }}>
              <h3 className="font-semibold text-white">IP allowlist</h3>
              <p className="text-sm text-slate-400">Leave empty to allow any IP. One address or CIDR per line.</p>
              <textarea className="input min-h-[120px] font-mono text-sm" value={ipList} onChange={(e) => setIpList(e.target.value)} placeholder="203.0.113.10&#10;192.168.1.0/24" />
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={mfaRequired} onChange={(e) => setMfaRequired(e.target.checked)} />
                Require two-factor authentication for all staff
              </label>
              <button type="submit" className="btn-primary">Save policy</button>
            </form>
          )}

          {tab === "api-keys" && canManage && (
            <div className="space-y-4">
              {newKeyRaw && (
                <div className="card p-5 border border-amber-700/50 bg-amber-950/20">
                  <p className="text-amber-200 text-sm font-medium mb-2">Copy this key now — it won&apos;t be shown again.</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-xs text-white break-all bg-slate-900 p-2 rounded">{newKeyRaw}</code>
                    <button type="button" className="btn-ghost" onClick={() => copyKey(newKeyRaw)}>
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="button" className="btn-ghost text-xs mt-2" onClick={() => setNewKeyRaw(null)}>Dismiss</button>
                </div>
              )}
              <form className="card p-5 flex flex-wrap gap-3 items-end" onSubmit={async (e) => {
                e.preventDefault();
                const r = await api.post(`${base}/api-keys`, { name: keyForm.name, scopes: [keyForm.scopes] });
                setNewKeyRaw(r.data?.key ?? null);
                setKeyForm({ name: "", scopes: "read" });
                loadTab();
                toast("API key created", "success");
              }}>
                <div className="flex-1 min-w-[160px]">
                  <label className="label">Name</label>
                  <input className="input" required placeholder="e.g. Integrations" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Scope</label>
                  <select className="input" value={keyForm.scopes} onChange={(e) => setKeyForm({ ...keyForm, scopes: e.target.value })}>
                    <option value="read">read</option>
                    <option value="write">write</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> Create key</button>
              </form>
              <div className="card overflow-hidden">
                <table className="table text-sm">
                  <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th></th></tr></thead>
                  <tbody>
                    {apiKeys.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-slate-500">No API keys.</td></tr>
                    ) : apiKeys.map((k) => (
                      <tr key={k.id}>
                        <td className="text-white font-medium">{k.name}</td>
                        <td className="font-mono text-xs text-slate-500">{k.keyPrefix}…</td>
                        <td className="text-slate-400">{(k.scopesJson ?? []).join(", ")}</td>
                        <td className="text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                        <td>
                          <ConfirmAction label="Revoke" confirmMessage={`Delete API key “${k.name}”?`} onConfirm={async () => {
                            await api.delete(`${base}/api-keys/${k.id}`);
                            toast("Key revoked", "success");
                            loadTab();
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "webhooks" && canManage && (
            <div className="space-y-4">
              <form className="card p-5 grid md:grid-cols-2 gap-3" onSubmit={async (e) => {
                e.preventDefault();
                await api.post(`${base}/webhooks`, {
                  url: whForm.url,
                  events: [whForm.events],
                  secret: whForm.secret || undefined,
                });
                setWhForm({ url: "", events: "invoice.paid", secret: "" });
                toast("Webhook added", "success");
                loadTab();
              }}>
                <h3 className="font-semibold text-white md:col-span-2">Add webhook endpoint</h3>
                <input className="input md:col-span-2" required type="url" placeholder="https://…" value={whForm.url} onChange={(e) => setWhForm({ ...whForm, url: e.target.value })} />
                <select className="input" value={whForm.events} onChange={(e) => setWhForm({ ...whForm, events: e.target.value })}>
                  {WEBHOOK_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                </select>
                <input className="input" placeholder="Signing secret (optional)" value={whForm.secret} onChange={(e) => setWhForm({ ...whForm, secret: e.target.value })} />
                <button type="submit" className="btn-primary md:col-span-2 max-w-xs"><Plus className="w-4 h-4" /> Add webhook</button>
              </form>
              <div className="card overflow-hidden">
                <table className="table text-sm">
                  <thead><tr><th>URL</th><th>Events</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {webhooks.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-10 text-slate-500">No webhooks configured.</td></tr>
                    ) : webhooks.map((w) => (
                      <tr key={w.id}>
                        <td className="text-slate-300 max-w-xs truncate" title={w.url}>{w.url}</td>
                        <td className="text-xs text-slate-500">{(w.eventsJson ?? []).join(", ")}</td>
                        <td><span className={w.active ? "text-emerald-400" : "text-slate-500"}>{w.active ? "Active" : "Paused"}</span></td>
                        <td className="space-x-1 whitespace-nowrap">
                          <button type="button" className="btn-ghost text-xs" onClick={async () => {
                            await api.patch(`${base}/webhooks/${w.id}`, { active: !w.active });
                            loadTab();
                          }}>{w.active ? "Pause" : "Enable"}</button>
                          <ConfirmAction label="Delete" confirmMessage="Delete this webhook?" onConfirm={async () => {
                            await api.delete(`${base}/webhooks/${w.id}`);
                            toast("Deleted", "success");
                            loadTab();
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "compliance" && canManage && (
            <div className="card p-8 max-w-xl space-y-4">
              <h3 className="font-semibold text-white text-lg">Compliance export</h3>
              <p className="text-sm text-slate-400">
                Download a JSON pack with tenant metadata, student/staff counts, and recent audit logs for GDPR or internal review.
              </p>
              <button type="button" className="btn-primary" onClick={async () => {
                const r = await api.get(`${base}/compliance-export`);
                const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `compliance-${schoolSlug}-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                toast("Export downloaded", "success");
              }}>
                <Download className="w-4 h-4" /> Download compliance pack
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
