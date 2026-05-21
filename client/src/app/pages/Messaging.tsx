import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, Megaphone, Send } from "lucide-react";

export const Messaging: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"announcements" | "campaigns" | "templates" | "internal" | "whatsapp" | "logs">("announcements");
  const [internal, setInternal] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [internalForm, setInternalForm] = useState({ toUserId: "", body: "" });
  const [waForm, setWaForm] = useState({ phone: "", message: "" });
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplForm, setTplForm] = useState({ name: "", channel: "sms", subject: "", body: "" });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState<"all" | "parents" | "staff">("all");
  const [publishAt, setPublishAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", audience: "all" as "all" | "parents" | "staff" });
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "sms" as "sms" | "email" | "whatsapp",
    templateId: "",
    audience: "parents",
    classId: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "announcements") {
        setAnnouncements((await api.get(`/s/${schoolSlug}/api/messaging/announcements`)).data ?? []);
      } else if (tab === "campaigns") {
        const [c, t] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/messaging/campaigns`),
          api.get(`/s/${schoolSlug}/api/messaging/templates`),
        ]);
        setCampaigns(c.data ?? []);
        setTemplates(t.data ?? []);
      } else if (tab === "templates") {
        setTemplates((await api.get(`/s/${schoolSlug}/api/messaging/templates`)).data ?? []);
      } else if (tab === "internal") {
        const [m, u] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/messaging/internal`),
          api.get(`/s/${schoolSlug}/api/admin/users`),
        ]);
        setInternal(m.data ?? []);
        setStaffUsers(u.data ?? []);
      } else if (tab === "whatsapp") {
        /* settings-driven test */
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

  const postAnnouncement = async (publish: boolean) => {
    try {
      await api.post(`/s/${schoolSlug}/api/messaging/announcements`, {
        title, body, audience: announcementAudience, published: publish,
      });
      toast(publish ? "Announcement published" : "Draft saved", "success");
      setTitle(""); setBody(""); setPublishAt("");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const scheduleAnnouncement = async () => {
    if (!publishAt) return toast("Pick a publish date and time", "error");
    try {
      await api.post(`/s/${schoolSlug}/api/messaging/announcements`, {
        title, body, audience: announcementAudience,
        publishAt: new Date(publishAt).toISOString(),
      });
      toast("Announcement scheduled", "success");
      setTitle(""); setBody(""); setPublishAt("");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const announcementLabel = (a: { published: boolean; publishAt?: string | null }) => {
    if (a.published) return { text: "published", cls: "text-emerald-400" };
    if (a.publishAt && new Date(a.publishAt) > new Date()) {
      return { text: `scheduled · ${new Date(a.publishAt).toLocaleString()}`, cls: "text-sky-400" };
    }
    return { text: "draft", cls: "text-amber-400" };
  };

  const publishAnnouncement = async (id: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/messaging/announcements/${id}`, { published: true });
      toast("Published to portal", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const startEdit = (a: { id: string; title: string; body: string; audience: string }) => {
    setEditingId(a.id);
    setEditForm({ title: a.title, body: a.body, audience: a.audience as "all" | "parents" | "staff" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/messaging/announcements/${editingId}`, editForm);
      toast("Announcement updated", "success");
      setEditingId(null);
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/messaging/announcements/${id}`);
      toast("Announcement deleted", "success");
      if (editingId === id) setEditingId(null);
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
        channel: campaignForm.channel,
        templateId: campaignForm.templateId || undefined,
        audience: campaignForm.audience,
        audienceFilter,
      });
      toast("Campaign created", "success");
      setCampaignForm({ name: "", channel: "sms", templateId: "", audience: "parents", classId: "" });
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
        <button type="button" onClick={() => setTab("templates")} className={tabBtn("templates")}>templates</button>
        <button type="button" onClick={() => setTab("internal")} className={tabBtn("internal")}>staff chat</button>
        <button type="button" onClick={() => setTab("whatsapp")} className={tabBtn("whatsapp")}>WhatsApp</button>
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
                <div>
                  <label className="label">Audience</label>
                  <select className="input" value={announcementAudience} onChange={(e) => setAnnouncementAudience(e.target.value as "all" | "parents" | "staff")}>
                    <option value="all">Everyone (portal)</option>
                    <option value="parents">Parents</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="label">Schedule publish (optional)</label>
                  <input className="input" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost flex-1 min-w-[100px]" onClick={() => postAnnouncement(false)}>Save draft</button>
                  <button type="button" className="btn-ghost flex-1 min-w-[100px]" onClick={scheduleAnnouncement}>Schedule</button>
                  <button type="button" className="btn-primary flex-1 min-w-[100px]" onClick={() => postAnnouncement(true)}>Publish now</button>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">Recent</h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  {announcements.map((a) => {
                    const label = announcementLabel(a);
                    return (
                    <li key={a.id} className="border-b border-slate-800 pb-2">
                      <div className="flex justify-between gap-2">
                        <strong>{a.title}</strong>
                        <span className={`text-xs ${label.cls}`}>
                          {label.text} · {a.audience}
                        </span>
                      </div>
                      {editingId === a.id ? (
                        <div className="mt-2 space-y-2">
                          <input className="input text-sm" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                          <textarea className="input text-sm min-h-[60px]" value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} />
                          <select className="input text-sm" value={editForm.audience} onChange={(e) => setEditForm({ ...editForm, audience: e.target.value as "all" | "parents" | "staff" })}>
                            <option value="all">Everyone</option>
                            <option value="parents">Parents</option>
                            <option value="staff">Staff</option>
                          </select>
                          <div className="flex gap-2">
                            <button type="button" className="btn-primary text-xs" onClick={saveEdit}>Save</button>
                            <button type="button" className="btn-ghost text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 mt-1">{a.body.slice(0, 80)}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {!a.published && editingId !== a.id && (
                          <button type="button" className="btn-ghost text-xs text-primary-400" onClick={() => publishAnnouncement(a.id)}>
                            Publish to portal
                          </button>
                        )}
                        {editingId !== a.id && (
                          <>
                            <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(a)}>Edit</button>
                            <button type="button" className="btn-ghost text-xs text-red-400" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
                          </>
                        )}
                      </div>
                    </li>
                  );})}
                </ul>
              </div>
            </div>
          )}
          {tab === "campaigns" && (
            <div className="space-y-4">
              <form onSubmit={createCampaign} className="card p-5 grid md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="label">Campaign name</label>
                  <input className="input" required value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Channel</label>
                  <select className="input" value={campaignForm.channel} onChange={(e) => setCampaignForm({ ...campaignForm, channel: e.target.value as "sms" | "email" | "whatsapp" })}>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="label">Template</label>
                  <select className="input" value={campaignForm.templateId} onChange={(e) => setCampaignForm({ ...campaignForm, templateId: e.target.value })}>
                    <option value="">None</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
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
                      <span className="text-xs text-slate-500">({c.channel ?? "sms"} · {c.audience} · {c.status})</span>
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
          {tab === "templates" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form
                className="card p-5 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.post(`/s/${schoolSlug}/api/messaging/templates`, tplForm);
                    toast("Template saved", "success");
                    setTplForm({ name: "", channel: "sms", subject: "", body: "" });
                    load();
                  } catch (err: any) { toast(err.message, "error"); }
                }}
              >
                <h3 className="font-semibold text-white">New template</h3>
                <input className="input" placeholder="Name" required value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
                <select className="input" value={tplForm.channel} onChange={(e) => setTplForm({ ...tplForm, channel: e.target.value })}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                <input className="input" placeholder="Email subject" value={tplForm.subject} onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })} />
                <textarea className="input min-h-[100px]" placeholder="Body" required value={tplForm.body} onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })} />
                <button type="submit" className="btn-primary">Save template</button>
              </form>
              <div className="card p-5">
                <ul className="text-sm text-slate-300 space-y-2">
                  {templates.map((t) => (
                    <li key={t.id}><strong>{t.name}</strong> · {t.channel}<p className="text-slate-500">{t.body.slice(0, 80)}</p></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === "internal" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form className="card p-5 space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                await api.post(`/s/${schoolSlug}/api/messaging/internal`, { toUserId: internalForm.toUserId || undefined, body: internalForm.body });
                toast("Sent", "success");
                setInternalForm({ toUserId: "", body: "" });
                load();
              }}>
                <h3 className="font-semibold text-white">Staff message</h3>
                <select className="input" value={internalForm.toUserId} onChange={(e) => setInternalForm({ ...internalForm, toUserId: e.target.value })}>
                  <option value="">Broadcast (all staff)</option>
                  {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
                <textarea className="input min-h-[80px]" required value={internalForm.body} onChange={(e) => setInternalForm({ ...internalForm, body: e.target.value })} />
                <button type="submit" className="btn-primary">Send</button>
              </form>
              <div className="card p-5 text-sm text-slate-300 max-h-80 overflow-y-auto">
                {internal.map((m) => <p key={m.id} className="mb-2">{m.body}</p>)}
              </div>
            </div>
          )}
          {tab === "whatsapp" && (
            <form className="card p-5 space-y-3 max-w-md" onSubmit={async (e) => {
              e.preventDefault();
              const res = await api.post(`/s/${schoolSlug}/api/messaging/whatsapp/test`, waForm);
              toast(res.success ? "WhatsApp test sent" : res.message ?? "Failed", res.success ? "success" : "error");
            }}>
              <h3 className="font-semibold text-white">WhatsApp test</h3>
              <p className="text-xs text-slate-500">Requires platform WhatsApp Business integration enabled.</p>
              <input className="input" placeholder="Phone +256…" required value={waForm.phone} onChange={(e) => setWaForm({ ...waForm, phone: e.target.value })} />
              <textarea className="input" required value={waForm.message} onChange={(e) => setWaForm({ ...waForm, message: e.target.value })} />
              <button type="submit" className="btn-primary">Send test</button>
            </form>
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
