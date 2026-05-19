import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

export function usePlatformAuth() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/platform/auth/me");
        setAdmin(res.admin ?? null);
        setReady(true);
      } catch {
        navigate("/platform/login");
      }
    })();
  }, [navigate]);

  const logout = async () => {
    await api.post("/api/platform/auth/logout").catch(() => {});
    navigate("/platform/login");
  };

  return { ready, admin, logout };
}
