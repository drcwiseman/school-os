import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Loader2 } from "lucide-react";

export const ImpersonateExchange: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing token");
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/s/${schoolSlug}/api/auth/impersonate?token=${encodeURIComponent(token)}`);
        navigate(res.redirect ?? `/s/${schoolSlug}/dashboard`, { replace: true });
      } catch (e: any) {
        setError(e.message || "Impersonation failed");
      }
    })();
  }, [schoolSlug, params, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] text-rose-400 p-6">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b13]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
};
