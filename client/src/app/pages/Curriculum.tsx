import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { BookMarked, Loader2 } from "lucide-react";

const TABS = ["frameworks", "units", "competencies", "outcomes", "tracking", "analytics", "import"] as const;

export const Curriculum: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("frameworks");
  const [loading, setLoading] = useState(true);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeFw, setActiveFw] = useState("");
  const [fwForm, setFwForm] = useState({ code: "cbc", name: "", examBoard: "" });
  const [unitForm, setUnitForm] = useState({ frameworkId: "", title: "", subjectId: "", classId: "" });
  const [compForm, setCompForm] = useState({ frameworkId: "", code: "", name: "" });
  const [importJson, setImportJson] = useState('{"competencies":[{"code":"C1","name":"Literacy"}],"units":[{"title":"Term 1 Unit 1","outcomes":["Read fluently"]}]}');

  const load = async () => {
    setLoading(true);
    try {
      const base = `/s/${schoolSlug}/api/curriculum`;
      if (tab === "frameworks") {
        const res = await api.get(`${base}/frameworks`);
        setFrameworks(res.data ?? []);
        setPresets(res.presets ?? []);
        if (res.data?.[0] && !activeFw) setActiveFw(res.data[0].id);
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
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug, tab, activeFw]);


  const createFramework = async () => {
    const preset = presets.find((p) => p.code === fwForm.code);
    await api.post(`/s/${schoolSlug}/api/curriculum/frameworks`, {
      code: fwForm.code,
      name: fwForm.name || preset?.name || fwForm.code,
      examBoard: fwForm.examBoard || preset?.examBoard,
      active: true,
    });
    toast("Framework created", "success");
    load();
  };

  const createUnit = async () => {
    await api.post(`/s/${schoolSlug}/api/curriculum/units`, { ...unitForm, frameworkId: unitForm.frameworkId || activeFw });
    toast("Unit added", "success");
    load();
  };

  const createComp = async () => {
    await api.post(`/s/${schoolSlug}/api/curriculum/competencies`, { ...compForm, frameworkId: compForm.frameworkId || activeFw });
    toast("Competency added", "success");
    load();
  };

  const runImport = async () => {
    const packJson = JSON.parse(importJson);
    await api.post(`/s/${schoolSlug}/api/curriculum/import-pack`, {
      name: "Imported pack",
      frameworkCode: fwForm.code,
      packJson,
    });
    toast("Pack imported", "success");
    setTab("frameworks");
    load();
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
                <button type="button" className="btn-primary" onClick={createFramework}>Create</button>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">Active frameworks</h3>
                {frameworks.map((f) => (
                  <div key={f.id} className="flex justify-between py-2 border-b border-slate-800">
                    <span>{f.name} <span className="text-slate-500 text-sm">({f.code})</span></span>
                    {f.active && <span className="text-emerald-400 text-xs">Active</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "units" && (
            <div className="space-y-4">
              <div className="card p-4 flex flex-wrap gap-2">
                <input className="input flex-1" placeholder="Unit title" value={unitForm.title} onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })} />
                <button type="button" className="btn-primary" onClick={createUnit}>Add unit</button>
              </div>
              {units.map((u) => <p key={u.id} className="text-slate-300">{u.title} {u.subjectName && `· ${u.subjectName}`}</p>)}
            </div>
          )}

          {tab === "competencies" && (
            <div className="space-y-4">
              <div className="card p-4 flex gap-2">
                <input className="input" placeholder="Code" value={compForm.code} onChange={(e) => setCompForm({ ...compForm, code: e.target.value })} />
                <input className="input flex-1" placeholder="Name" value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} />
                <button type="button" className="btn-primary" onClick={createComp}>Add</button>
              </div>
              {competencies.map((c) => <p key={c.id} className="text-slate-300">{c.code}: {c.name}</p>)}
            </div>
          )}

          {tab === "outcomes" && outcomes.map((o) => <p key={o.id} className="text-slate-400 text-sm">{o.description}</p>)}

          {tab === "analytics" && analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4"><p className="text-slate-500 text-sm">Units</p><p className="text-2xl font-bold text-white">{analytics.units}</p></div>
              <div className="card p-4"><p className="text-slate-500 text-sm">Competencies</p><p className="text-2xl font-bold text-white">{analytics.competencies}</p></div>
              <div className="card p-4"><p className="text-slate-500 text-sm">Students tracked</p><p className="text-2xl font-bold text-white">{analytics.studentsTracked}</p></div>
            </div>
          )}

          {tab === "import" && (
            <div className="card p-5 space-y-3">
              <textarea className="input min-h-[160px] font-mono text-sm" value={importJson} onChange={(e) => setImportJson(e.target.value)} />
              <button type="button" className="btn-primary" onClick={runImport}>Import JSON pack</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
