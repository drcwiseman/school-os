import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { usePlatformAuth } from "./hooks/usePlatformAuth";

export const PlatformProfile: React.FC = () => {
  const { toast } = useToast();
  const { admin, refresh } = usePlatformAuth();
  const [name, setName] = useState(admin?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  React.useEffect(() => {
    if (admin?.name) setName(admin.name);
  }, [admin?.name]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch("/api/platform/auth/profile", { name: name.trim() });
      await refresh();
      toast("Profile updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api.patch("/api/platform/auth/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast("Password updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingPassword(false);
    }
  };

  if (!admin) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your platform administrator account</p>
      </div>

      <form onSubmit={saveProfile} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Account</h2>
        <div>
          <label className="text-xs font-medium text-slate-600">Email</label>
          <input className="input text-sm mt-1 w-full bg-slate-50" value={admin.email} readOnly disabled />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Display name</label>
          <input className="input text-sm mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Role</label>
          <input className="input text-sm mt-1 w-full bg-slate-50 capitalize" value={admin.role.replace("_", " ")} readOnly disabled />
        </div>
        <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <Save size={16} />
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form onSubmit={savePassword} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Change password</h2>
        <div>
          <label className="text-xs font-medium text-slate-600">Current password</label>
          <input
            type="password"
            className="input text-sm mt-1 w-full"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            name="current-password"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">New password</label>
          <input
            type="password"
            className="input text-sm mt-1 w-full"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            name="new-password"
          />
        </div>
        <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {savingPassword ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
};
