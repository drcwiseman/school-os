import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Loader2, ArrowLeft } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type GuardianRow = {
  guardian: { id: string; firstName: string; lastName: string; relationship: string; phone?: string; email?: string };
  isPrimary: boolean;
  portalEmail?: string | null;
  portalStatus?: string | null;
};

type StudentDoc = { id: string; documentType: string; fileName: string; createdAt: string };

export const StudentDetail: React.FC = () => {
  const { schoolSlug, studentId } = useParams<{ schoolSlug: string; studentId: string }>();
  const { hasPermission, moduleEnabled } = useAuth();
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
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [guardianForm, setGuardianForm] = useState({
    firstName: "", lastName: "", relationship: "", phone: "", email: "", isPrimary: false,
  });
  const [documents, setDocuments] = useState<StudentDoc[]>([]);
  const [docForm, setDocForm] = useState({ documentType: "", file: null as File | null });
  const [portalTarget, setPortalTarget] = useState<string | null>(null);
  const [portalForm, setPortalForm] = useState({ email: "", password: "" });

  const reloadGuardians = async () => {
    const g = await api.get(`/s/${schoolSlug}/api/students/${studentId}/guardians`);
    setGuardians(g.data ?? []);
  };

  const reloadDocuments = async () => {
    const d = await api.get(`/s/${schoolSlug}/api/students/${studentId}/documents`);
    setDocuments(d.data ?? []);
  };

  useEffect(() => {
    if (!schoolSlug || !studentId) return;
    setLoading(true);
    Promise.all([
      api.get(`/s/${schoolSlug}/api/students/${studentId}`),
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/terms`),
      api.get(`/s/${schoolSlug}/api/students/${studentId}/guardians`),
      api.get(`/s/${schoolSlug}/api/students/${studentId}/documents`),
    ])
      .then(([stu, cls, trm, g, docs]) => {
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
        setGuardians(g.data ?? []);
        setDocuments(docs.data ?? []);
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

  const addGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/students/${studentId}/guardians`, {
        firstName: guardianForm.firstName,
        lastName: guardianForm.lastName,
        relationship: guardianForm.relationship,
        phone: guardianForm.phone || undefined,
        email: guardianForm.email || undefined,
        isPrimary: guardianForm.isPrimary,
      });
      toast("Guardian added", "success");
      setGuardianForm({ firstName: "", lastName: "", relationship: "", phone: "", email: "", isPrimary: false });
      await reloadGuardians();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const createParentPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalTarget) return;
    try {
      await api.post(`/s/${schoolSlug}/api/students/${studentId}/guardians/${portalTarget}/parent-portal`, portalForm);
      toast("Parent portal account created", "success");
      setPortalTarget(null);
      setPortalForm({ email: "", password: "" });
      await reloadGuardians();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const uploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.file) return toast("Choose a file", "error");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        await api.post(`/s/${schoolSlug}/api/students/${studentId}/documents`, {
          documentType: docForm.documentType,
          fileName: docForm.file!.name,
          contentBase64: base64,
          mimeType: docForm.file!.type || undefined,
        });
        toast("Document uploaded", "success");
        setDocForm({ documentType: "", file: null });
        await reloadDocuments();
      } catch (err: any) {
        toast(err.message, "error");
      }
    };
    reader.readAsDataURL(docForm.file);
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

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-white">Guardians</h3>
        {guardians.length === 0 ? (
          <p className="text-sm text-slate-500">No guardians linked.</p>
        ) : (
          <ul className="space-y-2">
            {guardians.map((row) => (
              <li key={row.guardian.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border border-slate-700/50 rounded-lg px-3 py-2">
                <span className="text-white">
                  {row.guardian.firstName} {row.guardian.lastName}
                  <span className="text-slate-500"> · {row.guardian.relationship}</span>
                </span>
                <span className="flex items-center gap-2 text-slate-400 text-xs">
                  {row.isPrimary && <span className="badge-green">Primary</span>}
                  {row.portalEmail ? (
                    <span className="badge-blue">Portal: {row.portalEmail}</span>
                  ) : moduleEnabled("portal_enabled") && hasPermission("students.edit") ? (
                    <button type="button" className="btn-ghost text-xs" onClick={() => {
                      setPortalTarget(row.guardian.id);
                      setPortalForm({ email: row.guardian.email || "", password: "" });
                    }}>
                      Create portal login
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {hasPermission("students.edit") && (
          <form onSubmit={addGuardian} className="grid md:grid-cols-3 gap-3 pt-2 border-t border-slate-700/50">
            <input className="input" required placeholder="First name" value={guardianForm.firstName} onChange={(e) => setGuardianForm({ ...guardianForm, firstName: e.target.value })} />
            <input className="input" required placeholder="Last name" value={guardianForm.lastName} onChange={(e) => setGuardianForm({ ...guardianForm, lastName: e.target.value })} />
            <input className="input" required placeholder="Relationship" value={guardianForm.relationship} onChange={(e) => setGuardianForm({ ...guardianForm, relationship: e.target.value })} />
            <input className="input" placeholder="Phone" value={guardianForm.phone} onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={guardianForm.email} onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={guardianForm.isPrimary} onChange={(e) => setGuardianForm({ ...guardianForm, isPrimary: e.target.checked })} />
              Primary contact
            </label>
            <div className="md:col-span-3">
              <button type="submit" className="btn-primary">Add guardian</button>
            </div>
          </form>
        )}
        {portalTarget && hasPermission("students.edit") && (
          <form onSubmit={createParentPortal} className="grid md:grid-cols-3 gap-3 p-3 bg-slate-900/40 rounded-lg border border-primary-500/30">
            <input className="input" type="email" required placeholder="Portal email" value={portalForm.email} onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })} />
            <input className="input" type="password" required minLength={8} placeholder="Temporary password" value={portalForm.password} onChange={(e) => setPortalForm({ ...portalForm, password: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Create account</button>
              <button type="button" className="btn-ghost" onClick={() => setPortalTarget(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-white">Documents</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents on file.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between border border-slate-700/50 rounded-lg px-3 py-2">
                <span className="text-white">{doc.documentType} — {doc.fileName}</span>
                <a
                  className="text-primary-400 hover:text-primary-300 text-xs"
                  href={`${API_BASE}/s/${schoolSlug}/api/students/${studentId}/documents/${doc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
        {hasPermission("students.edit") && (
          <form onSubmit={uploadDocument} className="grid md:grid-cols-3 gap-3 pt-2 border-t border-slate-700/50">
            <input className="input" required placeholder="Document type" value={docForm.documentType} onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })} />
            <input className="input" type="file" required onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] ?? null })} />
            <button type="submit" className="btn-primary">Upload</button>
          </form>
        )}
      </div>

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
