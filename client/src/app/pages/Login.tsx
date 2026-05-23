import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useSchoolSlug } from "../hooks/useSchoolSlug";
import { getTenantBootstrap } from "../lib/tenant-host";
import { staffHomePath } from "../lib/staff-home";
import { api } from "../api/client";
import { Loader2, AlertCircle } from "lucide-react";
import { PasswordInput } from "../components/PasswordInput";
import { useSchoolAppBodyClass } from "../hooks/useSchoolAppBodyClass";

export const Login: React.FC = () => {
  useSchoolAppBodyClass();
  const schoolSlug = useSchoolSlug();
  const boot = getTenantBootstrap();
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const displayName = boot?.schoolName ?? schoolSlug;
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post(`/s/${schoolSlug}/api/auth/login`, { email, password });
      if (res.success && res.user) {
        const me = await api.get(`/s/${schoolSlug}/api/auth/me`);
        setAuth(res.user, schoolSlug || null, me.permissions || [], me.roles || [], me.modules, {
          country: me.country,
          currency: me.currency,
        });
        navigate(staffHomePath(schoolSlug!, me.roles || [], me.permissions || []));
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="school-app min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md card p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">{(displayName ?? schoolSlug)?.charAt(0).toUpperCase()}</span>
          </div>
          <h2 className="text-2xl font-bold text-app-strong mb-1">School ERP sign in</h2>
          <p className="text-app-muted text-sm">Administrator or delegated staff account for <span className="text-app">{displayName ?? schoolSlug}</span> — not the parent/student portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl flex gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@school-a.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="btn-primary w-full justify-center mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};
