import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { useAuth } from "../state/AuthContext";
import { Loader2 } from "lucide-react";

type Student = { id: string; admissionNumber: string; firstName: string; lastName: string; className?: string };
type ClassRow = { id: string; name: string };
type TermRow = { id: string; name: string };

export const StudentPromotion: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterClass, setFilterClass] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/s/${schoolSlug}/api/students?limit=200`),
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/terms`),
    ])
      .then(([s, c, t]) => {
        setStudents(s.data ?? []);
        setClasses(c.data ?? []);
        setTerms(t.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const visible = students.filter((s) => !filterClass || s.className === classes.find((c) => c.id === filterClass)?.name);
    setSelected(new Set(visible.map((s) => s.id)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return toast("Select target class", "error");
    if (!selected.size) return toast("Select at least one student", "error");
    setSaving(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/students/batch-promote`, {
        studentIds: [...selected],
        classId,
        termId: termId || undefined,
      });
      toast(`Promoted ${res.data?.promoted ?? selected.size} students`, "success");
      setSelected(new Set());
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission("students.edit")) {
    return <p className="text-slate-400">You need students.edit to run promotions.</p>;
  }

  const filtered = students.filter((s) => {
    if (!filterClass) return true;
    const name = classes.find((c) => c.id === filterClass)?.name;
    return s.className === name;
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Promotion wizard</h1>
        <p className="text-sm text-slate-400 mt-1">Move multiple students to a new class for the next term.</p>
      </div>
      <form onSubmit={submit} className="card p-6 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Target class</label>
            <select className="input" required value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Term (optional)</label>
            <select className="input" value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">—</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={saving || !selected.size}>
              {saving ? "Promoting…" : `Promote ${selected.size} selected`}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="label mb-0">Filter by current class</label>
          <select className="input max-w-xs" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="">All</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="btn-ghost text-sm" onClick={selectAll}>Select visible</button>
          <button type="button" className="btn-ghost text-sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
        ) : (
          <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-xl divide-y divide-slate-800">
            {filtered.map((s) => (
              <label key={s.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800/40 cursor-pointer">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="font-mono text-xs text-slate-500">{s.admissionNumber}</span>
                <span className="text-white">{s.firstName} {s.lastName}</span>
                <span className="text-xs text-slate-500 ml-auto">{s.className ?? "—"}</span>
              </label>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};
