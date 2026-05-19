import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, Megaphone, Send } from "lucide-react";

export const Messaging: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"announcements" | "campaigns" | "logs">("announcements");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    audience: "parents",
    classId: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "announcements") {
        setAnnouncements((await api.get(`/s/${schoolSlug}/api/messaging/announcements`)).data ?? []);
      } else if (tab === "campaigns") {
        setCampaigns((await api.get(`/s/${schoolSlug}/api/messaging/campaigns`)).data ?? []);
      } else {
        setLogs((await api.get(`/s/${schoolSlug}/api/messaging/delivery-logs`)).data ?? []);
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug, tab]);

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/academics/classes`).then((res) => setClasses(res.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  const postAnnouncement = async () => {
    try {
      await api.post(`/s/${schoolSlug}/api/messaging/announcements`, { title, body, audience: "all" });
      toast("Announcement created", "success");
      setTitle(""); setBody("");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const audienceFilter = campaignForm.audience === "parents_of_class" && campaignForm.classId
        ? { classId: campaignForm.classId }
        : {};
      await api.post(`/s/${schoolSlug}/api/messaging/campaigns`, {
        name: campaignForm.name,
        audience: campaignForm.audience,
        audienceFilter,
      });
      toast("Campaign created", "success");
      setCampaignForm({ name: "", audience: "parents", classId: "" });
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const sendCampaign = async (id: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/messaging/campaigns/${id}/send`);
      toast("Campaign queued", "success");
      setTimeout(load, 1500);
    } catch (err: any) { toast(err.message, "error"); }
  };

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Messaging</h1>
          <p className="text-slate-400 mt-1">Announcements, campaigns, and delivery logs</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("announcements")} className={tabBtn("announcements")}>announcements</button>
        <button type="button" onClick={() => setTab("campaigns")} className={tabBtn("campaigns")}>campaigns</button>
        <button type="button" onClick={() => setTab("logs")} className={tabBtn("logs")}>delivery logs</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : (
        <>
          {tab === "announcements" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2"><Megaphone className="w-4 h-4" /> New announcement</h3>
                <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea className="input min-h-[100px]" placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
                <button type="button" className="btn-primary" onClick={postAnnouncement}>Publish</button>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">Recent</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  {announcements.map((a) => (
                    <li key={a.id} className="border-b border-slate-800 pb-2">
                      <strong>{a.title}</strong> — {a.body.slice(0, 80)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === "campaigns" && (
            <div className="space-y-4">
              <form onSubmit={createCampaign} className="card p-5 grid md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="label">Campaign name</label>
                  <input className="input" required value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Audience</label>
                  <select className="input" value={campaignForm.audience} onChange={(e) => setCampaignForm({ ...campaignForm, audience: e.target.value, classId: "" })}>
                    <option value="parents">All parents</option>
                    <option value="parents_of_class">Parents of class</option>
                    <option value="staff">Staff users</option>
                  </select>
                </div>
                {campaignForm.audience === "parents_of_class" && (
                  <div>
                    <label className="label">Class</label>
                    <select className="input" required value={campaignForm.classId} onChange={(e) => setCampaignForm({ ...campaignForm, classId: e.target.value })}>
                      <option value="">Select class…</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <button type="submit" className="btn-primary">Create campaign</button>
              </form>
              <div className="card p-5">
                {campaigns.length === 0 ? (
                  <p className="text-slate-500 text-sm">No campaigns yet.</p>
                ) : campaigns.map((c) => (
                  <div key={c.id} className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-slate-200">
                      {c.name}{" "}
                      <span className="text-xs text-slate-500">({c.audience} · {c.status})</span>
                    </span>
                    {c.status === "draft" && (
                      <button type="button" className="btn-ghost text-primary-400" onClick={() => sendCampaign(c.id)}>
                        <Send className="w-4 h-4" /> Queue send
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "logs" && (
            <div className="card p-5 overflow-x-auto">
              <table className="w-full text-sm text-slate-300">
                <thead><tr className="text-left text-slate-500"><th>Recipient</th><th>Channel</th><th>Status</th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}><td>{l.recipient}</td><td>{l.channel}</td><td>{l.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
