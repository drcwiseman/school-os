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
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Student admission</h1>
      </div>
      <form onSubmit={submit} className="card p-6 space-y-6 max-w-4xl">
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Identity</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="label">Admission no.</label><input className="input" required value={form.admissionNumber} onChange={(e) => set("admissionNumber", e.target.value)} /></div>
            <div><label className="label">First name</label><input className="input" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></div>
            <div><label className="label">Last name</label><input className="input" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></div>
            <div><label className="label">Middle name</label><input className="input" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} /></div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label className="label">Date of birth</label><input className="input" type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></div>
            <div><label className="label">Blood group</label><input className="input" value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} placeholder="e.g. O+" /></div>
            <div><label className="label">Religion</label><input className="input" value={form.religion} onChange={(e) => set("religion", e.target.value)} /></div>
            <div><label className="label">Photo URL</label><input className="input" value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://…" /></div>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Contact</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="md:col-span-3"><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="md:col-span-3"><label className="label">Short bio</label><textarea className="input min-h-[80px]" value={form.shortBio} onChange={(e) => set("shortBio", e.target.value)} /></div>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Class placement</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Class</label>
              <select className="input" value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, streamId: "" }))}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stream / section</label>
              <select className="input" value={form.streamId} onChange={(e) => set("streamId", e.target.value)} disabled={!form.classId}>
                <option value="">—</option>
                {classStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Primary parent / guardian</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="label">First name</label><input className="input" value={form.parentFirstName} onChange={(e) => set("parentFirstName", e.target.value)} /></div>
            <div><label className="label">Last name</label><input className="input" value={form.parentLastName} onChange={(e) => set("parentLastName", e.target.value)} /></div>
            <div><label className="label">Relationship</label><input className="input" value={form.parentRelationship} onChange={(e) => set("parentRelationship", e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} /></div>
          </div>
        </section>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Complete admission"}
        </button>
      </form>
    </div>
  );
};
