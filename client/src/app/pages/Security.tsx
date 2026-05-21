import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Shield, Loader2 } from "lucide-react";

const TABS = ["sessions", "mfa", "activity", "compliance", "api-keys", "webhooks", "ip"] as const;

export const Security: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("sessions");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any>(null);
  const [mfaUri, setMfaUri] = useState("");
  const [token, setToken] = useState("");
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [ipList, setIpList] = useState("");

  const base = `/s/${schoolSlug}/api/security`;

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      try {
        if (tab === "sessions") setSessions((await api.get(`${base}/sessions`)).data ?? []);
        if (tab === "activity") setActivity((await api.get(`${base}/activity`)).data);
        if (tab === "api-keys") setApiKeys((await api.get(`${base}/api-keys`)).data ?? []);
        if (tab === "ip") {
          const s = (await api.get(`${base}/settings`)).data;
          setIpList((s.ipAllowlist ?? []).join("\n"));
        }
      } catch (e: any) { toast(e.message, "error"); }
      finally { setLoading(false); }
    };
    run();
  }, [schoolSlug, tab]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Shield className="w-7 h-7 text-red-400" /> Security</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} type="button" className={`tab-pill ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : (
        <div className="card p-5 space-y-3">
          {tab === "sessions" && sessions.map((s) => (
            <p key={s.id} className="text-slate-400 text-sm">{s.userAgent?.slice(0, 40)} · {s.ipAddress} · {new Date(s.createdAt).toLocaleString()}</p>
          ))}
          {tab === "mfa" && (
            <div className="space-y-2">
              <button type="button" className="btn-primary" onClick={async () => {
                const r = await api.post(`${base}/mfa/setup`, {});
                setMfaUri(r.data?.uri ?? "");
                toast("Scan QR in authenticator app", "success");
              }}>Setup MFA</button>
              {mfaUri && <p className="text-xs text-slate-500 break-all">{mfaUri}</p>}
              <input className="input w-32" placeholder="6-digit" value={token} onChange={(e) => setToken(e.target.value)} />
              <button type="button" className="btn-secondary" onClick={async () => {
                await api.post(`${base}/mfa/enable`, { token });
                toast("MFA enabled", "success");
              }}>Enable</button>
            </div>
          )}
          {tab === "activity" && activity && (
            <>
              <p className="text-slate-400">{activity.recent?.length ?? 0} recent audit events</p>
              {activity.byAction?.map((a: any) => <p key={a.action} className="text-sm text-slate-500">{a.action}: {a.count}</p>)}
            </>
          )}
          {tab === "compliance" && (
            <button type="button" className="btn-primary" onClick={async () => {
              const r = await api.get(`${base}/compliance-export`);
              const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "compliance-export.json";
              a.click();
            }}>Download compliance pack</button>
          )}
          {tab === "api-keys" && (
            <>
              <button type="button" className="btn-primary" onClick={async () => {
                const name = window.prompt("Key name");
                if (!name) return;
                const r = await api.post(`${base}/api-keys`, { name });
                alert(`Save this key now: ${r.data?.key}`);
                setApiKeys((await api.get(`${base}/api-keys`)).data ?? []);
              }}>Create API key</button>
              {apiKeys.map((k) => <p key={k.id} className="text-slate-300 text-sm">{k.name} · {k.keyPrefix}…</p>)}
            </>
          )}
          {tab === "ip" && (
            <>
              <textarea className="input min-h-[100px]" value={ipList} onChange={(e) => setIpList(e.target.value)} placeholder="One IP per line" />
              <button type="button" className="btn-primary" onClick={async () => {
                await api.put(`${base}/settings`, { ipAllowlist: ipList.split("\n").map((s) => s.trim()).filter(Boolean) });
                toast("IP allowlist saved", "success");
              }}>Save allowlist</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
