import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

export type PlatformAdmin = {
  id?: string;
  name: string;
  email: string;
  role: string;
};

export function usePlatformAuth() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);

  const loadMe = useCallback(async () => {
    const res = await api.get("/api/platform/auth/me");
    setAdmin(res.admin ?? null);
    return res.admin as PlatformAdmin | null;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadMe();
        setReady(true);
      } catch {
        navigate("/platform/login");
      }
    })();
  }, [navigate, loadMe]);

  const refresh = useCallback(async () => {
    try {
      await loadMe();
    } catch {
      navigate("/platform/login");
    }
  }, [loadMe, navigate]);

  const logout = async () => {
    try {
      await api.post("/api/platform/auth/logout");
    } catch {
      /* cookie may already be cleared */
    }
    setAdmin(null);
    window.location.assign("/platform/login");
  };

  return { ready, admin, logout, refresh };
};
