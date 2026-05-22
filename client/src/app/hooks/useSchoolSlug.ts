import { useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getTenantBootstrap } from "../lib/tenant-host";

/** Resolve school slug from route, auth session, or custom-domain bootstrap. */
export function useSchoolSlug(): string | null {
  const { schoolSlug: paramSlug } = useParams<{ schoolSlug: string }>();
  const { schoolSlug: authSlug } = useAuth();
  const boot = getTenantBootstrap();
  return paramSlug ?? authSlug ?? boot?.slug ?? null;
}
