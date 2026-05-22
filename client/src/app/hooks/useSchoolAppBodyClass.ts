import { useEffect } from "react";

/** Marks document body for school-app theme CSS (admin dashboard + staff login). */
export function useSchoolAppBodyClass(active = true) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("school-app-active");
    return () => document.body.classList.remove("school-app-active");
  }, [active]);
}

export function usePortalRouteBodyClass(active = true) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("portal-route-active");
    return () => document.body.classList.remove("portal-route-active");
  }, [active]);
}
