import { useCallback, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";

type StaffRow = {
  id: string;
  userId?: string | null;
  email?: string | null;
  firstName?: string;
  lastName?: string;
};

export function useImpersonateSwitch() {
  const { schoolSlug, impersonationActive, setAuth } = useAuth();
  const { toast } = useToast();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loginAsStaff = useCallback(
    async (row: StaffRow) => {
      if (!schoolSlug || !impersonationActive) return;
      setSwitchingId(row.id);
      try {
        const body: Record<string, unknown> = { provisionStaffLogin: true, roleName: "Teacher" };
        if (row.userId) body.userId = row.userId;
        else body.staffId = row.id;

        const res = await api.post(`/s/${schoolSlug}/api/auth/impersonate/switch`, body);
        if (!res.success) throw new Error("Could not switch user");

        if (res.user) {
          setAuth(
            res.user,
            schoolSlug,
            res.permissions || [],
            res.roles || [],
            res.modules,
            {
              readOnly: Boolean(res.impersonation?.readOnly),
              impersonationActive: true,
              country: res.country,
              currency: res.currency,
            },
          );
        }

        const path = res.redirect ?? `/s/${schoolSlug}/teacher`;
        window.location.assign(path.startsWith("http") ? path : path);
        toast(
          `Opened as ${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
          "success",
        );
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : "Login as failed", "error");
      } finally {
        setSwitchingId(null);
      }
    },
    [schoolSlug, impersonationActive, setAuth, toast],
  );

  return { loginAsStaff, switchingId, canImpersonate: impersonationActive };
}
