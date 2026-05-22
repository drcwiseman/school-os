import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { ConfirmAction } from "../ConfirmAction";
import { RichTextField } from "../RichTextField";
import { htmlToPlainText } from "../../../lib/html-preview";
import { useAuth } from "../../state/AuthContext";
import { applyTenantAppearance } from "../../utils/theme";
import { COUNTRY_OPTIONS } from "../../../lib/currencies";
import { Loader2, Plus, Pencil, GraduationCap, Building2, Search } from "lucide-react";
import { DemoDataPanel } from "./DemoDataPanel";

type OverviewProps = { schoolSlug: string; onNavigate?: (tab: string) => void };

export const AdminOverviewPanel: React.FC<OverviewProps> = ({ schoolSlug, onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/admin/overview`).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) return <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />;
  if (!data) return <p className="text-slate-500">Could not load overview.</p>;

  const cards = [
    { label: "Staff users", value: data.users, tab: "access" },
    { label: "Roles", value: data.roles, tab: "access" },
    { label: "Classes", value: data.classes, tab: "classes" },
    { label: "Setup complete", value: `${data.setupPercent}%`, tab: "wizard", highlight: data.setupPercent >= 100 },
    { label: "Live notices", value: data.publishedAnnouncements, tab: "noticeboard" },
    ...(data.multiCampusEnabled ? [{ label: "Branches", value: data.campuses, tab: "branches" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigate?.(c.tab)}
            className="card p-5 text-left hover:border-primary-600/50 transition-colors"
          >
            <p className="text-slate-500 text-sm">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.highlight ? "text-emerald-400" : "text-white"}`}>{c.value}</p>
          </button>
        ))}
      </div>
      <DemoDataPanel schoolSlug={schoolSlug} />
      <div className="card p-5">
        <h3 className="font-semibold text-white mb-2">Quick links</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to={`/s/${schoolSlug}/settings`} className="btn-ghost">School settings</Link>
          <button type="button" className="btn-ghost" onClick={() => onNavigate?.("utilities")}>Demo data</button>
          <button type="button" className="btn-ghost" onClick={() => onNavigate?.("access")}>Manage users</button>
          <button type="button" className="btn-ghost" onClick={() => onNavigate?.("classes")}>Classes & sections</button>
          <button type="button" className="btn-ghost" onClick={() => onNavigate?.("audit")}>Audit log</button>
        </div>
      </div>
    </div>
  );
};

export const NoticeboardAdminPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("messaging.send");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", audience: "all", published: true });

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/admin/noticeboard`).then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ title: "", body: "", audience: "all", published: true });
    setEditId(null);
    setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      if (editId) {
        await api.patch(`/s/${schoolSlug}/api/admin/noticeboard/${editId}`, form);
        toast("Notice updated", "success");
      } else {
        await api.post(`/s/${schoolSlug}/api/admin/noticeboard`, form);
        toast("Notice published", "success");
      }
      resetForm();
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const startEdit = (a: any) => {
    setEditId(a.id);
    setForm({ title: a.title, body: a.body, audience: a.audience, published: a.published });
    setShowForm(true);
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/admin/noticeboard/${id}`);
      toast("Deleted", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Notices appear on the parent/student portal and student noticeboard.</p>
      {canEdit && (
        <button type="button" className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> {showForm ? "Close form" : "New notice"}
        </button>
      )}
      {showForm && canEdit && (
        <form onSubmit={submit} className="card p-6 space-y-3">
          <h3 className="font-semibold text-white">{editId ? "Edit notice" : "Publish notice"}</h3>
          <input className="input" required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <RichTextField placeholder="Message…" value={form.body} onChange={(body) => setForm({ ...form, body })} />
          <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
            <option value="all">Everyone</option>
            <option value="parents">Parents</option>
            <option value="students">Students</option>
            <option value="staff">Staff</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
            Published (visible on portal)
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editId ? "Save changes" : "Publish"}</button>
            <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      ) : (
        <div className="card overflow-hidden">
          <table className="table text-sm">
            <thead><tr><th>Title</th><th>Audience</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={canEdit ? 4 : 3} className="text-center py-10 text-slate-500">No notices yet.</td></tr>
              ) : rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <p className="font-medium text-white">{a.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{htmlToPlainText(a.body, 80)}</p>
                  </td>
                  <td className="capitalize">{a.audience}</td>
                  <td><span className={a.published ? "text-emerald-400" : "text-amber-400"}>{a.published ? "Live" : "Draft"}</span></td>
                  {canEdit && (
                    <td className="space-x-1 whitespace-nowrap">
                      {!a.published && (
                        <button type="button" className="btn-ghost text-xs" onClick={async () => {
                          await api.patch(`/s/${schoolSlug}/api/admin/noticeboard/${a.id}`, { published: true });
                          load();
                        }}>Publish</button>
                      )}
                      <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(a)}><Pencil className="w-3 h-3 inline" /></button>
                      <ConfirmAction label="Delete" confirmMessage={`Delete “${a.title}”?`} onConfirm={() => remove(a.id)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ClassesSectionsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("academics.manage");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classForm, setClassForm] = useState({ name: "", level: "1" });
  const [sectionForm, setSectionForm] = useState({ classId: "", name: "" });
  const [editClass, setEditClass] = useState<{ id: string; name: string; level: string } | null>(null);
  const [editSection, setEditSection] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/admin/academics-structure`).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/classes`, { name: classForm.name, level: Number(classForm.level) });
    toast("Class added", "success");
    setClassForm({ name: "", level: "1" });
    load();
  };

  const saveClass = async () => {
    if (!editClass) return;
    await api.patch(`/s/${schoolSlug}/api/academics/classes/${editClass.id}`, { name: editClass.name, level: Number(editClass.level) });
    toast("Class updated", "success");
    setEditClass(null);
    load();
  };

  const deleteClass = async (id: string, name: string) => {
    await api.delete(`/s/${schoolSlug}/api/academics/classes/${id}`);
    toast(`Deleted ${name}`, "success");
    load();
  };

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/classes/${sectionForm.classId}/streams`, { name: sectionForm.name });
    toast("Section added", "success");
    setSectionForm({ classId: "", name: "" });
    load();
  };

  const saveSection = async () => {
    if (!editSection) return;
    await api.patch(`/s/${schoolSlug}/api/academics/streams/${editSection.id}`, { name: editSection.name });
    toast("Section updated", "success");
    setEditSection(null);
    load();
  };

  const deleteSection = async (id: string) => {
    await api.delete(`/s/${schoolSlug}/api/academics/streams/${id}`);
    toast("Section deleted", "success");
    load();
  };

  if (loading) return <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />;
  if (!data) return <p className="text-slate-500">Could not load structure.</p>;

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="grid md:grid-cols-2 gap-4">
          <form onSubmit={addClass} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary-400" /> Add class</h3>
            <input className="input" required placeholder="e.g. Primary 5" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            <input className="input" type="number" min="1" placeholder="Level" value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} />
            <button type="submit" className="btn-primary w-full">Add class</button>
          </form>
          <form onSubmit={addSection} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Add section (stream)</h3>
            <select className="input" required value={sectionForm.classId} onChange={(e) => setSectionForm({ ...sectionForm, classId: e.target.value })}>
              <option value="">Select class…</option>
              {(data.classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input" required placeholder="e.g. A, B, Science" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
            <button type="submit" className="btn-primary w-full">Add section</button>
          </form>
        </div>
      )}

      {editClass && canManage && (
        <div className="card p-4 flex flex-wrap gap-2 items-end border border-primary-800/50">
          <input className="input flex-1 min-w-[140px]" value={editClass.name} onChange={(e) => setEditClass({ ...editClass, name: e.target.value })} />
          <input className="input w-24" type="number" value={editClass.level} onChange={(e) => setEditClass({ ...editClass, level: e.target.value })} />
          <button type="button" className="btn-primary" onClick={saveClass}>Save class</button>
          <button type="button" className="btn-ghost" onClick={() => setEditClass(null)}>Cancel</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Class</th><th>Sections</th><th>Enrolled</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {(data.classes ?? []).length === 0 ? (
              <tr><td colSpan={canManage ? 4 : 3} className="text-center py-10 text-slate-500">No classes yet.</td></tr>
            ) : (data.classes ?? []).map((c: any) => (
              <React.Fragment key={c.id}>
                <tr>
                  <td className="font-medium text-white">{c.name} <span className="text-slate-500">(L{c.level})</span></td>
                  <td className="text-slate-400">{(c.sections ?? []).map((s: any) => s.name).join(", ") || "—"}</td>
                  <td>{c.enrollmentCount}</td>
                  {canManage && (
                    <td className="space-x-1 whitespace-nowrap">
                      <button type="button" className="btn-ghost text-xs" onClick={() => setEditClass({ id: c.id, name: c.name, level: String(c.level) })}>Edit</button>
                      <ConfirmAction label="Delete" confirmMessage={`Delete class “${c.name}”?`} onConfirm={() => deleteClass(c.id, c.name)} />
                    </td>
                  )}
                </tr>
                {canManage && (c.sections ?? []).map((s: any) => (
                  <tr key={s.id} className="bg-slate-900/30">
                    <td className="pl-8 text-slate-400">↳ {editSection?.id === s.id ? (
                      <span className="inline-flex gap-2 items-center">
                        <input className="input text-sm w-32" value={editSection?.name ?? ""} onChange={(e) => setEditSection({ id: s.id, name: e.target.value })} />
                        <button type="button" className="btn-primary text-xs py-1" onClick={saveSection}>Save</button>
                        <button type="button" className="btn-ghost text-xs py-1" onClick={() => setEditSection(null)}>Cancel</button>
                      </span>
                    ) : s.name}</td>
                    <td colSpan={2} />
                    <td className="space-x-1">
                      {editSection?.id !== s.id && (
                        <>
                          <button type="button" className="btn-ghost text-xs" onClick={() => setEditSection({ id: s.id, name: s.name })}>Edit</button>
                          <ConfirmAction label="Delete" confirmMessage={`Delete section “${s.name}”?`} onConfirm={() => deleteSection(s.id)} />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const SessionsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({
    newYearName: "", newYearStart: "", newYearEnd: "",
    termName: "Term 1", termStart: "", termEnd: "", closePreviousYear: true,
  });

  const load = () => api.get(`/s/${schoolSlug}/api/admin/academics-structure`).then((r) => setData(r.data)).catch(() => {});

  useEffect(() => { load(); }, [schoolSlug]);

  const transition = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/admin/sessions/transition`, form);
    toast("New academic session created", "success");
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Roll forward to a new academic year and term. Previous sessions can be closed automatically.</p>
      <div className="card p-5">
        <h3 className="font-semibold text-white mb-3">Current structure</h3>
        <div className="space-y-2 text-sm">
          {(data?.years ?? []).map((y: any) => (
            <div key={y.id} className={`p-3 rounded-lg ${y.isCurrent ? "bg-primary-900/20 border border-primary-800/40" : "bg-slate-900/40"}`}>
              <span className="text-white font-medium">{y.name}</span>
              {y.isCurrent && <span className="text-xs text-primary-400 ml-2">current</span>}
              <p className="text-slate-500 text-xs mt-1">{new Date(y.startDate).toLocaleDateString()} – {new Date(y.endDate).toLocaleDateString()}</p>
            </div>
          ))}
          {(data?.terms ?? []).filter((t: any) => t.isCurrent).map((t: any) => (
            <p key={t.id} className="text-slate-400 text-sm pl-2">Active term: {t.name}</p>
          ))}
        </div>
      </div>
      <form onSubmit={transition} className="card p-6 grid md:grid-cols-2 gap-3">
        <h3 className="font-semibold text-white md:col-span-2">Start new session</h3>
        <input className="input md:col-span-2" required placeholder="Year name e.g. 2026/2027" value={form.newYearName} onChange={(e) => setForm({ ...form, newYearName: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-400 md:col-span-2">
          <input type="checkbox" checked={form.closePreviousYear} onChange={(e) => setForm({ ...form, closePreviousYear: e.target.checked })} />
          Close previous year/terms as non-current
        </label>
        <div><label className="label">Year start</label><input className="input" type="date" required value={form.newYearStart} onChange={(e) => setForm({ ...form, newYearStart: e.target.value })} /></div>
        <div><label className="label">Year end</label><input className="input" type="date" required value={form.newYearEnd} onChange={(e) => setForm({ ...form, newYearEnd: e.target.value })} /></div>
        <div><label className="label">Term name</label><input className="input" value={form.termName} onChange={(e) => setForm({ ...form, termName: e.target.value })} /></div>
        <div><label className="label">Term start</label><input className="input" type="date" value={form.termStart} onChange={(e) => setForm({ ...form, termStart: e.target.value })} /></div>
        <div><label className="label">Term end</label><input className="input" type="date" value={form.termEnd} onChange={(e) => setForm({ ...form, termEnd: e.target.value })} /></div>
        <button type="submit" className="btn-primary md:col-span-2 max-w-xs">Create session</button>
      </form>
      <Link to={`/s/${schoolSlug}/students/promote`} className="text-primary-400 text-sm hover:underline">Open promotion wizard →</Link>
    </div>
  );
};

export const MultiSchoolPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { formatMoney } = useAuth();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/admin/multi-school`).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  if (!data?.enabled) {
    return (
      <div className="card p-10 text-center text-slate-400">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p>Enable <strong className="text-slate-300">multi_campus</strong> on your plan to manage branches.</p>
        <Link to={`/s/${schoolSlug}/settings`} className="btn-primary mt-4 inline-flex">Open settings</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form className="card p-5 grid md:grid-cols-4 gap-3 items-end" onSubmit={async (e) => {
        e.preventDefault();
        await api.post(`/s/${schoolSlug}/api/campuses`, form);
        toast("Branch added", "success");
        setForm({ name: "", code: "", address: "" });
        load();
      }}>
        <div><label className="label">Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Code</label><input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <button type="submit" className="btn-primary md:col-span-4 max-w-xs"><Plus className="w-4 h-4" /> Add branch</button>
      </form>
      <p className="text-xs text-slate-500">Use the campus selector in the header to filter data by branch.</p>
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Branch</th><th>Students</th><th>Invoiced</th><th>Collected</th><th></th></tr></thead>
          <tbody>
            {(data.consolidated ?? []).map((r: any) => (
              <tr key={r.campus.id}>
                {editId === r.campus.id ? (
                  <>
                    <td colSpan={4} className="space-y-2">
                      <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      <input className="input" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    </td>
                    <td className="space-x-1">
                      <button type="button" className="btn-primary text-xs" onClick={async () => {
                        await api.patch(`/s/${schoolSlug}/api/campuses/${r.campus.id}`, editForm);
                        toast("Updated", "success");
                        setEditId(null);
                        load();
                      }}>Save</button>
                      <button type="button" className="btn-ghost text-xs" onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><span className="text-white font-medium">{r.campus.name}</span> <span className="text-slate-500">({r.campus.code})</span></td>
                    <td>{r.students}</td>
                    <td>{formatMoney(r.invoiced)}</td>
                    <td>{formatMoney(r.collected)}</td>
                    <td>
                      <button type="button" className="btn-ghost text-xs" onClick={() => { setEditId(r.campus.id); setEditForm({ name: r.campus.name, address: r.campus.address ?? "" }); }}>Edit</button>
                      <button type="button" className="btn-ghost text-xs text-amber-400" onClick={async () => {
                        await api.patch(`/s/${schoolSlug}/api/campuses/${r.campus.id}`, { status: "inactive" });
                        toast("Branch deactivated", "success");
                        load();
                      }}>Deactivate</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AppearancePanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [presets, setPresets] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/admin/appearance-presets`).then((r) => setPresets(r.data ?? [])).catch(() => {});
    api.get(`/s/${schoolSlug}/api/settings`).then((r) => {
      const theme = r.data?.themeJson as { presetId?: string } | undefined;
      setActiveId(theme?.presetId ?? null);
    }).catch(() => {});
  }, [schoolSlug]);

  const apply = async (presetId: string) => {
    const res = await api.post(`/s/${schoolSlug}/api/admin/appearance`, { presetId });
    const theme = res.data?.themeJson as { mode?: "light" | "dark"; accent?: string };
    applyTenantAppearance(theme);
    setActiveId(presetId);
    toast("Appearance updated", "success");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Theme presets apply accent color and light/dark mode for all staff users at this school.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`card p-5 text-left transition-all ${activeId === p.id ? "ring-2 ring-primary-500 border-primary-600" : "hover:border-slate-600"}`}
            onClick={() => apply(p.id)}
          >
            <div className="w-full h-10 rounded-lg mb-3" style={{ background: p.accent }} />
            <p className="text-white font-medium">{p.label}</p>
            <p className="text-slate-500 text-xs capitalize">{p.mode} mode</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export const SetupWizardPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [wizard, setWizard] = useState<any>(null);
  const [profile, setProfile] = useState({ schoolName: "", country: "UG", timezone: "Africa/Kampala" });

  const load = () => api.get(`/s/${schoolSlug}/api/admin/setup-wizard`).then((r) => setWizard(r.data)).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/admin/setup-wizard/school-profile`, profile);
    toast("School profile saved", "success");
    load();
  };

  const finish = async () => {
    await api.post(`/s/${schoolSlug}/api/admin/setup-wizard/complete`, {});
    toast("Setup marked complete", "success");
    load();
  };

  if (!wizard) return <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Setup progress</h3>
          <span className={`text-xl font-bold ${wizard.percentComplete >= 100 ? "text-emerald-400" : "text-primary-400"}`}>{wizard.percentComplete}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 mb-6">
          <div className="bg-primary-500 h-2.5 rounded-full transition-all" style={{ width: `${wizard.percentComplete}%` }} />
        </div>
        <ul className="space-y-3">
          {(wizard.steps ?? []).map((s: any) => (
            <li key={s.id} className={`flex gap-3 p-3 rounded-lg ${s.done ? "bg-emerald-900/20" : "bg-slate-900/50"}`}>
              <span className={s.done ? "text-emerald-400" : "text-slate-600"}>{s.done ? "✓" : "○"}</span>
              <div>
                <p className={s.done ? "text-emerald-300 font-medium" : "text-slate-300"}>{s.label}</p>
                {!s.done && s.hint && <p className="text-xs text-slate-500 mt-0.5">{s.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
        {!wizard.complete && (
          <button type="button" className="btn-primary mt-6" onClick={finish}>Mark setup complete</button>
        )}
      </div>
      <form onSubmit={saveProfile} className="card p-6 space-y-3 max-w-lg">
        <h3 className="font-semibold text-white">School profile</h3>
        <input className="input" required placeholder="School name" value={profile.schoolName} onChange={(e) => setProfile({ ...profile, schoolName: e.target.value })} />
        <select className="input" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })}>
          {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <input className="input" placeholder="Timezone" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />
        <button type="submit" className="btn-primary">Save profile</button>
      </form>
    </div>
  );
};

export const SystemUtilitiesPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [resetConfirm, setResetConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const resetData = async () => {
    if (resetConfirm !== "RESET") return toast('Type RESET to confirm', "error");
    if (!confirm("Permanently delete operational data for this school? Users and settings remain.")) return;
    setLoading(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/admin/data-reset`, { confirm: "RESET" });
      toast(`Cleared ${res.data?.tablesCleared ?? 0} table groups`, "success");
      setResetConfirm("");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission("settings.manage")) {
    return <p className="text-slate-400 card p-6">Requires settings.manage permission.</p>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <DemoDataPanel schoolSlug={schoolSlug} />
      <div className="card p-6 space-y-4 border border-red-900/40">
        <h3 className="font-semibold text-red-400">Data reset</h3>
        <p className="text-sm text-slate-400">Wipes students, fees, attendance, library, etc. Users, roles, and settings stay.</p>
        <input className="input" placeholder="Type RESET" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} />
        <button type="button" className="btn-secondary text-red-400 border-red-800" disabled={loading || resetConfirm !== "RESET"} onClick={resetData}>
          Reset operational data
        </button>
      </div>
    </div>
  );
};

import { PortalLoginsPanel } from "./PortalLoginsPanel";

export const PortalDashboardsPanel: React.FC<{ schoolSlug: string }> = (props) => (
  <PortalLoginsPanel {...props} />
);

export const AuditPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = actionFilter.trim() ? `?action=${encodeURIComponent(actionFilter.trim())}` : "";
      const res = await api.get(`/s/${schoolSlug}/api/admin/audit-logs${q}`);
      setLogs(res.data ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, actionFilter, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 max-w-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9 w-full"
            placeholder="Filter by action…"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <button type="button" className="btn-primary" onClick={load}>Search</button>
      </div>
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />
      ) : (
        <div className="card overflow-hidden">
          <table className="table text-sm">
            <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500">No audit entries.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-slate-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td><code className="text-xs text-primary-300">{log.action}</code></td>
                  <td className="text-slate-400">{log.entityType} {log.entityId?.slice(0, 8)}…</td>
                  <td>{log.actorEmail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
