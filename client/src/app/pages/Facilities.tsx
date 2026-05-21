import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { MODULE_FEATURE_CODES } from "../../lib/module-features";
import { Building2, Library, CreditCard, Bus, Home, Calendar, DoorOpen, LayoutDashboard, ShieldCheck, Ticket, BedDouble } from "lucide-react";
import { GatePassPanel } from "../components/facilities/GatePassPanel";
import { TicketsManagementPanel, StaffHostelManagementPanel } from "../components/facilities/TicketsStaffHostelPanels";
import {
  FacilitiesOverviewPanel,
  LibraryManagementPanel,
  LibraryCardsPanel,
  TransportManagementPanel,
  HostelManagementPanel,
  ActivitiesManagementPanel,
  RoomsManagementPanel,
} from "../components/facilities/FacilitiesEnhancementPanels";

type Tab = "overview" | "library" | "cards" | "transport" | "hostel" | "activities" | "rooms" | "gate-passes" | "tickets" | "staff-hostel";

const TAB_META: { id: Tab; label: string; icon: React.ElementType; perm?: string; feature?: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "library", label: "Library", icon: Library, perm: "library.view", feature: MODULE_FEATURE_CODES.library },
  { id: "cards", label: "Library cards", icon: CreditCard, perm: "library.view", feature: MODULE_FEATURE_CODES.library },
  { id: "transport", label: "Transport", icon: Bus, perm: "transport.view", feature: MODULE_FEATURE_CODES.transport },
  { id: "hostel", label: "Hostel", icon: Home, perm: "boarding.view", feature: MODULE_FEATURE_CODES.boarding },
  { id: "activities", label: "Activities", icon: Calendar, perm: "messaging.view", feature: MODULE_FEATURE_CODES.messaging },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "gate-passes", label: "Gate passes", icon: ShieldCheck, perm: "gate_pass.view", feature: MODULE_FEATURE_CODES.students },
  { id: "tickets", label: "Tickets", icon: Ticket, perm: "ticket.view", feature: MODULE_FEATURE_CODES.students },
  { id: "staff-hostel", label: "Staff hostel", icon: BedDouble, perm: "staff_hostel.view", feature: MODULE_FEATURE_CODES.boarding },
];

export const Facilities: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, moduleEnabled } = useAuth();
  const initial = (searchParams.get("tab") as Tab) || "overview";
  const [tab, setTab] = useState<Tab>(TAB_META.some((t) => t.id === initial) ? initial : "overview");
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  const visibleTabs = TAB_META.filter((t) => {
    if (t.perm && !hasPermission(t.perm)) return false;
    if (t.feature && !moduleEnabled(t.feature)) return false;
    return true;
  });

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/students?limit=300&enriched=true`).then((r) => setStudents(r.data ?? [])).catch(() => {});
    api.get(`/s/${schoolSlug}/api/hr/staff`).then((r) => setStaff(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  const selectTab = (id: Tab) => {
    setTab(id);
    setSearchParams({ tab: id });
  };

  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === tab) && visibleTabs.length) selectTab(visibleTabs[0].id);
  }, [visibleTabs.length]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="w-7 h-7 text-teal-400" />
            Facilities & Operations
          </h1>
          <p className="text-slate-400 mt-1">Library, transport, hostel, activities, and room management</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`tab-pill flex items-center gap-1.5 ${tab === t.id ? "active" : ""}`}
              onClick={() => selectTab(t.id)}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "overview" && schoolSlug && <FacilitiesOverviewPanel schoolSlug={schoolSlug} />}
      {tab === "library" && schoolSlug && <LibraryManagementPanel schoolSlug={schoolSlug} students={students} staff={staff} />}
      {tab === "cards" && schoolSlug && <LibraryCardsPanel schoolSlug={schoolSlug} students={students} staff={staff} />}
      {tab === "transport" && schoolSlug && <TransportManagementPanel schoolSlug={schoolSlug} students={students} />}
      {tab === "hostel" && schoolSlug && <HostelManagementPanel schoolSlug={schoolSlug} students={students} />}
      {tab === "activities" && schoolSlug && <ActivitiesManagementPanel schoolSlug={schoolSlug} />}
      {tab === "rooms" && schoolSlug && <RoomsManagementPanel schoolSlug={schoolSlug} />}
      {tab === "gate-passes" && schoolSlug && <GatePassPanel schoolSlug={schoolSlug} students={students} staff={staff} />}
      {tab === "tickets" && schoolSlug && <TicketsManagementPanel schoolSlug={schoolSlug} staff={staff} />}
      {tab === "staff-hostel" && schoolSlug && <StaffHostelManagementPanel schoolSlug={schoolSlug} staff={staff} />}
    </div>
  );
};
