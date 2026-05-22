import { MODULE_FEATURE_CODES } from "./module-features";

/** Ops modules rendered inside Facilities (not separate /ops/* sidebar links). */
export const FACILITIES_OPS_IDS = ["library", "transport", "boarding"] as const;

export type FacilitiesTabId =
  | "overview"
  | "library"
  | "cards"
  | "transport"
  | "hostel"
  | "activities"
  | "rooms"
  | "gate-passes"
  | "tickets"
  | "staff-hostel";

export const OPS_TO_FACILITIES_TAB: Record<string, FacilitiesTabId> = {
  library: "library",
  transport: "transport",
  boarding: "hostel",
};

import { schoolPath } from "../app/lib/tenant-host";

export function facilitiesPath(schoolSlug: string, tab?: FacilitiesTabId): string {
  const base = schoolPath(schoolSlug, "facilities");
  return tab && tab !== "overview" ? `${base}?tab=${tab}` : base;
}

type PermCheck = (code: string) => boolean;

/** Whether the user should see Facilities / library / transport / hostel in the sidebar. */
export function canAccessFacilities(hasPermission: PermCheck, moduleEnabled: (f: string) => boolean): boolean {
  const gates: { perm: string; feature?: string }[] = [
    { perm: "library.view", feature: MODULE_FEATURE_CODES.library },
    { perm: "transport.view", feature: MODULE_FEATURE_CODES.transport },
    { perm: "boarding.view", feature: MODULE_FEATURE_CODES.boarding },
    { perm: "gate_pass.view", feature: MODULE_FEATURE_CODES.students },
    { perm: "ticket.view", feature: MODULE_FEATURE_CODES.students },
    { perm: "staff_hostel.view", feature: MODULE_FEATURE_CODES.boarding },
    { perm: "messaging.view", feature: MODULE_FEATURE_CODES.messaging },
  ];
  return gates.some((g) => hasPermission(g.perm) && (!g.feature || moduleEnabled(g.feature)));
}

export function isFacilitiesNavActive(
  pathname: string,
  search: string,
  schoolSlug: string,
  tab?: FacilitiesTabId,
): boolean {
  const base = `/s/${schoolSlug}/facilities`;
  if (!pathname.startsWith(base)) return false;
  if (!tab || tab === "overview") {
    const q = new URLSearchParams(search).get("tab");
    return !q || q === "overview";
  }
  return new URLSearchParams(search).get("tab") === tab;
}
