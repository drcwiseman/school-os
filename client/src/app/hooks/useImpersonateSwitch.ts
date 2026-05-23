import { useCallback, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useSchoolSlug } from "./useSchoolSlug";
import { useToast } from "../components/Toast";

type StaffRow = {
  id: string;
  userId?: string | null;
  email?: string | null;
  firstName?: string;
  lastName?: string;
};

export function useImpersonateSwitch() {
  const { impersonationActive, setAuth } = useAuth();
  const schoolSlug = useSchoolSlug();
  const { toast } = useToast();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loginAsStaff = useCallback(
    async (row: StaffRow) => {
      if (!impersonationActive) return;
      if (!schoolSlug) {
        toast("School context missing — refresh the page", "error");
        return;
      }
      setSwitchingId(row.id);
      try {
        const body: Record<string, unknown> = { provisionStaffLogin: true, roleName: "Teacher" };
        if (row.userId) body.userId = row.userId;
        else body.staffId = row.id;

        const path = `/s/${schoolSlug}/api/auth/impersonate-switch`;
        let res = await api.post(path, body).catch(async (err: Error) => {
          if (!String(err.message).includes("404")) throw err;
          return api.post(`/s/${schoolSlug}/api/auth/impersonate/switch`, body);
        });
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

        const redirectPath = res.redirect ?? `/s/${schoolSlug}/teacher`;
        window.location.assign(redirectPath.startsWith("http") ? redirectPath : redirectPath);
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
