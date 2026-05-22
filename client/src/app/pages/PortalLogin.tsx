import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSchoolSlug } from "../hooks/useSchoolSlug";
import { getTenantBootstrap, schoolPath } from "../lib/tenant-host";
import { Loader2, AlertCircle, Info } from "lucide-react";

type PortalHint = { type: string; email: string; password: string | null };

function wrongDemoSlug(email: string, expectedSlug: string): string | null {
  const m = email.trim().toLowerCase().match(/@([a-z0-9-]+)\.demo$/);
  if (!m || m[1] === expectedSlug) return null;
  return m[1];
}

export const PortalLogin: React.FC = () => {
  const schoolSlug = useSchoolSlug();
  const boot = getTenantBootstrap();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hints, setHints] = useState<PortalHint[]>([]);
  const [portalEnabled, setPortalEnabled] = useState(true);

  useEffect(() => {
    if (!schoolSlug) return;
    api
      .get(`/s/${schoolSlug}/api/public/portal-hints`)
      .then((res: any) => {
        if (res.success && res.data) {
          setHints(res.data.hints ?? []);
          setPortalEnabled(res.data.portalEnabled !== false);
        }
      })
      .catch(() => {});
  }, [schoolSlug]);

  const wrongSlug = useMemo(
    () => (schoolSlug && email ? wrongDemoSlug(email, schoolSlug) : null),
    [email, schoolSlug],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (wrongSlug && schoolSlug) {
      setError(
        `This email is for "${wrongSlug}". Use /s/${wrongSlug}/portal/login or a ${schoolSlug} account.`,
      );
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/portal/login`, { email, password });
      if (res.success && schoolSlug) navigate(schoolPath(schoolSlug, "portal/dashboard"));
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const fillHint = (h: PortalHint) => {
    setEmail(h.email);
    if (h.password) setPassword(h.password);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md card p-8">
        <h2 className="text-2xl font-bold text-white mb-1">Parent / Student Portal</h2>
        <p className="text-slate-400 text-sm mb-1">{boot?.schoolName ?? schoolSlug}</p>
        {schoolSlug && (
          <p className="text-slate-500 text-xs mb-4">
            School: <span className="text-slate-300 font-mono">{schoolSlug}</span> — accounts from another school will not work here.
          </p>
        )}
        {!portalEnabled && (
          <div className="mb-4 p-3 bg-amber-900/30 border border-amber-800 rounded-xl text-amber-100 text-sm">
            Portal sign-in is disabled for this school. Contact the school administrator.
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl flex gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {wrongSlug && !error && (
          <div className="mb-4 p-3 bg-amber-900/30 border border-amber-800 rounded-xl flex gap-2 text-amber-100 text-sm">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              This email belongs to <strong>{wrongSlug}</strong>. Open{" "}
              <a href={`/s/${wrongSlug}/portal/login`} className="underline">
                /s/{wrongSlug}/portal/login
              </a>
              .
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label" htmlFor="portal-email">
              Email
            </label>
            <input
              id="portal-email"
              type="email"
              name="email"
              autoComplete="username"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="portal-password">
              Password
            </label>
            <input
              id="portal-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading || !portalEnabled} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
          </button>
        </form>
        {hints.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-slate-400 text-xs mb-2">Example accounts for this school (tap to fill):</p>
            <ul className="space-y-2">
              {hints.map((h) => (
                <li key={`${h.type}-${h.email}`}>
                  <button
                    type="button"
                    className="text-left w-full text-sm text-primary-400 hover:text-primary-300 font-mono"
                    onClick={() => fillHint(h)}
                  >
                    {h.type}: {h.email}
                    {h.password ? ` / ${h.password}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
