import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { applyPortalTheme } from "../../../utils/theme";
import { resolvePortalMediaUrl } from "../../../utils/portal-media";
import { Sun, Moon, KeyRound, Mail, Loader2 } from "lucide-react";
import { PasswordInput } from "../../../components/PasswordInput";
import { PortalImageUpload, fileToBase64Payload } from "../../../components/PortalImageUpload";

type PortalTheme = "light" | "dark";

type StudentProfileData = {
  account: { id: string; email: string; status: string };
  student: {
    admissionNumber: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    shortBio: string | null;
    gender: string | null;
    nationality: string | null;
    bloodGroup: string | null;
    emergencyContact: string | null;
    emergencyPhone: string | null;
  };
  preferences: { theme: PortalTheme };
  photoUrl: string | null;
  hasPhoto: boolean;
};

export const StudentPortalProfile: React.FC<{
  schoolSlug: string;
  theme: PortalTheme;
  onThemeChange: (t: PortalTheme) => void;
  onAccountEmailChange?: (email: string) => void;
  onPhotoChange?: (photoUrl: string | null) => void;
}> = ({ schoolSlug, theme, onThemeChange, onAccountEmailChange, onPhotoChange }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [profile, setProfile] = useState<StudentProfileData | null>(null);

  const [emailForm, setEmailForm] = useState({ email: "", currentPassword: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get(`/s/${schoolSlug}/api/portal/profile`);
      const data = res.data as StudentProfileData;
      setProfile(data);
      setEmailForm({ email: data.account.email, currentPassword: "" });
      onThemeChange(data.preferences.theme);
      applyPortalTheme(data.preferences.theme, schoolSlug);
      onPhotoChange?.(data.photoUrl ?? null);
    } catch (e: any) {
      setErr(e.message ?? "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, onThemeChange, onPhotoChange]);

  useEffect(() => { load(); }, [load]);

  const photoPreview = useMemo(() => {
    if (!profile?.photoUrl) return "";
    return resolvePortalMediaUrl(profile.photoUrl, photoVersion);
  }, [profile?.photoUrl, photoVersion]);

  const flash = (text: string, isErr = false) => {
    if (isErr) { setErr(text); setMsg(""); } else { setMsg(text); setErr(""); }
    setTimeout(() => { setMsg(""); setErr(""); }, 4000);
  };

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const payload = await fileToBase64Payload(file);
      const res = await api.post(`/s/${schoolSlug}/api/portal/profile/photo`, payload);
      const url = res.data?.photoUrl ?? res.data?.profile?.photoUrl ?? null;
      setPhotoVersion((v) => v + 1);
      if (res.data?.profile) {
        setProfile(res.data.profile);
      } else if (profile && url) {
        setProfile({ ...profile, photoUrl: url, hasPhoto: true });
      }
      onPhotoChange?.(url);
      flash("Profile photo saved");
    } catch (ex: any) {
      flash(ex.message ?? "Photo upload failed", true);
    } finally {
      setUploadingPhoto(false);
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
      flash("Portal login email updated");
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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin portal-accent-text" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-red-400">{err || "Profile unavailable"}</p>;
  }

  return (
    <div className="space-y-5">
      {(msg || err) && (
        <p className={`text-sm rounded-xl px-4 py-2 border ${err ? "text-red-300 border-red-500/30 bg-red-950/30" : "portal-flash-success"}`}>
          {err || msg}
        </p>
      )}

      <section className="portal-panel rounded-2xl p-5">
        <PortalImageUpload
          label="Profile photo"
          hint="Required — same as school staff. Used on your portal and school records."
          required
          previewSrc={photoPreview}
          uploading={uploadingPhoto}
          onUpload={uploadPhoto}
        />
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <p className="text-sm text-[var(--portal-subtle)]">
          To update your bio (phone, address, short bio, emergency contacts), go to <strong>My programme</strong> and submit changes for school approval.
        </p>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title font-semibold mb-4">Appearance</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => saveTheme("light")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm border ${theme === "light" ? "portal-theme-selected" : "border-[var(--portal-border)]"}`}>
            <Sun className="w-4 h-4" /> Light
          </button>
          <button type="button" onClick={() => saveTheme("dark")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm border ${theme === "dark" ? "portal-theme-selected" : "border-[var(--portal-border)]"}`}>
            <Moon className="w-4 h-4" /> Dark
          </button>
        </div>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title font-semibold flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 portal-accent-text" /> Portal login email
        </h2>
        <form onSubmit={saveEmail} className="space-y-3 max-w-md">
          <label className="text-xs text-[var(--portal-subtle)] block">
            Current password
            <PasswordInput required className="portal-input w-full mt-1 rounded-lg text-sm" value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} />
          </label>
          <label className="text-xs text-[var(--portal-subtle)] block">
            New login email
            <input type="email" required className="portal-input w-full mt-1 rounded-lg text-sm" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} />
          </label>
          <button type="submit" disabled={saving} className="portal-btn-primary rounded-lg text-sm px-4 py-2 font-medium">Update email</button>
        </form>
      </section>

      <section className="portal-panel rounded-2xl p-5">
        <h2 className="portal-panel-title font-semibold flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 portal-accent-text" /> Password
        </h2>
        <form onSubmit={savePassword} className="space-y-3 max-w-md">
          <label className="text-xs text-[var(--portal-subtle)] block">
            Current password
            <PasswordInput required className="portal-input w-full mt-1 rounded-lg text-sm" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
          </label>
          <label className="text-xs text-[var(--portal-subtle)] block">
            New password
            <PasswordInput required minLength={8} className="portal-input w-full mt-1 rounded-lg text-sm" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
          </label>
          <label className="text-xs text-[var(--portal-subtle)] block">
            Confirm new password
            <PasswordInput required className="portal-input w-full mt-1 rounded-lg text-sm" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
          </label>
          <button type="submit" disabled={saving} className="portal-btn-primary rounded-lg text-sm px-4 py-2 font-medium">Change password</button>
        </form>
      </section>
    </div>
  );
};
