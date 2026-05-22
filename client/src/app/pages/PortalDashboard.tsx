import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Loader2 } from "lucide-react";
import { ParentPortalDashboard } from "./portal/parent/ParentPortalDashboard";
import { StudentPortalDashboard } from "./portal/student/StudentPortalDashboard";
import { getStoredPortalTheme } from "../utils/theme";
import { usePortalRouteBodyClass } from "../hooks/useSchoolAppBodyClass";

export const PortalDashboard: React.FC = () => {
  usePortalRouteBodyClass();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const payMsg = searchParams.get("paid") ? "Payment initiated — thank you!" : "";

  const load = async () => {
    try {
      const me = await api.get(`/s/${schoolSlug}/api/portal/me`);
      setAccount(me.account);
      const [dash, sum] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/portal/dashboard`),
        api.get(`/s/${schoolSlug}/api/portal/dashboard/summary`).catch(() => ({ data: null })),
      ]);
      setData(dash.data);
      setSummary(sum.data);
    } catch {
      window.location.href = `/s/${schoolSlug}/portal/login`;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const logout = async () => {
    await api.post(`/s/${schoolSlug}/api/portal/logout`, {});
    window.location.href = `/s/${schoolSlug}/portal/login`;
  };

  const portalTheme = schoolSlug
    ? (localStorage.getItem(`schoolos_portal_theme_${schoolSlug}`) as "light" | "dark" | null)
      ?? (localStorage.getItem("schoolos_theme") as "light" | "dark" | null)
      ?? "dark"
    : "dark";

  if (loading) {
    return (
      <div className="portal-shell min-h-screen flex items-center justify-center" data-portal-theme={portalTheme}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (account?.type === "parent" && data) {
    const initialTheme = account.preferences?.theme === "light" ? "light" : getStoredPortalTheme(schoolSlug!);
    return (
      <ParentPortalDashboard
        schoolSlug={schoolSlug!}
        account={account}
        data={data}
        summary={summary}
        onLogout={logout}
        payMsg={payMsg}
        initialTheme={initialTheme}
        onAccountEmailChange={(email) => setAccount((a: any) => (a ? { ...a, email } : a))}
      />
    );
  }

  if (account?.type === "student" && data) {
    return (
      <StudentPortalDashboard
        schoolSlug={schoolSlug!}
        account={account}
        data={data}
        summary={summary}
        onLogout={logout}
        payMsg={payMsg}
      />
    );
  }

  return (
    <div className="portal-shell min-h-screen flex items-center justify-center" data-portal-theme={portalTheme}>
      <p className="text-[var(--portal-muted)] text-sm">Unable to load portal.</p>
    </div>
  );
};
