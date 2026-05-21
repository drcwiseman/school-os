import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { useAcademicsLookups } from "../components/academics/useAcademicsLookups";
import { BookMarked, Loader2, Info } from "lucide-react";

const TABS = ["frameworks", "units", "competencies", "outcomes", "tracking", "analytics", "import"] as const;

const CLIENT_PRESETS = [
  { code: "cbc", name: "Competency-Based Curriculum (CBC)", examBoard: "KNEC" },
  { code: "cbe", name: "Competency-Based Education (CBE)", examBoard: null },
  { code: "british", name: "British National Curriculum", examBoard: "Cambridge" },
  { code: "american", name: "American Common Core", examBoard: null },
  { code: "uneb", name: "UNEB (Uganda)", examBoard: "UNEB" },
  { code: "custom", name: "Custom Framework", examBoard: null },
];

export const Curriculum: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { classes, subjects } = useAcademicsLookups();
  const [tab, setTab] = useState<(typeof TABS)[number]>("frameworks");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [presets, setPresets] = useState(CLIENT_PRESETS);
  const [units, setUnits] = useState<any[]>([]);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeFw, setActiveFw] = useState("");
  const [fwForm, setFwForm] = useState({ code: "cbc", name: "", examBoard: "" });
  const [unitForm, setUnitForm] = useState({ frameworkId: "", title: "", subjectId: "", classId: "" });
  const [compForm, setCompForm] = useState({ frameworkId: "", code: "", name: "" });
  const [importJson, setImportJson] = useState('{"competencies":[{"code":"C1","name":"Literacy"}],"units":[{"title":"Term 1 Unit 1","outcomes":["Read fluently"]}]}');

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/curriculum/status`)
      .then((r) => setSchemaReady(r.data?.ready !== false))
      .catch(() => setSchemaReady(false));
  }, [schoolSlug]);

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const base = `/s/${schoolSlug}/api/curriculum`;
      if (tab === "frameworks") {
        const res = await api.get(`${base}/frameworks`);
        setFrameworks(res.data ?? []);
        setPresets(res.presets?.length ? res.presets : CLIENT_PRESETS);
        setActiveFw((prev) => prev || res.data?.[0]?.id || "");
      } else if (tab === "units") {
        setUnits((await api.get(`${base}/units${activeFw ? `?frameworkId=${activeFw}` : ""}`)).data ?? []);
      } else if (tab === "competencies") {
        setCompetencies((await api.get(`${base}/competencies${activeFw ? `?frameworkId=${activeFw}` : ""}`)).data ?? []);
      } else if (tab === "outcomes") {
        setOutcomes((await api.get(`${base}/outcomes`)).data ?? []);
      } else if (tab === "analytics") {
        setAnalytics((await api.get(`${base}/analytics`)).data);
      }
    } catch (e: any) {
      const msg = e.message ?? "Curriculum API error";
      setApiError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug, tab, activeFw]);

  const createFramework = async () => {
    try {
      const preset = presets.find((p) => p.code === fwForm.code);
      await api.post(`/s/${schoolSlug}/api/curriculum/frameworks`, {
        code: fwForm.code,
        name: fwForm.name || preset?.name || fwForm.code,
        examBoard: fwForm.examBoard || preset?.examBoard,
        active: true,
      });
      toast("Framework created", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const activateFramework = async (id: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/curriculum/frameworks/${id}/activate`, {});
      toast("Framework activated", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const createUnit = async () => {
    const fw = unitForm.frameworkId || activeFw;
    if (!fw) return toast("Select a framework first", "error");
    try {
      await api.post(`/s/${schoolSlug}/api/curriculum/units`, {
        ...unitForm,
        frameworkId: fw,
        subjectId: unitForm.subjectId || undefined,
        classId: unitForm.classId || undefined,
      });
      toast("Unit added", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const createComp = async () => {
    const fw = compForm.frameworkId || activeFw;
    if (!fw) return toast("Select a framework first", "error");
    try {
      await api.post(`/s/${schoolSlug}/api/curriculum/competencies`, { ...compForm, frameworkId: fw });
      toast("Competency added", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const runImport = async () => {
    try {
      const packJson = JSON.parse(importJson);
      await api.post(`/s/${schoolSlug}/api/curriculum/import-pack`, {
        name: "Imported pack",
        frameworkCode: fwForm.code,
        packJson,
      });
      toast("Pack imported", "success");
      setTab("frameworks");
      load();
    } catch (e: any) {
      toast(e.message ?? "Invalid JSON", "error");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><BookMarked className="w-7 h-7 text-indigo-400" /> Curriculum</h1>
          <p className="text-slate-400 mt-1">Frameworks, competencies, outcomes & progress</p>
        </div>
        <select className="input w-56" value={activeFw} onChange={(e) => setActiveFw(e.target.value)}>
          <option value="">All frameworks</option>
          {frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {(!schemaReady || apiError) && (
        <div className="card p-4 border border-red-900/50 text-sm text-slate-300 flex gap-2">
          <Info className="w-5 h-5 text-red-400 shrink-0" />
          <span>
            {apiError ? (
              <>Curriculum API error: <strong className="text-red-400">{apiError}</strong>. </>
            ) : (
              <>Curriculum database tables are not installed yet. </>
            )}
            On the server run{" "}
            <code className="text-xs bg-slate-800 px-1 rounded">npm run db:repair --prefix server</code> then restart.
            {!frameworks.length && (
              <> Or <Link to={`/s/${schoolSlug}/admin`} className="text-amber-400 hover:underline">Admin → Utilities</Link> → Load demo data.</>
            )}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" className={`tab-pill ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
      ) : (
        <>
          {tab === "frameworks" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-white">Add framework</h3>
                <select className="input" value={fwForm.code} onChange={(e) => setFwForm({ ...fwForm, code: e.target.value })}>
                  {presets.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
                <input className="input" placeholder="Custom name (optional)" value={fwForm.name} onChange={(e) => setFwForm({ ...fwForm, name: e.target.value })} />
                <button type="button" className="btn-primary" onClick={createFramework} disabled={!schemaReady}>Create</button>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">Frameworks</h3>
                {frameworks.length === 0 ? (
                  <p className="text-slate-500 text-sm">No frameworks yet — create one or use Import tab.</p>
                ) : frameworks.map((f) => (
                  <div key={f.id} className="flex justify-between items-center py-2 border-b border-slate-800 gap-2">
                    <span>{f.name} <span className="text-slate-500 text-sm">({f.code})</span></span>
                    <div className="flex items-center gap-2">
                      {f.active && <span className="text-emerald-400 text-xs">Active</span>}
                      {!f.active && (
                        <button type="button" className="text-xs text-primary-400 hover:underline" onClick={() => activateFramework(f.id)}>
                          Set active
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "units" && (
            <div className="space-y-4">
              {!activeFw && <p className="text-amber-400 text-sm">Select a framework in the header dropdown.</p>}
              <div className="card p-4 grid md:grid-cols-2 lg:grid-cols-4 gap-2">
                <input className="input md:col-span-2" placeholder="Unit title" value={unitForm.title} onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })} />
                <select className="input" value={unitForm.subjectId} onChange={(e) => setUnitForm({ ...unitForm, subjectId: e.target.value })}>
                  <option value="">Subject (optional)</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="input" value={unitForm.classId} onChange={(e) => setUnitForm({ ...unitForm, classId: e.target.value })}>
                  <option value="">Class (optional)</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" className="btn-primary md:col-span-2 lg:col-span-4" onClick={createUnit}>Add unit</button>
              </div>
              {units.length === 0 ? <p className="text-slate-500 text-sm">No units for this framework.</p> : units.map((u) => (
                <p key={u.id} className="text-slate-300">{u.title}{u.subjectName ? ` · ${u.subjectName}` : ""}{u.className ? ` · ${u.className}` : ""}</p>
              ))}
            </div>
          )}

          {tab === "competencies" && (
            <div className="space-y-4">
              {!activeFw && <p className="text-amber-400 text-sm">Select a framework in the header dropdown.</p>}
              <div className="card p-4 flex gap-2">
                <input className="input w-28" placeholder="Code" value={compForm.code} onChange={(e) => setCompForm({ ...compForm, code: e.target.value })} />
                <input className="input flex-1" placeholder="Name" value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} />
                <button type="button" className="btn-primary" onClick={createComp}>Add</button>
              </div>
              {competencies.length === 0 ? <p className="text-slate-500 text-sm">No competencies yet.</p> : competencies.map((c) => (
                <p key={c.id} className="text-slate-300">{c.code}: {c.name}</p>
              ))}
            </div>
          )}

          {tab === "outcomes" && (
            outcomes.length === 0 ? <p className="text-slate-500 text-sm">No learning outcomes yet — add units first, then outcomes via API or import pack.</p>
              : outcomes.map((o) => <p key={o.id} className="text-slate-400 text-sm">{o.description}</p>)
          )}

          {tab === "analytics" && analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4"><p className="text-slate-500 text-sm">Units</p><p className="text-2xl font-bold text-white">{analytics.units}</p></div>
              <div className="card p-4"><p className="text-slate-500 text-sm">Competencies</p><p className="text-2xl font-bold text-white">{analytics.competencies}</p></div>
              <div className="card p-4"><p className="text-slate-500 text-sm">Students tracked</p><p className="text-2xl font-bold text-white">{analytics.studentsTracked}</p></div>
            </div>
          )}

          {tab === "import" && (
            <div className="card p-5 space-y-3">
              <p className="text-slate-400 text-sm">Import a JSON pack (sample pre-filled). Creates a framework, competencies, and units in one step.</p>
              <textarea className="input min-h-[160px] font-mono text-sm" value={importJson} onChange={(e) => setImportJson(e.target.value)} />
              <button type="button" className="btn-primary" onClick={runImport} disabled={!schemaReady}>Import JSON pack</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
