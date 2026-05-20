import React, { useEffect, useState } from "react";
import { Key, Loader2, Plus, Trash2, Webhook } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm p-5";

export const PlatformApiSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState("tenant.created,payment.received");

  const load = () =>
    api
      .get("/api/platform/settings/api")
      .then((r) => {
        setApiKeys(r.data.apiKeys ?? []);
        setWebhooks(r.data.webhooks ?? []);
        setEvents(r.data.availableEvents ?? []);
      })
      .catch((e) => toast(e.message, "error"));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [toast]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const r = await api.post("/api/platform/settings/api/keys", { name: newKeyName.trim() });
      setPlainKey(r.data.plainKey);
      setNewKeyName("");
      await load();
      toast("API key created — copy it now", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const saveWebhook = async () => {
    try {
      await api.post("/api/platform/settings/api/webhooks", {
        url: hookUrl,
        events: hookEvents.split(",").map((s) => s.trim()).filter(Boolean),
        enabled: true,
      });
      setHookUrl("");
      await load();
      toast("Webhook saved", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Key size={22} className="text-blue-600" /> API & webhooks
        </h1>
        <p className="text-sm text-slate-500 mt-1">REST API keys for integrations and outbound event webhooks.</p>
      </div>

      {plainKey && (
        <div className={`${CARD} border-amber-200 bg-amber-50`}>
          <p className="text-sm font-semibold text-amber-900">Copy your new API key (shown once)</p>
          <code className="block mt-2 text-xs break-all bg-white p-2 rounded border">{plainKey}</code>
        </div>
      )}

      <div className={CARD}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Key size={16} /> API keys
        </h2>
        <div className="flex gap-2 mt-3">
          <input
            className="input text-sm flex-1"
            placeholder="Key name e.g. Zapier production"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button type="button" className="btn-primary text-sm inline-flex items-center gap-1" onClick={createKey}>
            <Plus size={14} /> Create
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {apiKeys.map((k) => (
            <li key={k.id} className="flex items-center justify-between text-sm border-b border-slate-100 py-2">
              <span>
                <strong>{k.name}</strong> <span className="font-mono text-slate-500">{k.prefix}…</span>
              </span>
              <button
                type="button"
                className="text-rose-600"
                onClick={async () => {
                  await api.delete(`/api/platform/settings/api/keys/${k.id}`);
                  await load();
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={CARD}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Webhook size={16} /> Outbound webhooks
        </h2>
        <p className="text-xs text-slate-500 mt-1">Events: {events.join(", ")}</p>
        <input
          className="input text-sm mt-3 w-full"
          placeholder="https://hooks.example.com/schoolos"
          value={hookUrl}
          onChange={(e) => setHookUrl(e.target.value)}
        />
        <input
          className="input text-sm mt-2 w-full font-mono"
          value={hookEvents}
          onChange={(e) => setHookEvents(e.target.value)}
        />
        <button type="button" className="btn-primary text-sm mt-3" onClick={saveWebhook}>
          Save webhook
        </button>
        <ul className="mt-4 space-y-2 text-sm">
          {webhooks.map((h) => (
            <li key={h.id} className="border-b border-slate-100 py-2">
              <p className="font-mono text-xs truncate">{h.url}</p>
              <p className="text-slate-500 text-xs">{h.events?.join(", ")}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
