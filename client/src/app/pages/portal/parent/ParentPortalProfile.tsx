import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { applyPortalTheme } from "../../../utils/theme";
import { resolvePortalMediaUrl } from "../../../utils/portal-media";
import {
  User,
  Sun,
  Moon,
  Save,
  KeyRound,
  Mail,
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { PasswordInput } from "../../../components/PasswordInput";
import { PortalImageUpload, fileToBase64Payload } from "../../../components/PortalImageUpload";

type PortalTheme = "light" | "dark";

type ProfileData = {
  account: { id: string; email: string; status: string };
  guardian: {
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    photoUrl?: string | null;
  };
  preferences: { theme: PortalTheme };
  photoUrl: string | null;
  hasPhoto: boolean;
  children: { id: string; firstName: string; lastName: string; admissionNumber: string }[];
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isSelf: boolean;
    students: { studentId: string; isPrimary: boolean }[];
  }[];
};

const emptyGuardian = {
  firstName: "",
  lastName: "",
  relationship: "parent",
  phone: "",
  email: "",
  address: "",
};

export const ParentPortalProfile: React.FC<{
  schoolSlug: string;
  theme: PortalTheme;
  onThemeChange: (t: PortalTheme) => void;
  onAccountEmailChange?: (email: string) => void;
}> = ({ schoolSlug, theme, onThemeChange, onAccountEmailChange }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [guardianForm, setGuardianForm] = useState(emptyGuardian);
  const [emailForm, setEmailForm] = useState({ email: "", currentPassword: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  const [contactMode, setContactMode] = useState<"list" | "create" | "edit">("list");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    ...emptyGuardian,
    studentId: "",
    isPrimary: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get(`/s/${schoolSlug}/api/portal/profile`);
      const data = res.data as ProfileData;
      setProfile(data);
      setGuardianForm({
        firstName: data.guardian.firstName,
        lastName: data.guardian.lastName,
        relationship: data.guardian.relationship,
        phone: data.guardian.phone ?? "",
        email: data.guardian.email ?? "",
        address: data.guardian.address ?? "",
      });
      setEmailForm({ email: data.account.email, currentPassword: "" });
      onThemeChange(data.preferences.theme);
      applyPortalTheme(data.preferences.theme, schoolSlug);
    } catch (e: any) {
      setErr(e.message ?? "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const photoPreview = useMemo(() => {
    if (!profile?.photoUrl) return "";
    return resolvePortalMediaUrl(profile.photoUrl, photoVersion);
  }, [profile?.photoUrl, photoVersion]);

  const flash = (text: string, isErr = false) => {
    if (isErr) {
      setErr(text);
      setMsg("");
    } else {
      setMsg(text);
      setErr("");
    }
    setTimeout(() => { setMsg(""); setErr(""); }, 4000);
  };

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const payload = await fileToBase64Payload(file);
      const res = await api.post(`/s/${schoolSlug}/api/portal/profile/photo`, payload);
      if (res.data?.profile) setProfile(res.data.profile);
      else await load();
      setPhotoVersion((v) => v + 1);
      flash("Profile photo saved");
    } catch (ex: any) {
      flash(ex.message ?? "Photo upload failed", true);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const clearPhoto = async () => {
    setUploadingPhoto(true);
    try {
      const res = await api.delete(`/s/${schoolSlug}/api/portal/profile/photo`);
      setProfile(res.data);
      setPhotoVersion((v) => v + 1);
      flash("Profile photo removed");
    } catch (ex: any) {
      flash(ex.message ?? "Could not remove photo", true);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch(`/s/${schoolSlug}/api/portal/profile`, guardianForm);
      setProfile(res.data);
      flash("Profile updated");
    } catch (ex: any) {
      flash(ex.message ?? "Update failed", true);
    } finally {
      setSaving(false);
    }
  };

  const saveTheme = async (mode: PortalTheme) => {
    onThemeChange(mode);
    applyPortalTheme(mode, schoolSlug);
    try {
      const res = await api.patch(`/s/${schoolSlug}/api/portal/profile/preferences`, { theme: mode });
      setProfile(res.data);
    } catch (ex: any) {
      flash(ex.message ?? "Could not save theme", true);
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch(`/s/${schoolSlug}/api/portal/profile/email`, emailForm);
      setProfile(res.data);
      setEmailForm((f) => ({ ...f, currentPassword: "" }));
      onAccountEmailChange?.(res.data.account.email);
      flash("Login email updated");
    } catch (ex: any) {
      flash(ex.message ?? "Email update failed", true);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      flash("New passwords do not match", true);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/s/${schoolSlug}/api/portal/profile/password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirm: "" });
      flash("Password updated");
    } catch (ex: any) {
      flash(ex.message ?? "Password update failed", true);
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (contactMode === "create") {
        const res = await api.post(`/s/${schoolSlug}/api/portal/profile/contacts`, contactForm);
        setProfile(res.data);
        flash("Contact added");
      } else if (editingContactId) {
        const { studentId: _s, isPrimary: _p, ...body } = contactForm;
        const res = await api.patch(`/s/${schoolSlug}/api/portal/profile/contacts/${editingContactId}`, body);
        setProfile(res.data);
        flash("Contact updated");
      }
      setContactMode("list");
      setEditingContactId(null);
    } catch (ex: any) {
      flash(ex.message ?? "Contact save failed", true);
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Remove this guardian contact from your children’s records?")) return;
    setSaving(true);
    try {
      const res = await api.delete(`/s/${schoolSlug}/api/portal/profile/contacts/${id}`);
      setProfile(res.data);
      flash("Contact removed");
    } catch (ex: any) {
      flash(ex.message ?? "Delete failed", true);
    } finally {
      setSaving(false);
    }
  };

  const startEditContact = (c: ProfileData["contacts"][0]) => {
    setEditingContactId(c.id);
    setContactMode("edit");
    setContactForm({
      firstName: c.firstName,
      lastName: c.lastName,
      relationship: c.relationship,
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      studentId: c.students[0]?.studentId ?? "",
      isPrimary: false,
    });
  };

  const startCreateContact = () => {
    setContactMode("create");
    setEditingContactId(null);
    setContactForm({
      ...emptyGuardian,
      studentId: profile?.children[0]?.id ?? "",
      isPrimary: false,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!profile) {
    return <p className="portal-empty text-sm text-center py-8">{err || "Profile unavailable"}</p>;
  }

  const otherContacts = profile.contacts.filter((c) => !c.isSelf);

  return (
    <div className="space-y-5">
      {msg && (
        <div className="text-sm portal-flash-success rounded-xl px-4 py-3">
          {msg}
        </div>
      )}
      {err && (
        <div className="text-sm text-red-600 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {err}
        </div>
      )}

      <section className="portal-panel rounded-2xl p-5">
        <PortalImageUpload
          label="Profile photo"
          hint="Optional — helps the school identify you on messages and records."
          previewSrc={photoPreview}
          uploading={uploadingPhoto}
          onUpload={uploadPhoto}
          onClear={profile.hasPhoto ? clearPhoto : undefined}
        />
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title text-base font-semibold flex items-center gap-2 mb-1">
          <Sun className="w-4 h-4 portal-accent-text" />
          Appearance
        </h2>
        <p className="portal-panel-subtitle text-xs mb-4">Choose light or dark mode for the parent portal</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => saveTheme("light")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
              theme === "light"
                ? "portal-theme-selected"
                : "portal-child-card border-[var(--portal-border)] text-[var(--portal-muted)]"
            }`}
          >
            <Sun className="w-4 h-4" /> Light
          </button>
          <button
            type="button"
            onClick={() => saveTheme("dark")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
              theme === "dark"
                ? "portal-theme-selected"
                : "portal-child-card border-[var(--portal-border)] text-[var(--portal-muted)]"
            }`}
          >
            <Moon className="w-4 h-4" /> Dark
          </button>
        </div>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title text-base font-semibold flex items-center gap-2 mb-1">
          <User className="w-4 h-4 portal-accent-text" />
          My details
        </h2>
        <p className="portal-panel-subtitle text-xs mb-4">Contact information the school has on file for you</p>
        <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-3">
          <ProfileField label="First name" value={guardianForm.firstName} onChange={(v) => setGuardianForm({ ...guardianForm, firstName: v })} required />
          <ProfileField label="Last name" value={guardianForm.lastName} onChange={(v) => setGuardianForm({ ...guardianForm, lastName: v })} required />
          <ProfileField label="Relationship" value={guardianForm.relationship} onChange={(v) => setGuardianForm({ ...guardianForm, relationship: v })} required className="sm:col-span-2" />
          <ProfileField label="Phone" value={guardianForm.phone} onChange={(v) => setGuardianForm({ ...guardianForm, phone: v })} />
          <ProfileField label="Email (contact)" value={guardianForm.email} onChange={(v) => setGuardianForm({ ...guardianForm, email: v })} type="email" />
          <ProfileField label="Address" value={guardianForm.address} onChange={(v) => setGuardianForm({ ...guardianForm, address: v })} className="sm:col-span-2" />
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 portal-btn-primary inline-flex items-center justify-center gap-2 rounded-xl text-sm py-2.5 font-medium disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> Save profile
          </button>
        </form>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title text-base font-semibold flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 portal-accent-text" />
          Portal login email
        </h2>
        <p className="portal-panel-subtitle text-xs mb-4">Email used to sign in to this portal</p>
        <form onSubmit={saveEmail} className="space-y-3 max-w-md">
          <ProfileField label="Login email" value={emailForm.email} onChange={(v) => setEmailForm({ ...emailForm, email: v })} type="email" required />
          <ProfileField
            label="Current password"
            value={emailForm.currentPassword}
            onChange={(v) => setEmailForm({ ...emailForm, currentPassword: v })}
            type="password"
            required
          />
          <button type="submit" disabled={saving} className="portal-btn-primary rounded-xl text-sm px-4 py-2 font-medium disabled:opacity-60">
            Update login email
          </button>
        </form>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title text-base font-semibold flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 portal-accent-text" />
          Password
        </h2>
        <form onSubmit={savePassword} className="space-y-3 max-w-md">
          <ProfileField label="Current password" value={passwordForm.currentPassword} onChange={(v) => setPasswordForm({ ...passwordForm, currentPassword: v })} type="password" required />
          <ProfileField label="New password" value={passwordForm.newPassword} onChange={(v) => setPasswordForm({ ...passwordForm, newPassword: v })} type="password" required />
          <ProfileField label="Confirm new password" value={passwordForm.confirm} onChange={(v) => setPasswordForm({ ...passwordForm, confirm: v })} type="password" required />
          <button type="submit" disabled={saving} className="rounded-xl border border-[var(--portal-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--portal-bg-muted)] disabled:opacity-60">
            Change password
          </button>
        </form>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="portal-panel-title text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 portal-accent-text" />
              Family contacts
            </h2>
            <p className="portal-panel-subtitle text-xs mt-1">Other guardians linked to your children</p>
          </div>
          {contactMode === "list" && (
            <button
              type="button"
              onClick={startCreateContact}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs px-3 py-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add contact
            </button>
          )}
        </div>

        {contactMode !== "list" ? (
          <form onSubmit={saveContact} className="space-y-3 border border-[var(--portal-border)] rounded-xl p-4">
            {contactMode === "create" && (
              <label className="block text-xs text-[var(--portal-subtle)]">
                Child
                <select
                  className="portal-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
                  value={contactForm.studentId}
                  onChange={(e) => setContactForm({ ...contactForm, studentId: e.target.value })}
                  required
                >
                  {profile.children.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <ProfileField label="First name" value={contactForm.firstName} onChange={(v) => setContactForm({ ...contactForm, firstName: v })} required />
              <ProfileField label="Last name" value={contactForm.lastName} onChange={(v) => setContactForm({ ...contactForm, lastName: v })} required />
              <ProfileField label="Relationship" value={contactForm.relationship} onChange={(v) => setContactForm({ ...contactForm, relationship: v })} required className="sm:col-span-2" />
              <ProfileField label="Phone" value={contactForm.phone} onChange={(v) => setContactForm({ ...contactForm, phone: v })} />
              <ProfileField label="Email" value={contactForm.email} onChange={(v) => setContactForm({ ...contactForm, email: v })} type="email" />
            </div>
            {contactMode === "create" && (
              <label className="flex items-center gap-2 text-sm text-[var(--portal-muted)]">
                <input
                  type="checkbox"
                  checked={contactForm.isPrimary}
                  onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                />
                Primary contact for this child
              </label>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-teal-600 text-white text-sm px-4 py-2">Save</button>
              <button type="button" className="rounded-lg border border-[var(--portal-border)] text-sm px-4 py-2" onClick={() => setContactMode("list")}>
                Cancel
              </button>
            </div>
          </form>
        ) : otherContacts.length === 0 ? (
          <p className="portal-empty text-sm text-center py-6">No other guardians listed. Add a spouse, relative, or pickup contact.</p>
        ) : (
          <ul className="space-y-3">
            {otherContacts.map((c) => (
              <li key={c.id} className="rounded-xl border border-[var(--portal-border)] p-4 bg-[var(--portal-bg-muted)]">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--portal-fg-strong)]">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-[var(--portal-muted)] capitalize">{c.relationship}</p>
                    {c.phone && <p className="text-sm text-[var(--portal-muted)] mt-1">{c.phone}</p>}
                    {c.email && <p className="text-sm text-[var(--portal-muted)]">{c.email}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className="p-2 rounded-lg border border-[var(--portal-border)] text-[var(--portal-muted)] hover:text-teal-600" onClick={() => startEditContact(c)} aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 rounded-lg border border-[var(--portal-border)] text-[var(--portal-muted)] hover:text-red-500" onClick={() => deleteContact(c.id)} aria-label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

function ProfileField({
  label,
  value,
  onChange,
  type = "text",
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  const fieldClass = "portal-input mt-1 w-full rounded-lg px-3 py-2 text-sm";

  return (
    <label className={`block text-xs text-[var(--portal-subtle)] ${className}`}>
      {label}
      {type === "password" ? (
        <PasswordInput
          required={required}
          className={fieldClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          required={required}
          className={fieldClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
