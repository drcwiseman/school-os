import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { Loader2 } from "lucide-react";

export const ImpersonateExchange: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [params] = useSearchParams();
  const { setAuth } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token || !schoolSlug) {
      setError("Missing token or school");
      return;
    }
    (async () => {
      try {
        const res = await api.get(
          `/s/${schoolSlug}/api/auth/impersonate?token=${encodeURIComponent(token)}`,
        );
        if (!res.success) {
          throw new Error("Impersonation failed");
        }

        if (res.user) {
          setAuth(
            res.user,
            schoolSlug,
            res.permissions || [],
            res.roles || [],
            res.modules,
            { readOnly: Boolean(res.impersonation?.readOnly) },
          );
        }

        const path = res.redirect ?? `/s/${schoolSlug}/dashboard`;
        const target = path.startsWith("http") ? path : `${window.location.origin}${path}`;
        window.location.replace(target);
      } catch (e: any) {
        setError(e.message || "Impersonation failed");
      }
    })();
  }, [schoolSlug, params, setAuth]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] text-rose-400 p-6 text-center max-w-md">
        <div>
          <p className="font-medium">{error}</p>
          <p className="text-sm text-slate-400 mt-2">
            Ensure the school has an active administrator, then try again from Platform → Schools.
          </p>
          <a href="/platform/tenants" className="inline-block mt-4 text-blue-400 hover:underline text-sm">
            Back to schools
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b13]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
};
