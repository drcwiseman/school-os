import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { useAuth } from "../state/AuthContext";
import {
  Plus, CheckCircle, Clock, XCircle, FileText, UserPlus, LayoutTemplate,
  Calendar, Loader2, ShieldCheck, ShieldAlert, Download, Search,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const PIPELINE_STAGES = ["inquiry", "interview", "offered", "rejected", "enrolled"] as const;

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  createdAt: string;
  convertedTo: string | null;
  formId?: string | null;
  customFields?: Record<string, any>;
}

interface AdmissionForm {
  id: string;
  name: string;
}

interface FormField {
  id: string;
  fieldName: string;
  fieldKey: string;
  fieldType: string;
  optionsJson: string[] | null;
  isRequired: boolean;
}

export const Admissions: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newApplicant, setNewApplicant] = useState({ firstName: "", lastName: "", email: "" });
  const [enrollTarget, setEnrollTarget] = useState<Applicant | null>(null);
  const [enrollAdmNo, setEnrollAdmNo] = useState("");
  const [enrolledStudentId, setEnrolledStudentId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [timelineTarget, setTimelineTarget] = useState<Applicant | null>(null);
  const [events, setEvents] = useState<{ id: string; eventType: string; notes: string; createdAt: string; actorEmail?: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [applicantDocs, setApplicantDocs] = useState<{ id: string; documentType: string; fileUrl: string; status: string }[]>([]);
  const [appDocForm, setAppDocForm] = useState({ documentType: "", file: null as File | null });

  const [forms, setForms] = useState<AdmissionForm[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchApplicants();
    fetchForms();
  }, [schoolSlug]);

  const fetchForms = async () => {
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admission-forms`);
      setForms(res.data || []);
      if (res.data?.length > 0) {
        setSelectedFormId(res.data[0].id);
        fetchFields(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFields = async (formId: string) => {
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admission-forms/${formId}/fields`);
      setFields(res.data || []);
      setCustomFieldsData({});
    } catch (err) {
      console.error(err);
    }
  };

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admissions`);
      setApplicants(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newApplicant,
        formId: selectedFormId || null,
        customFields: customFieldsData,
      };
      await api.post(`/s/${schoolSlug}/api/admissions`, payload);
      setShowAdd(false);
      setNewApplicant({ firstName: "", lastName: "", email: "" });
      setCustomFieldsData({});
      toast("Applicant added", "success");
      fetchApplicants();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const updateStage = async (id: string, stage: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/admissions/${id}/stage`, { stage });
      toast("Stage updated", "success");
      fetchApplicants();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const openTimeline = async (app: Applicant) => {
    if (timelineTarget?.id === app.id) {
      setTimelineTarget(null);
      return;
    }
    setTimelineTarget(app);
    setEnrollTarget(null);
    setNoteText("");
    setEventsLoading(true);
    try {
      const [ev, docs] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/admissions/${app.id}/events`),
        api.get(`/s/${schoolSlug}/api/admissions/${app.id}/documents`),
      ]);
      setEvents(ev.data ?? []);
      setApplicantDocs(docs.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setEventsLoading(false);
    }
  };

  const uploadApplicantDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineTarget || !appDocForm.file) return toast("Choose a file", "error");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        await api.post(`/s/${schoolSlug}/api/admissions/${timelineTarget.id}/documents`, {
          documentType: appDocForm.documentType,
          fileName: appDocForm.file!.name,
          contentBase64: base64,
          mimeType: appDocForm.file!.type || undefined,
        });
        toast("Document uploaded", "success");
        setAppDocForm({ documentType: "", file: null });
        const docs = await api.get(`/s/${schoolSlug}/api/admissions/${timelineTarget.id}/documents`);
        setApplicantDocs(docs.data ?? []);
      } catch (err: any) {
        toast(err.message, "error");
      }
    };
    reader.readAsDataURL(appDocForm.file);
  };

  const updateApplicantDocStatus = async (docId: string, status: "verified" | "rejected") => {
    if (!timelineTarget) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/admissions/${timelineTarget.id}/documents/${docId}`, { status });
      toast(`Document ${status}`, "success");
      const docs = await api.get(`/s/${schoolSlug}/api/admissions/${timelineTarget.id}/documents`);
      setApplicantDocs(docs.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineTarget || !noteText.trim()) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admissions/${timelineTarget.id}/events`, {
        eventType: "note",
        notes: noteText.trim(),
      });
      toast("Note added", "success");
      setNoteText("");
      const res = await api.get(`/s/${schoolSlug}/api/admissions/${timelineTarget.id}/events`);
      setEvents(res.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const openEnroll = (app: Applicant) => {
    setEnrollTarget(app);
    setTimelineTarget(null);
    setEnrollAdmNo("");
    setEnrolledStudentId(null);
  };

  const submitEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTarget || !enrollAdmNo.trim()) return;
    setEnrolling(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/admissions/${enrollTarget.id}/enroll`, {
        admissionNumber: enrollAdmNo.trim(),
      });
      const studentId = res.data?.student?.id;
      setEnrolledStudentId(studentId ?? null);
      toast("Applicant enrolled as student", "success");
      fetchApplicants();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setEnrolling(false);
    }
  };

  const getStageBadge = (stage: string, convertedTo: string | null) => {
    if (convertedTo) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"><CheckCircle className="w-3.5 h-3.5" /> Enrolled</span>;
    if (stage === "rejected") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30"><XCircle className="w-3.5 h-3.5" /> Rejected</span>;
    if (stage === "offered") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30"><CheckCircle className="w-3.5 h-3.5" /> Offered</span>;
    if (stage === "interview") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"><Calendar className="w-3.5 h-3.5" /> Interviewing</span>;
    
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300 border border-slate-200 dark:border-slate-600"><Clock className="w-3.5 h-3.5" /> Inquiry</span>;
  };

  return (
    <div className="relative space-y-6 animate-fade-in pb-10">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent dark:from-blue-500/5 -z-10" />

      <header className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Admissions Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage student inquiries, applications, and enrollments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasPermission("admissions.edit") && (
            <Link to={`/s/${schoolSlug}/admissions/settings`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors">
              <LayoutTemplate className="w-4 h-4" /> Form Builder
            </Link>
          )}
          <button 
            type="button" 
            onClick={() => setShowAdd(!showAdd)} 
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> 
            {showAdd ? "Cancel" : "New Inquiry"}
          </button>
        </div>
      </header>

      {showAdd && (
        <div className="rounded-2xl border border-blue-200/60 bg-white/70 dark:border-blue-700/40 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg animate-slide-up">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Add New Applicant</h3>
            {forms.length > 0 && (
              <select 
                className="input py-1.5 px-3 text-sm bg-white dark:bg-slate-800 w-auto" 
                value={selectedFormId} 
                onChange={e => { setSelectedFormId(e.target.value); fetchFields(e.target.value); }}
              >
                {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input required className="input bg-white dark:bg-slate-800" placeholder="First Name" value={newApplicant.firstName} onChange={(e) => setNewApplicant({ ...newApplicant, firstName: e.target.value })} />
              <input required className="input bg-white dark:bg-slate-800" placeholder="Last Name" value={newApplicant.lastName} onChange={(e) => setNewApplicant({ ...newApplicant, lastName: e.target.value })} />
              <input type="email" className="input bg-white dark:bg-slate-800" placeholder="Email (Optional)" value={newApplicant.email} onChange={(e) => setNewApplicant({ ...newApplicant, email: e.target.value })} />
            </div>
            
            {fields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2"><LayoutTemplate className="w-4 h-4"/> Custom Requirements</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-slate-500 mb-1">{field.fieldName}</label>
                      <input 
                        type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                        required={field.isRequired}
                        className="input bg-white dark:bg-slate-800 text-sm" 
                        placeholder={`Enter ${field.fieldName}`} 
                        value={customFieldsData[field.fieldKey] || ''} 
                        onChange={(e) => setCustomFieldsData({ ...customFieldsData, [field.fieldKey]: e.target.value })} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">Save Applicant</button>
            </div>
          </form>
        </div>
      )}

      {enrollTarget && (
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-700/40 dark:bg-emerald-900/20 p-6 backdrop-blur-xl shadow-lg animate-slide-up">
          <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Enroll {enrollTarget.firstName} {enrollTarget.lastName}
          </h3>
          {enrolledStudentId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-100 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-200">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <p className="font-medium text-sm">Student record created successfully.</p>
              </div>
              <div className="flex gap-3">
                <Link to={`/s/${schoolSlug}/students/${enrolledStudentId}`} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
                  View student profile
                </Link>
                <button type="button" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-200 dark:text-emerald-300 dark:hover:bg-emerald-800 transition-colors" onClick={() => setEnrollTarget(null)}>Close</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitEnroll} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full sm:min-w-[200px]">
                <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-400/70">Assign Admission Number</label>
                <input
                  className="input bg-white dark:bg-slate-900 focus:border-emerald-500 focus:ring-emerald-500/20"
                  required
                  placeholder="e.g. 2026-001"
                  value={enrollAdmNo}
                  onChange={(e) => setEnrollAdmNo(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all hover:shadow-md disabled:opacity-50" disabled={enrolling}>
                {enrolling ? "Enrolling…" : "Confirm Enrollment"}
              </button>
              <button type="button" className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-200 dark:text-emerald-300 dark:hover:bg-emerald-800 transition-colors" onClick={() => setEnrollTarget(null)}>Cancel</button>
            </form>
          )}
        </div>
      )}

      {timelineTarget && (
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-700/40 dark:bg-indigo-900/10 p-6 backdrop-blur-xl shadow-lg animate-slide-up space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-indigo-100 dark:border-indigo-800/50">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Applicant File: {timelineTarget.firstName} {timelineTarget.lastName}
            </h3>
            <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => setTimelineTarget(null)}>
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {timelineTarget.customFields && Object.keys(timelineTarget.customFields).length > 0 && (
            <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Custom Form Data</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(timelineTarget.customFields).map(([key, value]) => (
                  <div key={key}>
                    <span className="block text-xs text-slate-500 uppercase">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{String(value) || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Timeline Events */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Activity Timeline</h4>
              
              {eventsLoading ? (
                <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
              ) : events.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl">No events recorded yet.</p>
              ) : (
                <ul className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {events.map((ev) => (
                    <li key={ev.id} className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-16px] before:w-px before:bg-indigo-200 dark:before:bg-indigo-800/50 last:before:hidden">
                      <div className="absolute left-0 top-1.5 w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      </div>
                      <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{ev.notes}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize">{ev.eventType}</span>
                          {" • "}{ev.actorEmail ?? "system"} • {new Date(ev.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {hasPermission("admissions.edit") && (
                <form onSubmit={addNote} className="flex gap-2 pt-2">
                  <input className="input bg-white dark:bg-slate-900 flex-1" placeholder="Log a call, email, or note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">Post</button>
                </form>
              )}
            </div>

            {/* Documents */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Application Documents</h4>
              
              {applicantDocs.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl">No documents uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {applicantDocs.map((d) => (
                    <li key={d.id} className="flex flex-wrap justify-between items-center gap-3 p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.documentType}</p>
                          <span className={`text-[10px] uppercase tracking-wider font-bold ${
                            d.status === 'verified' ? 'text-emerald-500' : d.status === 'rejected' ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {d.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 items-center">
                        {d.status === "pending" && hasPermission("admissions.edit") && (
                          <>
                            <button type="button" className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 rounded-lg transition-colors tooltip" title="Verify" onClick={() => updateApplicantDocStatus(d.id, "verified")}>
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                            <button type="button" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors tooltip" title="Reject" onClick={() => updateApplicantDocStatus(d.id, "rejected")}>
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <a className="p-1.5 ml-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 rounded-lg transition-colors" href={`${API_BASE}/s/${schoolSlug}/api/admissions/${timelineTarget.id}/documents/${d.id}/file`} target="_blank" rel="noreferrer" title="Download">
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {hasPermission("admissions.edit") && (
                <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                  <form onSubmit={uploadApplicantDoc} className="space-y-3">
                    <input className="input bg-white dark:bg-slate-800 text-sm" required placeholder="e.g., Birth Certificate, Transcripts" value={appDocForm.documentType} onChange={(e) => setAppDocForm({ ...appDocForm, documentType: e.target.value })} />
                    <div className="flex gap-2">
                      <input className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 dark:hover:file:bg-indigo-900/50 cursor-pointer" type="file" required onChange={(e) => setAppDocForm({ ...appDocForm, file: e.target.files?.[0] ?? null })} />
                      <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">Upload</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/60 bg-white/50 dark:border-slate-700/60 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Applicants</h2>
          <div className="relative max-w-md w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by name or email..." className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-700/60">
                <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Applicant</th>
                <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Contact</th>
                <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Pipeline Stage</th>
                <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Applied Date</th>
                <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : applicants.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-500 dark:text-slate-400">No applicants in the pipeline.</td></tr>
              ) : applicants.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 shadow-sm">
                        {app.firstName.charAt(0)}{app.lastName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white block">{app.firstName} {app.lastName}</span>
                        <span className="text-xs text-slate-500">ID: {app.id.split('-')[0]}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{app.email || "-"}</td>
                  <td className="px-5 py-4">
                    {!app.convertedTo ? (
                      <select
                        className="bg-transparent text-sm font-semibold capitalize border-none outline-none focus:ring-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 py-1 -ml-2 transition-colors"
                        value={app.stage}
                        onChange={(e) => updateStage(app.id, e.target.value)}
                      >
                        {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        {getStageBadge(app.stage, app.convertedTo)}
                        <Link to={`/s/${schoolSlug}/students/${app.convertedTo}`} className="ml-2 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">
                          View Student →
                        </Link>
                      </div>
                    )}
                    {!app.convertedTo && <div className="mt-2">{getStageBadge(app.stage, app.convertedTo)}</div>}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium">
                    {new Date(app.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-5 py-4 text-right space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 shadow-sm transition-all" onClick={() => openTimeline(app)}>
                      File & Timeline
                    </button>
                    {!app.convertedTo && hasPermission("admissions.enroll") && (
                      <button type="button" onClick={() => openEnroll(app)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20 shadow-sm transition-all">
                        <UserPlus className="w-3.5 h-3.5 inline mr-1" /> Enroll
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
