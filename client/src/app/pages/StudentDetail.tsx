import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Loader2, ArrowLeft } from "lucide-react";

export const StudentDetail: React.FC = () => {
  const { schoolSlug, studentId } = useParams<{ schoolSlug: string; studentId: string }>();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    admissionNumber: "",
    firstName: "",
    lastName: "",
    middleName: "",
    gender: "",
    dob: "",
    status: "active",
  });
  const [promote, setPromote] = useState({ classId: "", termId: "" });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!schoolSlug || !studentId) return;
    setLoading(true);
    Promise.all([
      api.get(`/s/${schoolSlug}/api/students/${studentId}`),
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/terms`),
    ])
      .then(([stu, cls, trm]) => {
        const s = stu.data;
        setForm({
          admissionNumber: s.admissionNumber ?? "",
          firstName: s.firstName ?? "",
          lastName: s.lastName ?? "",
          middleName: s.middleName ?? "",
          gender: s.gender ?? "",
          dob: s.dob ? new Date(s.dob).toISOString().slice(0, 10) : "",
          status: s.status ?? "active",
        });
        setClasses(cls.data ?? []);
        setTerms(trm.data ?? []);
      })
      .catch((err: any) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [schoolSlug, studentId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission("students.edit")) return;
    setSaving(true);
    try {
      await api.patch(`/s/${schoolSlug}/api/students/${studentId}`, {
        admissionNumber: form.admissionNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName || undefined,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        status: form.status,
      });
      toast("Student updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const promoteStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promote.classId) return toast("Select a class", "error");
    try {
      await api.post(`/s/${schoolSlug}/api/students/${studentId}/promote`, {
        classId: promote.classId,
        termId: promote.termId || undefined,
      });
      toast("Student promoted to class", "success");
      setPromote({ classId: "", termId: "" });
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <Link to={`/s/${schoolSlug}/students`} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to students
          </Link>
          <h1 className="page-title">{form.firstName} {form.lastName}</h1>
          <p className="text-slate-400 mt-1 font-mono text-sm">{form.admissionNumber}</p>
        </div>
      </div>

      {hasPermission("students.edit") ? (
        <form onSubmit={save} className="card p-6 grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Admission number</label>
            <input className="input" required value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">First name</label>
            <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">Middle name</label>
            <input className="input" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="card p-6 grid md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-slate-500">Name</span><p className="text-white">{form.firstName} {form.lastName}</p></div>
          <div><span className="text-slate-500">Status</span><p className="text-white capitalize">{form.status}</p></div>
          <div><span className="text-slate-500">Gender</span><p className="text-white capitalize">{form.gender || "—"}</p></div>
        </div>
      )}

      {hasPermission("students.edit") && (
        <form onSubmit={promoteStudent} className="card p-6 space-y-4 max-w-xl">
          <h3 className="font-semibold text-white">Promote to class</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Class</label>
              <select className="input" required value={promote.classId} onChange={(e) => setPromote({ ...promote, classId: e.target.value })}>
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Term (optional)</label>
              <select className="input" value={promote.termId} onChange={(e) => setPromote({ ...promote, termId: e.target.value })}>
                <option value="">—</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary">Promote</button>
        </form>
      )}
    </div>
  );
};
