import React, { useState } from "react";
import { Copy, KeyRound, Loader2, LogIn, UserCog } from "lucide-react";
import { useToast } from "../../components/Toast";
import { api } from "../../api/client";
import { absoluteSchoolUrl, normalizeAppUrl } from "../../lib/app-origin";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

export type SchoolLoginRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  adminEmail: string | null;
  loginUrl: string;
  erpUserCount?: number;
};

type Props = {
  schools: SchoolLoginRow[];
  onLogin: (slug: string, readOnly?: boolean) => void;
  loginLoadingSlug: string | null;
};

function absoluteLoginUrl(url: string) {
  const abs = /^https?:\/\//i.test(url) ? url : absoluteSchoolUrl(url);
  return normalizeAppUrl(abs);
}

export const SchoolLoginsPanel: React.FC<Props> = ({ schools, onLogin, loginLoadingSlug }) => {
  const { toast } = useToast();
  const [resetSlug, setResetSlug] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    slug: string;
    email: string;
    temporaryPassword: string;
    loginUrl: string;
  } | null>(null);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied`, "success");
    } catch {
      toast("Copy failed", "error");
    }
  };

  const resetAdminPassword = async (slug: string) => {
    if (!window.confirm("Generate a new temporary password for this school's primary administrator?")) return;
    setResetSlug(slug);
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/reset-admin-password`);
      setResetResult(res.data);
      toast("Temporary password generated — copy it now", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setResetSlug(null);
    }
  };

  if (schools.length === 0) return null;

  return (
    <div className={`${CARD} overflow-hidden`} id="school-logins">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <LogIn size={16} /> School logins
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Login page URL and admin email per school. Use <strong>Enter school</strong> for one-click access without a password.
        </p>
      </div>

      {resetResult && (
        <div className="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Temporary password — {resetResult.slug}</p>
          <p className="mt-1">
            Email: <code className="text-xs bg-white/80 px-1 rounded">{resetResult.email}</code>
          </p>
          <p className="mt-1">
            Password: <code className="text-xs bg-white/80 px-1 rounded">{resetResult.temporaryPassword}</code>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-medium text-amber-900 underline"
              onClick={() => copy(`${resetResult.email}\n${resetResult.temporaryPassword}`, "Credentials")}
            >
              Copy credentials
            </button>
            <button type="button" className="text-xs text-slate-600" onClick={() => setResetResult(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="px-4 py-2 text-left">School</th>
              <th className="px-4 py-2 text-left">Admin email</th>
              <th className="px-4 py-2 text-left">Login URL</th>
              <th className="px-4 py-2 text-right">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schools.map((s) => {
              const url = absoluteLoginUrl(s.loginUrl);
              return (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs font-mono text-slate-500">/{s.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.adminEmail ? (
                      <button
                        type="button"
                        className="text-left hover:text-blue-600 truncate max-w-[200px] block"
                        title="Copy email"
                        onClick={() => copy(s.adminEmail!, "Email")}
                      >
                        {s.adminEmail}
                      </button>
                    ) : (
                      <span className="text-amber-700 text-xs">No admin user</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 min-w-0 max-w-xs">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate"
                      >
                        {url.replace(/^https?:\/\/[^/]+/, "") || url}
                      </a>
                      <button
                        type="button"
                        title="Copy login URL"
                        className="p-1 rounded text-slate-400 hover:bg-slate-100 shrink-0"
                        onClick={() => copy(url, "Login URL")}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={loginLoadingSlug === s.slug || (s.erpUserCount ?? 0) === 0}
                        title={(s.erpUserCount ?? 0) === 0 ? "No ERP users" : "Login as school administrator"}
                        onClick={() => onLogin(s.slug, false)}
                      >
                        {loginLoadingSlug === s.slug ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserCog size={12} />
                        )}
                        Enter school
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        disabled={!s.adminEmail || resetSlug === s.slug}
                        onClick={() => resetAdminPassword(s.slug)}
                      >
                        {resetSlug === s.slug ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                        Reset pwd
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
