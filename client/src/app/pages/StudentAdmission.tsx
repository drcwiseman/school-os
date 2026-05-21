import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { useAuth } from "../state/AuthContext";
import { Loader2 } from "lucide-react";

type ClassRow = { id: string; name: string };
type StreamRow = { id: string; name: string; classId: string };

const empty = {
  admissionNumber: "",
  firstName: "",
  lastName: "",
  middleName: "",
  gender: "",
  dob: "",
  bloodGroup: "",
  religion: "",
  phone: "",
  email: "",
  address: "",
  shortBio: "",
  photoUrl: "",
  classId: "",
  streamId: "",
  parentFirstName: "",
  parentLastName: "",
  parentPhone: "",
  parentEmail: "",
  parentRelationship: "parent",
};

export const StudentAdmission: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(empty);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/classes`).then((r) => setClasses(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => {
    if (!form.classId) { setStreams([]); return; }
    api.get(`/s/${schoolSlug}/api/academics/classes/${form.classId}/streams`)
      .then((r) => setStreams((r.data ?? []).map((s: StreamRow) => ({ ...s, classId: form.classId }))))
      .catch(() => setStreams([]));
  }, [schoolSlug, form.classId]);

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const classStreams = streams.filter((s) => s.classId === form.classId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/students`, {
        ...form,
        middleName: form.middleName || undefined,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        classId: form.classId || undefined,
        streamId: form.streamId || undefined,
        email: form.email || undefined,
      });
      toast("Student admitted", "success");
      const id = res.data?.id;
      navigate(id ? `/s/${schoolSlug}/students/${id}` : `/s/${schoolSlug}/students`);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission("students.create")) {
    return <p className="text-slate-400">You do not have permission to add students.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/40">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student Admission</h1>
          <p className="text-slate-400 text-sm mt-1">Register and admit a new student into the school directory.</p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 space-y-8 max-w-4xl">
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-blue-500 h-4 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Identity Details</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Admission no. *</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={form.admissionNumber} onChange={(e) => set("admissionNumber", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">First name *</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Last name *</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Middle name</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Gender</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Date of birth</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Blood group</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} placeholder="e.g. O+" />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Religion</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.religion} onChange={(e) => set("religion", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Photo URL</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://…" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-indigo-500 h-4 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Contact Details</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Phone</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Email</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Address</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Short bio</label>
              <textarea className="w-full px-4 py-3 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[80px]" value={form.shortBio} onChange={(e) => set("shortBio", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-emerald-500 h-4 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Class Placement</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Class</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-105 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, streamId: "" }))}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Stream / Section</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-105 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.streamId} onChange={(e) => set("streamId", e.target.value)} disabled={!form.classId}>
                <option value="">—</option>
                {classStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <div className="w-1 bg-pink-500 h-4 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Primary Parent / Guardian</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">First name</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.parentFirstName} onChange={(e) => set("parentFirstName", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Last name</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.parentLastName} onChange={(e) => set("parentLastName", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Relationship</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.parentRelationship} onChange={(e) => set("parentRelationship", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Phone</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Email</label>
              <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" type="email" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4 border-t border-slate-800/80">
          <button 
            type="submit" 
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 flex items-center gap-2" 
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Admitting Student…
              </>
            ) : (
              "Complete Admission"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
