import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { ConfirmAction } from "../ConfirmAction";
import { RichTextField } from "../RichTextField";
import { htmlToPlainText } from "../../../lib/html-preview";
import { Loader2, Megaphone, Send, Pencil, Plus, Bell, Mail, MessageSquare } from "lucide-react";

type Tab = "announcements" | "notifications" | "sms" | "email" | "campaigns" | "templates" | "internal" | "whatsapp" | "logs";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  published: boolean;
  publishAt?: string | null;
};

type Template = { id: string; name: string; channel: string; subject?: string | null; body: string };
type Campaign = { id: string; name: string; channel: string; audience: string; status: string; templateId?: string | null };

const AUDIENCES = ["all", "parents", "staff", "students"] as const;

export const MessagingHub: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canSend = hasPermission("messaging.send");

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("announcements");
  const [dash, setDash] = useState<Record<string, number> | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annForm, setAnnForm] = useState({ title: "", body: "", audience: "all" as typeof AUDIENCES[number], publishAt: "" });
  const [notifyOnPublish, setNotifyOnPublish] = useState<string[]>([]);
  const [editAnnId, setEditAnnId] = useState<string | null>(null);
  const [editAnn, setEditAnn] = useState({ title: "", body: "", audience: "all" as typeof AUDIENCES[number] });

  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplForm, setTplForm] = useState({ name: "", channel: "sms", subject: "", body: "" });
  const [editTplId, setEditTplId] = useState<string | null>(null);
  const [showTplForm, setShowTplForm] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campForm, setCampForm] = useState({ name: "", channel: "sms" as "sms" | "email" | "whatsapp", templateId: "", audience: "parents", classId: "" });
  const [editCampId, setEditCampId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [internal, setInternal] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [internalForm, setInternalForm] = useState({ toUserId: "", body: "" });
  const [smsForm, setSmsForm] = useState({ body: "", audience: "parents", classId: "", to: "" });
  const [emailForm, setEmailForm] = useState({ subject: "", body: "", audience: "parents", classId: "", to: "" });
  const [waForm, setWaForm] = useState({ phone: "", message: "" });

  const loadDash = useCallback(async () => {
    try {
      const r = await api.get(`/s/${schoolSlug}/api/messaging/dashboard`);
      setDash(r.data);
    } catch {
      setDash(null);
    }
  }, [schoolSlug]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "announcements") {
        setAnnouncements((await api.get(`/s/${schoolSlug}/api/messaging/announcements`)).data ?? []);
      } else if (tab === "notifications") {
        setNotifications((await api.get(`/s/${schoolSlug}/api/messaging/notifications`)).data ?? []);
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
          api.get(`/s/${schoolSlug}/api/admin/users`).catch(() => ({ data: [] })),
        ]);
        setInternal(m.data ?? []);
        setStaffUsers(u.data ?? []);
      } else if (tab === "logs") {
        setLogs((await api.get(`/s/${schoolSlug}/api/messaging/delivery-logs`)).data ?? []);
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, tab, toast]);

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { loadTab(); }, [loadTab]);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/classes`).then((r) => setClasses(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  const annLabel = (a: Announcement) => {
    if (a.published) return { text: "Published", cls: "text-emerald-400" };
    if (a.publishAt && new Date(a.publishAt) > new Date()) {
      return { text: `Scheduled · ${new Date(a.publishAt).toLocaleString()}`, cls: "text-sky-400" };
    }
    return { text: "Draft", cls: "text-amber-400" };
  };

  const postAnnouncement = async (publish: boolean) => {
    if (!canSend) return;
    try {
      await api.post(`/s/${schoolSlug}/api/messaging/announcements`, {
        title: annForm.title,
        body: annForm.body,
        audience: annForm.audience,
        published: publish,
        notifyChannels: publish ? notifyOnPublish : [],
        publishAt: annForm.publishAt ? new Date(annForm.publishAt).toISOString() : undefined,
      });
      toast(publish ? "Published" : "Draft saved", "success");
      setAnnForm({ title: "", body: "", audience: "all", publishAt: "" });
      loadTab();
      loadDash();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const saveAnnEdit = async () => {
    if (!editAnnId || !canSend) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/messaging/announcements/${editAnnId}`, editAnn);
      toast("Updated", "success");
      setEditAnnId(null);
      loadTab();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const deleteAnn = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/messaging/announcements/${id}`);
      toast("Deleted", "success");
      loadTab();
      loadDash();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const body = { name: tplForm.name.trim(), channel: tplForm.channel, subject: tplForm.subject || undefined, body: tplForm.body };
    try {
      if (editTplId) {
        await api.patch(`/s/${schoolSlug}/api/messaging/templates/${editTplId}`, body);
        toast("Template updated", "success");
      } else {
        await api.post(`/s/${schoolSlug}/api/messaging/templates`, body);
        toast("Template saved", "success");
      }
      setEditTplId(null);
      setShowTplForm(false);
      setTplForm({ name: "", channel: "sms", subject: "", body: "" });
      loadTab();
      loadDash();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/messaging/templates/${id}`);
      toast("Template removed", "success");
      loadTab();
      loadDash();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const audienceFilter = campForm.audience === "parents_of_class" && campForm.classId ? { classId: campForm.classId } : {};
    const body = {
      name: campForm.name,
      channel: campForm.channel,
      templateId: campForm.templateId || undefined,
      audience: campForm.audience,
      audienceFilter,
    };
    try {
      if (editCampId) {
        await api.patch(`/s/${schoolSlug}/api/messaging/campaigns/${editCampId}`, body);
        toast("Campaign updated", "success");
        setEditCampId(null);
      } else {
        await api.post(`/s/${schoolSlug}/api/messaging/campaigns`, body);
        toast("Campaign created", "success");
      }
      setCampForm({ name: "", channel: "sms", templateId: "", audience: "parents", classId: "" });
      loadTab();
      loadDash();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/messaging/campaigns/${id}`);
      toast("Campaign removed", "success");
      loadTab();
      loadDash();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const tabBtn = (t: Tab, label: string, Icon?: React.ElementType) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`shrink-0 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 whitespace-nowrap ${
        tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-violet-400" />
            Messaging
          </h1>
          <p className="text-slate-400 mt-1">Announcements, SMS, email, campaigns, and delivery logs</p>
        </div>
      </div>

      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="card p-3"><span className="text-slate-500">Announcements</span><p className="text-xl font-bold text-white">{dash.published}/{dash.announcements}</p><p className="text-xs text-slate-500">published</p></div>
          <div className="card p-3"><span className="text-slate-500">Templates</span><p className="text-xl font-bold text-white">{dash.templates}</p></div>
          <div className="card p-3"><span className="text-slate-500">Campaigns</span><p className="text-xl font-bold text-white">{dash.draftCampaigns} draft</p></div>
          <div className="card p-3"><span className="text-slate-500">Deliveries (7d)</span><p className="text-xl font-bold text-white">{dash.deliveryLogs7d}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabBtn("announcements", "Announcements", Megaphone)}
        {tabBtn("templates", "Templates")}
        {tabBtn("campaigns", "Campaigns", Send)}
        {tabBtn("sms", "SMS", MessageSquare)}
        {tabBtn("email", "Email", Mail)}
        {tabBtn("notifications", "In-app", Bell)}
        {tabBtn("internal", "Staff chat")}
        {tabBtn("whatsapp", "WhatsApp")}
        {tabBtn("logs", "Delivery logs")}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : (
        <>
          {tab === "announcements" && (
            <div className="grid lg:grid-cols-2 gap-6">
              {canSend && (
                <div className="card p-5 space-y-3">
                  <h3 className="font-semibold text-white">New announcement</h3>
                  <input className="input" placeholder="Title" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} />
                  <RichTextField placeholder="Announcement body…" value={annForm.body} onChange={(body) => setAnnForm({ ...annForm, body })} />
                  <select className="input" value={annForm.audience} onChange={(e) => setAnnForm({ ...annForm, audience: e.target.value as typeof annForm.audience })}>
                    {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {(["in_app", "sms", "email"] as const).map((ch) => (
                      <label key={ch} className="flex items-center gap-2 text-slate-300 capitalize">
                        <input type="checkbox" checked={notifyOnPublish.includes(ch)} onChange={(e) => setNotifyOnPublish(e.target.checked ? [...notifyOnPublish, ch] : notifyOnPublish.filter((x) => x !== ch))} />
                        {ch.replace("_", " ")}
                      </label>
                    ))}
                  </div>
                  <input className="input" type="datetime-local" value={annForm.publishAt} onChange={(e) => setAnnForm({ ...annForm, publishAt: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost" onClick={() => postAnnouncement(false)}>Save draft</button>
                    <button type="button" className="btn-primary" onClick={() => postAnnouncement(true)}>Publish now</button>
                  </div>
                </div>
              )}
              <div className="card overflow-hidden lg:col-span-1">
                <table className="table text-sm">
                  <thead><tr><th>Title</th><th>Status</th>{canSend && <th></th>}</tr></thead>
                  <tbody>
                    {announcements.length === 0 ? (
                      <tr><td colSpan={canSend ? 3 : 2} className="text-center py-8 text-slate-400">No announcements yet.</td></tr>
                    ) : announcements.map((a) => {
                      const label = annLabel(a);
                      return (
                        <tr key={a.id}>
                          <td>
                            {editAnnId === a.id ? (
                              <div className="space-y-2 py-1">
                                <input className="input text-sm" value={editAnn.title} onChange={(e) => setEditAnn({ ...editAnn, title: e.target.value })} />
                                <RichTextField compact value={editAnn.body} onChange={(body) => setEditAnn({ ...editAnn, body })} placeholder="Body…" />
                                <select className="input text-sm" value={editAnn.audience} onChange={(e) => setEditAnn({ ...editAnn, audience: e.target.value as typeof editAnn.audience })}>
                                  {AUDIENCES.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>
                                <div className="flex gap-2">
                                  <button type="button" className="btn-primary text-xs" onClick={saveAnnEdit}>Save</button>
                                  <button type="button" className="btn-ghost text-xs" onClick={() => setEditAnnId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="font-medium text-white">{a.title}</p>
                                <p className="text-slate-500 text-xs mt-0.5">{htmlToPlainText(a.body, 100)}</p>
                              </>
                            )}
                          </td>
                          <td className={`text-xs whitespace-nowrap ${label.cls}`}>{label.text}<br /><span className="text-slate-500">{a.audience}</span></td>
                          {canSend && editAnnId !== a.id && (
                            <td className="space-x-1 whitespace-nowrap">
                              {!a.published && (
                                <button type="button" className="btn-ghost text-xs" onClick={async () => {
                                  await api.patch(`/s/${schoolSlug}/api/messaging/announcements/${a.id}`, { published: true });
                                  toast("Published", "success");
                                  loadTab();
                                }}>Publish</button>
                              )}
                              <button type="button" className="btn-ghost text-xs" onClick={async () => {
                                const res = await api.post(`/s/${schoolSlug}/api/messaging/announcements/${a.id}/broadcast`, { channels: ["sms", "email", "in_app"] });
                                toast(`Sent ${res.data?.sent ?? 0}`, "success");
                              }}>Broadcast</button>
                              <button type="button" className="btn-ghost text-xs" onClick={() => { setEditAnnId(a.id); setEditAnn({ title: a.title, body: a.body, audience: a.audience as typeof editAnn.audience }); }}>
                                <Pencil className="w-3 h-3 inline" />
                              </button>
                              <ConfirmAction label="Delete" confirmMessage={`Delete “${a.title}”?`} onConfirm={() => deleteAnn(a.id)} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "templates" && (
            <div className="space-y-4">
              {canSend && (
                <button type="button" className="btn-primary" onClick={() => { setEditTplId(null); setTplForm({ name: "", channel: "sms", subject: "", body: "" }); setShowTplForm(!showTplForm); }}>
                  <Plus className="w-4 h-4" /> {showTplForm ? "Close" : "Add template"}
                </button>
              )}
              {showTplForm && canSend && (
                <form onSubmit={saveTemplate} className="card p-5 grid md:grid-cols-2 gap-4">
                  <input className="input" placeholder="Name" required value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
                  <select className="input" value={tplForm.channel} onChange={(e) => setTplForm({ ...tplForm, channel: e.target.value })}>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <input className="input md:col-span-2" placeholder="Email subject" value={tplForm.subject} onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })} />
                  <div className="md:col-span-2">
                    <RichTextField placeholder="Template body…" value={tplForm.body} onChange={(body) => setTplForm({ ...tplForm, body })} />
                  </div>
                  <button type="submit" className="btn-primary md:col-span-2 max-w-xs">{editTplId ? "Update template" : "Save template"}</button>
                </form>
              )}
              <div className="card overflow-hidden">
                <table className="table text-sm">
                  <thead><tr><th>Name</th><th>Channel</th><th>Preview</th>{canSend && <th></th>}</tr></thead>
                  <tbody>
                    {templates.length === 0 ? (
                      <tr><td colSpan={canSend ? 4 : 3} className="text-center py-8 text-slate-400">No templates.</td></tr>
                    ) : templates.map((t) => (
                      <tr key={t.id}>
                        <td className="font-medium text-white">{t.name}</td>
                        <td>{t.channel}</td>
                        <td className="text-slate-500 max-w-xs truncate">{htmlToPlainText(t.body, 80)}</td>
                        {canSend && (
                          <td className="space-x-1 whitespace-nowrap">
                            <button type="button" className="btn-ghost text-xs" onClick={() => {
                              setEditTplId(t.id);
                              setTplForm({ name: t.name, channel: t.channel, subject: t.subject ?? "", body: t.body });
                              setShowTplForm(true);
                            }}>Edit</button>
                            <ConfirmAction label="Delete" confirmMessage={`Delete template “${t.name}”?`} onConfirm={() => deleteTemplate(t.id)} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "campaigns" && (
            <div className="space-y-4">
              {canSend && (
                <form onSubmit={saveCampaign} className="card p-5 grid md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                  <div><label className="label">Name</label><input className="input" required value={campForm.name} onChange={(e) => setCampForm({ ...campForm, name: e.target.value })} /></div>
                  <div>
                    <label className="label">Channel</label>
                    <select className="input" value={campForm.channel} onChange={(e) => setCampForm({ ...campForm, channel: e.target.value as typeof campForm.channel })}>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Template</label>
                    <select className="input" value={campForm.templateId} onChange={(e) => setCampForm({ ...campForm, templateId: e.target.value })}>
                      <option value="">None</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Audience</label>
                    <select className="input" value={campForm.audience} onChange={(e) => setCampForm({ ...campForm, audience: e.target.value, classId: "" })}>
                      <option value="parents">All parents</option>
                      <option value="parents_of_class">Parents of class</option>
                      <option value="staff">Staff</option>
                      <option value="students">Students</option>
                    </select>
                  </div>
                  {campForm.audience === "parents_of_class" && (
                    <div>
                      <label className="label">Class</label>
                      <select className="input" required value={campForm.classId} onChange={(e) => setCampForm({ ...campForm, classId: e.target.value })}>
                        <option value="">Select…</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn-primary">{editCampId ? "Update" : "Create"}</button>
                </form>
              )}
              <div className="card overflow-hidden">
                <table className="table text-sm">
                  <thead><tr><th>Name</th><th>Channel</th><th>Audience</th><th>Status</th>{canSend && <th></th>}</tr></thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr><td colSpan={canSend ? 5 : 4} className="text-center py-8 text-slate-400">No campaigns.</td></tr>
                    ) : campaigns.map((c) => (
                      <tr key={c.id}>
                        <td className="text-white">{c.name}</td>
                        <td>{c.channel}</td>
                        <td>{c.audience}</td>
                        <td className="capitalize">{c.status}</td>
                        {canSend && (
                          <td className="space-x-1 whitespace-nowrap">
                            {c.status === "draft" && (
                              <button type="button" className="btn-ghost text-xs text-primary-400" onClick={async () => {
                                await api.post(`/s/${schoolSlug}/api/messaging/campaigns/${c.id}/send`);
                                toast("Queued", "success");
                                loadTab();
                              }}><Send className="w-3 h-3 inline" /> Send</button>
                            )}
                            {c.status === "draft" && (
                              <button type="button" className="btn-ghost text-xs" onClick={() => {
                                setEditCampId(c.id);
                                setCampForm({ name: c.name, channel: c.channel as typeof campForm.channel, templateId: c.templateId ?? "", audience: c.audience, classId: "" });
                              }}>Edit</button>
                            )}
                            {c.status !== "sent" && (
                              <ConfirmAction label="Delete" confirmMessage={`Delete campaign “${c.name}”?`} onConfirm={() => deleteCampaign(c.id)} />
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "sms" && canSend && (
            <form className="card p-5 space-y-3 max-w-xl" onSubmit={async (e) => {
              e.preventDefault();
              const res = await api.post(`/s/${schoolSlug}/api/messaging/sms/send`, {
                body: htmlToPlainText(smsForm.body),
                audience: smsForm.to ? undefined : smsForm.audience,
                classId: smsForm.classId || undefined,
                to: smsForm.to || undefined,
              });
              toast(`SMS sent: ${res.data?.sent ?? 0}`, "success");
            }}>
              <h3 className="font-semibold text-white">Send SMS</h3>
              <input className="input" placeholder="Single phone (optional)" value={smsForm.to} onChange={(e) => setSmsForm({ ...smsForm, to: e.target.value })} />
              <select className="input" value={smsForm.audience} onChange={(e) => setSmsForm({ ...smsForm, audience: e.target.value })}>
                <option value="parents">All parents</option>
                <option value="parents_of_class">Parents of class</option>
                <option value="staff">Staff</option>
                <option value="students">Students</option>
              </select>
              {smsForm.audience === "parents_of_class" && (
                <select className="input" value={smsForm.classId} onChange={(e) => setSmsForm({ ...smsForm, classId: e.target.value })}>
                  <option value="">Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <RichTextField compact placeholder="SMS message…" value={smsForm.body} onChange={(body) => setSmsForm({ ...smsForm, body })} />
              <button type="submit" className="btn-primary">Send SMS</button>
            </form>
          )}

          {tab === "email" && canSend && (
            <form className="card p-5 space-y-3 max-w-xl" onSubmit={async (e) => {
              e.preventDefault();
              const res = await api.post(`/s/${schoolSlug}/api/messaging/email/send`, {
                subject: emailForm.subject,
                body: emailForm.body,
                audience: emailForm.to ? undefined : emailForm.audience,
                classId: emailForm.classId || undefined,
                to: emailForm.to || undefined,
              });
              toast(`Emails sent: ${res.data?.sent ?? 0}`, "success");
            }}>
              <h3 className="font-semibold text-white">Send email</h3>
              <p className="text-xs text-slate-500">Uses school SMTP from Settings when enabled.</p>
              <input className="input" type="email" placeholder="Single email (optional)" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} />
              <input className="input" placeholder="Subject" required value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
              <select className="input" value={emailForm.audience} onChange={(e) => setEmailForm({ ...emailForm, audience: e.target.value })}>
                <option value="parents">All parents</option>
                <option value="parents_of_class">Parents of class</option>
                <option value="staff">Staff</option>
                <option value="students">Students</option>
              </select>
              {emailForm.audience === "parents_of_class" && (
                <select className="input" value={emailForm.classId} onChange={(e) => setEmailForm({ ...emailForm, classId: e.target.value })}>
                  <option value="">Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <RichTextField placeholder="Email message…" value={emailForm.body} onChange={(body) => setEmailForm({ ...emailForm, body })} />
              <button type="submit" className="btn-primary">Send email</button>
            </form>
          )}

          {tab === "notifications" && (
            <div className="card p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-white">In-app notifications</h3>
                <button type="button" className="btn-ghost text-xs" onClick={async () => {
                  await api.patch(`/s/${schoolSlug}/api/messaging/notifications/read-all`, {});
                  loadTab();
                }}>Mark all read</button>
              </div>
              <ul className="space-y-2 text-sm">
                {notifications.map((n: { id: string; title: string; body: string; readAt?: string | null }) => (
                  <li key={n.id} className={`p-3 rounded-lg border ${n.readAt ? "border-slate-800 text-slate-500" : "border-primary-800/50"}`}>
                    <strong>{n.title}</strong>
                    <div className="text-slate-400 messaging-body-html" dangerouslySetInnerHTML={{ __html: n.body }} />
                    {!n.readAt && (
                      <button type="button" className="btn-ghost text-xs mt-2" onClick={async () => {
                        await api.patch(`/s/${schoolSlug}/api/messaging/notifications/${n.id}/read`, {});
                        loadTab();
                      }}>Mark read</button>
                    )}
                  </li>
                ))}
                {!notifications.length && <p className="text-slate-500">No notifications.</p>}
              </ul>
            </div>
          )}

          {tab === "internal" && canSend && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form className="card p-5 space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                await api.post(`/s/${schoolSlug}/api/messaging/internal`, internalForm);
                toast("Sent", "success");
                setInternalForm({ toUserId: "", body: "" });
                loadTab();
              }}>
                <h3 className="font-semibold text-white">Staff message</h3>
                <select className="input" value={internalForm.toUserId} onChange={(e) => setInternalForm({ ...internalForm, toUserId: e.target.value })}>
                  <option value="">Broadcast (all staff)</option>
                  {staffUsers.map((u: { id: string; firstName: string; lastName: string }) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
                <RichTextField compact placeholder="Message to staff…" value={internalForm.body} onChange={(body) => setInternalForm({ ...internalForm, body })} />
                <button type="submit" className="btn-primary">Send</button>
              </form>
              <div className="card p-5 text-sm text-slate-300 max-h-96 overflow-y-auto space-y-2">
                {internal.map((m: { id: string; body: string; createdAt: string }) => (
                  <div key={m.id} className="border-b border-slate-800 pb-2">
                    <div className="messaging-body-html text-slate-200" dangerouslySetInnerHTML={{ __html: m.body }} />
                    <span className="block text-xs text-slate-500 mt-1">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "whatsapp" && canSend && (
            <form className="card p-5 space-y-3 max-w-md" onSubmit={async (e) => {
              e.preventDefault();
              const res = await api.post(`/s/${schoolSlug}/api/messaging/whatsapp/test`, {
                phone: waForm.phone,
                message: htmlToPlainText(waForm.message),
              });
              toast(res.success ? "WhatsApp test sent" : res.message ?? "Failed", res.success ? "success" : "error");
            }}>
              <h3 className="font-semibold text-white">WhatsApp test</h3>
              <input className="input" placeholder="Phone +256…" required value={waForm.phone} onChange={(e) => setWaForm({ ...waForm, phone: e.target.value })} />
              <RichTextField compact placeholder="WhatsApp message…" value={waForm.message} onChange={(message) => setWaForm({ ...waForm, message })} />
              <button type="submit" className="btn-primary">Send test</button>
            </form>
          )}

          {tab === "logs" && (
            <div className="card overflow-hidden">
              <table className="table text-sm">
                <thead><tr><th>Recipient</th><th>Channel</th><th>Status</th><th>When</th></tr></thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">No delivery logs yet.</td></tr>
                  ) : logs.map((l: { id: string; recipient: string; channel: string; status: string; createdAt: string }) => (
                    <tr key={l.id}>
                      <td>{l.recipient}</td>
                      <td>{l.channel}</td>
                      <td>{l.status}</td>
                      <td className="text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!canSend && ["sms", "email", "internal", "whatsapp", "announcements", "templates", "campaigns"].includes(tab) && (
            <p className="text-slate-400 text-sm">You need <code className="text-slate-300">messaging.send</code> permission to create or send messages.</p>
          )}
        </>
      )}
    </div>
  );
};
