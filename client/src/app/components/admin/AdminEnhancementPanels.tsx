import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { applyTenantAppearance } from "../../utils/theme";
import { Loader2 } from "lucide-react";

export const AdminOverviewPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/admin/overview`).then((r) => setData(r.data)).catch(() => {});
  }, [schoolSlug]);
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4"><p className="text-slate-500 text-sm">Staff users</p><p className="text-2xl font-bold text-white">{data.users}</p></div>
      <div className="card p-4"><p className="text-slate-500 text-sm">Roles</p><p className="text-2xl font-bold text-white">{data.roles}</p></div>
      <div className="card p-4"><p className="text-slate-500 text-sm">Classes</p><p className="text-2xl font-bold text-white">{data.classes}</p></div>
      <div className="card p-4"><p className="text-slate-500 text-sm">Setup</p><p className="text-2xl font-bold text-emerald-400">{data.setupPercent}%</p></div>
    </div>
  );
};

export const NoticeboardAdminPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "", audience: "all", published: true });

  const load = () => api.get(`/s/${schoolSlug}/api/admin/noticeboard`).then((r) => setRows(r.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/admin/noticeboard`, form);
    toast("Announcement published", "success");
    setForm({ title: "", body: "", audience: "all", published: true });
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">School-wide notices appear on the parent/student portal and student noticeboard.</p>
      <form onSubmit={submit} className="card p-6 space-y-3">
        <input className="input" required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input min-h-[100px]" required placeholder="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
          <option value="all">Everyone</option>
          <option value="parents">Parents</option>
          <option value="students">Students</option>
          <option value="staff">Staff</option>
        </select>
        <button type="submit" className="btn-primary">Publish</button>
      </form>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.id} className="card p-4 flex justify-between gap-3">
            <div>
              <p className="text-white font-medium">{a.title}</p>
              <p className="text-slate-500 text-xs capitalize">{a.audience} · {a.published ? "Live" : "Draft"}</p>
            </div>
            {!a.published && (
              <button type="button" className="btn-ghost text-xs" onClick={async () => {
                await api.patch(`/s/${schoolSlug}/api/admin/noticeboard/${a.id}`, { published: true });
                load();
              }}>Publish</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ClassesSectionsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [classForm, setClassForm] = useState({ name: "", level: "1" });
  const [sectionForm, setSectionForm] = useState({ classId: "", name: "" });

  const load = useCallback(() => {
    api.get(`/s/${schoolSlug}/api/admin/academics-structure`).then((r) => setData(r.data)).catch(() => {});
  }, [schoolSlug]);
  useEffect(() => { load(); }, [load]);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/classes`, { name: classForm.name, level: Number(classForm.level) });
    toast("Class added", "success");
    setClassForm({ name: "", level: "1" });
    load();
  };

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/classes/${sectionForm.classId}/streams`, { name: sectionForm.name });
    toast("Section added", "success");
    setSectionForm({ classId: "", name: "" });
    load();
  };

  if (!data) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      {hasPermission("academics.manage") && (
        <div className="grid md:grid-cols-2 gap-4">
          <form onSubmit={addClass} className="card p-4 space-y-3">
            <h3 className="font-semibold text-white">Add class</h3>
            <input className="input" required placeholder="e.g. Primary 5" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            <input className="input" type="number" min="1" value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} />
            <button type="submit" className="btn-primary w-full">Add class</button>
          </form>
          <form onSubmit={addSection} className="card p-4 space-y-3">
            <h3 className="font-semibold text-white">Add section (stream)</h3>
            <select className="input" required value={sectionForm.classId} onChange={(e) => setSectionForm({ ...sectionForm, classId: e.target.value })}>
              <option value="">Class…</option>
              {(data.classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input" required placeholder="e.g. A, B, Science" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
            <button type="submit" className="btn-primary w-full">Add section</button>
          </form>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Class</th><th>Sections</th><th>Enrolled</th></tr></thead>
          <tbody>
            {(data.classes ?? []).map((c: any) => (
              <tr key={c.id}>
                <td>{c.name} (L{c.level})</td>
                <td className="text-slate-400">{(c.sections ?? []).map((s: any) => s.name).join(", ") || "—"}</td>
                <td>{c.enrollmentCount}</td>
              </tr>
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

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/admin/academics-structure`).then((r) => setData(r.data)).catch(() => {});
  }, [schoolSlug]);

  const transition = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/admin/sessions/transition`, form);
    toast("New academic session created", "success");
    api.get(`/s/${schoolSlug}/api/admin/academics-structure`).then((r) => setData(r.data));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Define academic years and terms. Use transition to roll forward to a new session.</p>
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-2">Current structure</h3>
        {(data?.years ?? []).map((y: any) => (
          <p key={y.id} className="text-slate-300 text-sm">
            {y.name} {y.isCurrent ? "(current)" : ""} — {new Date(y.startDate).toLocaleDateString()} to {new Date(y.endDate).toLocaleDateString()}
          </p>
        ))}
        {(data?.terms ?? []).filter((t: any) => t.isCurrent).map((t: any) => (
          <p key={t.id} className="text-slate-500 text-sm">Term: {t.name}</p>
        ))}
      </div>
      <form onSubmit={transition} className="card p-6 grid md:grid-cols-2 gap-3">
        <h3 className="font-semibold text-white md:col-span-2">Start new session</h3>
        <input className="input" required placeholder="Year name e.g. 2026/2027" value={form.newYearName} onChange={(e) => setForm({ ...form, newYearName: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-400 md:col-span-2">
          <input type="checkbox" checked={form.closePreviousYear} onChange={(e) => setForm({ ...form, closePreviousYear: e.target.checked })} />
          Close previous year/terms as non-current
        </label>
        <input className="input" type="date" required value={form.newYearStart} onChange={(e) => setForm({ ...form, newYearStart: e.target.value })} />
        <input className="input" type="date" required value={form.newYearEnd} onChange={(e) => setForm({ ...form, newYearEnd: e.target.value })} />
        <input className="input" placeholder="Term name" value={form.termName} onChange={(e) => setForm({ ...form, termName: e.target.value })} />
        <input className="input" type="date" value={form.termStart} onChange={(e) => setForm({ ...form, termStart: e.target.value })} />
        <input className="input" type="date" value={form.termEnd} onChange={(e) => setForm({ ...form, termEnd: e.target.value })} />
        <button type="submit" className="btn-primary md:col-span-2">Create session</button>
      </form>
      <Link to={`/s/${schoolSlug}/students/promote`} className="text-primary-400 text-sm">Open promotion wizard for class transitions →</Link>
    </div>
  );
};

export const MultiSchoolPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/admin/multi-school`).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  if (!data?.enabled) {
    return (
      <div className="card p-8 text-center text-slate-400">
        Enable <strong>multi_campus</strong> on your plan to manage multiple branches from one dashboard.
        <Link to={`/s/${schoolSlug}/settings`} className="block mt-2 text-primary-400">Settings</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form className="card p-4 flex flex-wrap gap-2" onSubmit={async (e) => {
        e.preventDefault();
        await api.post(`/s/${schoolSlug}/api/campuses`, form);
        setForm({ name: "", code: "", address: "" });
        load();
      }}>
        <input className="input" required placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input w-24" required placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="input flex-1" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <button type="submit" className="btn-primary">Add branch</button>
      </form>
      <p className="text-xs text-slate-500">Use the campus selector in the header to filter data by branch.</p>
      {(data.consolidated ?? []).map((r: any) => (
        <div key={r.campus.id} className="card p-4 flex justify-between">
          <span className="text-white">{r.campus.name} ({r.campus.code})</span>
          <span className="text-slate-400 text-sm">{r.students} students</span>
        </div>
      ))}
    </div>
  );
};

export const AppearancePanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [presets, setPresets] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/admin/appearance-presets`).then((r) => setPresets(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  const apply = async (presetId: string) => {
    const res = await api.post(`/s/${schoolSlug}/api/admin/appearance`, { presetId });
    const theme = res.data?.themeJson as { mode?: "light" | "dark"; accent?: string };
    applyTenantAppearance(theme);
    toast("Appearance updated for this school", "success");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Choose a theme preset. Accent color applies across buttons and highlights for all staff users.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {presets.map((p) => (
          <button key={p.id} type="button" className="card p-4 text-left hover:border-primary-500 transition-colors" onClick={() => apply(p.id)}>
            <div className="w-full h-8 rounded mb-2" style={{ background: p.accent }} />
            <p className="text-white font-medium">{p.label}</p>
            <p className="text-slate-500 text-xs capitalize">{p.mode}</p>
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

  if (!wizard) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Setup progress</h3>
          <span className="text-emerald-400 font-bold">{wizard.percentComplete}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 mb-4">
          <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${wizard.percentComplete}%` }} />
        </div>
        <ul className="space-y-3">
          {(wizard.steps ?? []).map((s: any) => (
            <li key={s.id} className={`flex gap-3 text-sm ${s.done ? "text-emerald-400" : "text-slate-400"}`}>
              <span>{s.done ? "✓" : "○"}</span>
              <div>
                <p className={s.done ? "text-emerald-300" : "text-slate-300"}>{s.label}</p>
                {!s.done && s.hint && <p className="text-xs text-slate-500">{s.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
        {!wizard.complete && (
          <button type="button" className="btn-primary mt-4" onClick={finish}>Mark setup complete</button>
        )}
      </div>
      <form onSubmit={saveProfile} className="card p-6 space-y-3">
        <h3 className="font-semibold text-white">Step 1 — School profile</h3>
        <input className="input" required placeholder="School name" value={profile.schoolName} onChange={(e) => setProfile({ ...profile, schoolName: e.target.value })} />
        <input className="input" placeholder="Country code (UG)" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} />
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

  const loadDemo = async () => {
    if (!confirm("Load demo students, classes, and staff for this school? Existing records are kept.")) return;
    setLoading(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/admin/demo-seed`, {});
      toast(res.data?.message ?? "Demo data loaded", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const resetData = async () => {
    if (resetConfirm !== "RESET") return toast('Type RESET to confirm', "error");
    if (!confirm("This permanently deletes students, fees, exams, and all operational data for this school. Users and settings remain. Continue?")) return;
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
    return <p className="text-slate-400">Requires settings.manage permission.</p>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-6 space-y-4 border border-emerald-900/50">
        <h3 className="font-semibold text-white">One-click demo data</h3>
        <p className="text-sm text-slate-400">
          Adds sample classes, students, staff, and a demo admin login without removing existing data.
        </p>
        <button type="button" className="btn-primary" disabled={loading} onClick={loadDemo}>
          {loading ? "Working…" : "Load demo data"}
        </button>
      </div>
      <div className="card p-6 space-y-4 border border-red-900/50">
        <h3 className="font-semibold text-red-400">Data reset</h3>
        <p className="text-sm text-slate-400">
          Wipes operational records (students, invoices, attendance, library, transport, etc.). Tenant account, users, roles, and settings are preserved.
        </p>
        <input className="input" placeholder='Type RESET to confirm' value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} />
        <button type="button" className="btn-secondary text-red-400 border-red-800" disabled={loading || resetConfirm !== "RESET"} onClick={resetData}>
          Reset operational data
        </button>
      </div>
    </div>
  );
};

export const PortalDashboardsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => (
  <div className="card p-6 space-y-4">
    <h3 className="font-semibold text-white">Student & parent dashboards</h3>
    <p className="text-sm text-slate-400">
      Parents and students use a separate portal login. Dashboards show fees, attendance, report cards, homework, and the school noticeboard.
    </p>
    <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
      <li>Fee balances and online payment (when gateways enabled)</li>
      <li>Attendance and published report cards</li>
      <li>Announcements from the noticeboard</li>
      <li>Parent messaging to school staff</li>
    </ul>
    <a href={`/s/${schoolSlug}/portal/login`} target="_blank" rel="noreferrer" className="btn-primary inline-block">
      Open parent/student portal
    </a>
  </div>
);
