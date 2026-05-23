import React, { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Save, Loader2, Clock } from "lucide-react";

type BioForm = {
  phone: string;
  email: string;
  address: string;
  shortBio: string;
  emergencyContact: string;
  emergencyPhone: string;
};

export const StudentProgrammeBio: React.FC<{
  schoolSlug: string;
  student: any;
  pendingProfile?: Record<string, string> | null;
  profilePendingApproval?: boolean;
  onSubmitted?: () => void;
}> = ({ schoolSlug, student, pendingProfile, profilePendingApproval, onSubmitted }) => {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState<BioForm>({
    phone: "",
    email: "",
    address: "",
    shortBio: "",
    emergencyContact: "",
    emergencyPhone: "",
  });

  useEffect(() => {
    const src = pendingProfile ?? profileRowsFromStudent(student);
    setForm({
      phone: src.phone ?? "",
      email: src.email ?? "",
      address: src.address ?? "",
      shortBio: src.shortBio ?? "",
      emergencyContact: src.emergencyContact ?? "",
      emergencyPhone: src.emergencyPhone ?? "",
    });
  }, [student, pendingProfile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await api.patch(`/s/${schoolSlug}/api/portal/profile`, form);
      setMsg(res.message ?? "Bio submitted for admin approval");
      onSubmitted?.();
    } catch (ex: any) {
      setErr(ex.message ?? "Could not submit bio");
    } finally {
      setSaving(false);
    }
  };

  const live = profileRowsFromStudent(student);

  return (
    <div className="space-y-4">
      {profilePendingApproval && (
        <div className="flex items-center gap-2 text-sm portal-flash-success rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 shrink-0" />
          You have bio changes waiting for admin approval. Live profile still shows the approved version below.
        </div>
      )}
      {msg && <p className="text-sm portal-flash-success rounded-xl px-4 py-2">{msg}</p>}
      {err && <p className="text-sm text-red-700 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">{err}</p>}

      <div className="rounded-xl border border-[var(--portal-border)] p-4 bg-[var(--portal-bg-muted)]">
        <p className="text-xs uppercase tracking-wide text-[var(--portal-subtle)] mb-2">Live (approved)</p>
        <dl className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><dt className="text-[var(--portal-subtle)]">Phone</dt><dd>{live.phone || "—"}</dd></div>
          <div><dt className="text-[var(--portal-subtle)]">Email</dt><dd>{live.email || "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--portal-subtle)]">Address</dt><dd>{live.address || "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--portal-subtle)]">Bio</dt><dd className="whitespace-pre-wrap">{live.shortBio || "—"}</dd></div>
        </dl>
      </div>

      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <p className="sm:col-span-2 text-xs text-[var(--portal-subtle)]">
          Edit your bio here. Changes go to the school for approval before they appear as live.
        </p>
        <label className="text-xs text-[var(--portal-subtle)] sm:col-span-2">
          Phone
          <input className="portal-input w-full mt-1 rounded-lg text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--portal-subtle)] sm:col-span-2">
          Contact email
          <input type="email" className="portal-input w-full mt-1 rounded-lg text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--portal-subtle)] sm:col-span-2">
          Address
          <input className="portal-input w-full mt-1 rounded-lg text-sm" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--portal-subtle)] sm:col-span-2">
          Short bio
          <textarea className="portal-input w-full mt-1 rounded-lg text-sm min-h-[80px]" value={form.shortBio} onChange={(e) => setForm({ ...form, shortBio: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--portal-subtle)]">
          Emergency contact
          <input className="portal-input w-full mt-1 rounded-lg text-sm" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
        </label>
        <label className="text-xs text-[var(--portal-subtle)]">
          Emergency phone
          <input className="portal-input w-full mt-1 rounded-lg text-sm" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
        </label>
        <button type="submit" disabled={saving} className="sm:col-span-2 portal-btn-primary inline-flex items-center justify-center gap-2 rounded-lg text-sm py-2.5 font-medium disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Submit for approval
        </button>
      </form>
    </div>
  );
};

function profileRowsFromStudent(student: any) {
  return {
    phone: student?.phone ?? "",
    email: student?.email ?? "",
    address: student?.address ?? "",
    shortBio: student?.shortBio ?? "",
    emergencyContact: student?.emergencyContact ?? student?.medicalJson?.emergencyContact ?? "",
    emergencyPhone: student?.emergencyPhone ?? student?.medicalJson?.emergencyPhone ?? "",
  };
}
