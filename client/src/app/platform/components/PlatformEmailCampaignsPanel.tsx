import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Send, Megaphone } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  audience: "operators" | "custom";
  recipientEmails: string[];
  status: string;
  stats: { sent?: number; failed?: number; total?: number };
  sentAt: string | null;
};

export const PlatformEmailCampaignsPanel: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    bodyHtml: "<p>Hello from SchoolOS platform.</p>",
    audience: "operators" as "operators" | "custom",
    recipientEmails: "",
  });

  const load = useCallback(async () => {
    const r = await api.get("/api/platform/settings/email/campaigns");
    setCampaigns(r.data as Campaign[]);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [load, toast]);

  const createCampaign = async () => {
    setCreating(true);
    try {
      const emails =
        form.audience === "custom"
          ? form.recipientEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)
          : [];
      await api.post("/api/platform/settings/email/campaigns", {
        name: form.name,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        audience: form.audience,
        recipientEmails: emails,
      });
      toast("Campaign created", "success");
      setForm({ name: "", subject: "", bodyHtml: "<p>Hello from SchoolOS platform.</p>", audience: "operators", recipientEmails: "" });
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const sendCampaign = async (id: string) => {
    if (!window.confirm("Send this campaign now to all recipients?")) return;
    setSendingId(id);
    try {
      await api.post(`/api/platform/settings/email/campaigns/${id}/send`);
      toast("Campaign queued — refresh in a moment", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading campaigns…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${CARD} p-5 space-y-3`}>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Megaphone size={16} /> New platform campaign
        </h3>
        <p className="text-xs text-slate-500">
          Bulk email to all platform operators or a custom list. Uses platform SMTP from the SMTP tab.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input text-sm"
            placeholder="Campaign name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input text-sm"
            placeholder="Email subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </div>
        <select
          className="input text-sm w-full max-w-xs"
          value={form.audience}
          onChange={(e) => setForm({ ...form, audience: e.target.value as "operators" | "custom" })}
        >
          <option value="operators">All platform operators</option>
          <option value="custom">Custom email list</option>
        </select>
        {form.audience === "custom" && (
          <textarea
            className="input text-sm w-full min-h-[60px]"
            placeholder="emails separated by comma or newline"
            value={form.recipientEmails}
            onChange={(e) => setForm({ ...form, recipientEmails: e.target.value })}
          />
        )}
        <textarea
          className="input text-sm w-full min-h-[100px] font-mono"
          value={form.bodyHtml}
          onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
        />
        <button
          type="button"
          className="btn-primary text-sm inline-flex items-center gap-1"
          disabled={creating || !form.name || !form.subject}
          onClick={createCampaign}
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create draft
        </button>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Audience</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Stats</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No campaigns yet
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 capitalize">{c.audience}</td>
                  <td className="px-4 py-3 capitalize">{c.status}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.stats?.sent != null ? `${c.stats.sent}/${c.stats.total ?? "?"}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status !== "sent" && c.status !== "sending" && (
                      <button
                        type="button"
                        className="text-blue-600 text-xs font-medium inline-flex items-center gap-1"
                        disabled={sendingId === c.id}
                        onClick={() => sendCampaign(c.id)}
                      >
                        {sendingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Send now
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
