import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { Student360Tabs, DOC_TYPES } from "../components/Student360Tabs";
import { PasswordInput } from "../components/PasswordInput";

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
  const [portalAccount, setPortalAccount] = useState<{ email: string; status: string } | null>(null);
  const [studentPortalForm, setStudentPortalForm] = useState({ email: "", password: "" });
  const [pendingProfile, setPendingProfile] = useState<Record<string, unknown> | null>(null);

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
        setPortalAccount(s.portalAccount ?? null);
        setPendingProfile(s.pendingProfileJson ?? null);
        setStudentPortalForm({ email: "", password: "" });
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

  const createStudentPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/students/${studentId}/student-portal`, studentPortalForm);
      toast("Student portal account created", "success");
      setStudentPortalForm({ email: "", password: "" });
      const stu = await api.get(`/s/${schoolSlug}/api/students/${studentId}`);
      setPortalAccount(stu.data?.portalAccount ?? null);
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
      <div className="pb-2 border-b border-slate-700/40">
        <Link 
          to={`/s/${schoolSlug}/students`} 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Student Directory
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{form.firstName} {form.lastName}</h1>
            <p className="text-slate-400 mt-1 font-mono text-sm tracking-wider font-semibold">Adm. No: {form.admissionNumber}</p>
          </div>
          <div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              form.status === 'active' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }`}>
              {form.status}
            </span>
          </div>
        </div>
      </div>

      {pendingProfile && hasPermission("students.edit") && (
        <div className="card p-4 border border-amber-500/30 bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-200 mb-2">Pending portal bio changes</p>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap mb-3">{JSON.stringify(pendingProfile, null, 2)}</pre>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={async () => {
                await api.post(`/s/${schoolSlug}/api/students/${studentId}/profile-pending/approve`);
                toast("Bio approved and live", "success");
                setPendingProfile(null);
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={async () => {
                await api.post(`/s/${schoolSlug}/api/students/${studentId}/profile-pending/reject`);
                toast("Pending bio rejected", "success");
                setPendingProfile(null);
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {hasPermission("students.edit") ? (
        <form onSubmit={save} className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-blue-500 h-4 rounded-full" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">Identity Details</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Admission number</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">First name</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Last name</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Middle name</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Gender</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Date of birth</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Status</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-800/80">
            <button 
              type="submit" 
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200" 
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 grid md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-slate-500 uppercase text-xs font-semibold">Name</span><p className="text-white font-medium text-base mt-0.5">{form.firstName} {form.lastName}</p></div>
          <div><span className="text-slate-500 uppercase text-xs font-semibold">Status</span><p className="text-white capitalize font-medium text-base mt-0.5">{form.status}</p></div>
          <div><span className="text-slate-500 uppercase text-xs font-semibold">Gender</span><p className="text-white capitalize font-medium text-base mt-0.5">{form.gender || "—"}</p></div>
        </div>
      )}

      {moduleEnabled("portal_enabled") && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-purple-500 h-4 rounded-full" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">Student Portal Account</h3>
          </div>
          {portalAccount ? (
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
              <span className="text-sm text-slate-300">Login email: <span className="text-blue-400 font-medium font-mono">{portalAccount.email}</span></span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${portalAccount.status === 'active' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-slate-800 text-slate-400'}`}>
                {portalAccount.status}
              </span>
            </div>
          ) : hasPermission("students.edit") ? (
            <form onSubmit={createStudentPortal} className="grid md:grid-cols-3 gap-3">
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="email" required placeholder="Portal email" value={studentPortalForm.email} onChange={(e) => setStudentPortalForm({ ...studentPortalForm, email: e.target.value })} />
              <PasswordInput className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required minLength={8} placeholder="Temporary password" value={studentPortalForm.password} onChange={(e) => setStudentPortalForm({ ...studentPortalForm, password: e.target.value })} autoComplete="new-password" />
              <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200">
                Create Student Login
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-500 italic">No portal account created yet.</p>
          )}
        </div>
      )}

      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
          <div className="w-1 bg-pink-500 h-4 rounded-full" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">Linked Guardians</h3>
        </div>
        {guardians.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No guardian contacts linked to this profile.</p>
        ) : (
          <ul className="space-y-2">
            {guardians.map((row) => (
              <li key={row.guardian.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border border-slate-800 bg-slate-950/20 rounded-xl px-4 py-3 hover:border-slate-700/60 transition-all">
                <span className="text-white font-medium">
                  {row.guardian.firstName} {row.guardian.lastName}
                  <span className="text-slate-450 font-normal"> · {row.guardian.relationship}</span>
                </span>
                <span className="flex items-center gap-2 text-slate-400 text-xs">
                  {row.isPrimary && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Primary</span>}
                  {row.portalEmail ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">Portal: {row.portalEmail}</span>
                  ) : moduleEnabled("portal_enabled") && hasPermission("students.edit") ? (
                    <button 
                      type="button" 
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-700 hover:border-slate-650 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white transition-all shadow-sm" 
                      onClick={() => {
                        setPortalTarget(row.guardian.id);
                        setPortalForm({ email: row.guardian.email || "", password: "" });
                      }}
                    >
                      Create Portal Login
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        
        {hasPermission("students.edit") && (
          <form onSubmit={addGuardian} className="grid md:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
            <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required placeholder="First name" value={guardianForm.firstName} onChange={(e) => setGuardianForm({ ...guardianForm, firstName: e.target.value })} />
            <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required placeholder="Last name" value={guardianForm.lastName} onChange={(e) => setGuardianForm({ ...guardianForm, lastName: e.target.value })} />
            <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required placeholder="Relationship" value={guardianForm.relationship} onChange={(e) => setGuardianForm({ ...guardianForm, relationship: e.target.value })} />
            <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Phone" value={guardianForm.phone} onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })} />
            <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="email" placeholder="Email" value={guardianForm.email} onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900" checked={guardianForm.isPrimary} onChange={(e) => setGuardianForm({ ...guardianForm, isPrimary: e.target.checked })} />
              <span>Primary Contact</span>
            </label>
            <div className="md:col-span-3 flex justify-end">
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200">
                Add Guardian Contact
              </button>
            </div>
          </form>
        )}
        
        {portalTarget && hasPermission("students.edit") && (
          <form onSubmit={createParentPortal} className="grid md:grid-cols-3 gap-3 p-4 bg-slate-950/40 rounded-xl border border-blue-500/20 shadow-md">
            <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="email" required placeholder="Portal email" value={portalForm.email} onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })} />
            <PasswordInput className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required minLength={8} placeholder="Temporary password" value={portalForm.password} onChange={(e) => setPortalForm({ ...portalForm, password: e.target.value })} autoComplete="new-password" />
            <div className="flex gap-2 items-center">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200">Create Account</button>
              <button type="button" className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-350 hover:text-white text-xs font-semibold transition-all" onClick={() => setPortalTarget(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
          <div className="w-1 bg-emerald-500 h-4 rounded-full" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">Verification Documents</h3>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No verification documents uploaded on file.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between border border-slate-800 bg-slate-950/20 rounded-xl px-4 py-3">
                <span className="text-white font-medium">{doc.documentType.replace(/_/g, " ")} <span className="text-slate-500 text-xs font-normal">({doc.fileName})</span></span>
                <a
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-all border border-slate-700/60 shadow-sm"
                  href={`${API_BASE}/s/${schoolSlug}/api/students/${studentId}/documents/${doc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download File
                </a>
              </li>
            ))}
          </ul>
        )}
        
        {hasPermission("students.edit") && (
          <form onSubmit={uploadDocument} className="grid md:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
            <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={docForm.documentType} onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}>
              <option value="">Document type</option>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input className="w-full px-3 py-1.5 bg-slate-950 border border-slate-750 rounded-xl text-slate-300 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 transition-all cursor-pointer" type="file" required onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] ?? null })} />
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200">
              Upload Document
            </button>
          </form>
        )}
      </div>

      {hasPermission("students.edit") && (
        <form onSubmit={promoteStudent} className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-4 max-w-xl">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-amber-500 h-4 rounded-full" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">Promote to Class</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Class</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={promote.classId} onChange={(e) => setPromote({ ...promote, classId: e.target.value })}>
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Term (optional)</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={promote.termId} onChange={(e) => setPromote({ ...promote, termId: e.target.value })}>
                <option value="">—</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200">
              Confirm Promotion
            </button>
          </div>
        </form>
      )}

      <Student360Tabs schoolSlug={schoolSlug!} studentId={studentId!} />
    </div>
  );
};
