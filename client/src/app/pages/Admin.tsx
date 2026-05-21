import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { Loader2, Shield, Users, ScrollText, Megaphone, GraduationCap, Calendar, Building2, Palette, Wand2, LayoutDashboard, Database } from "lucide-react";
import {
  AdminOverviewPanel,
  NoticeboardAdminPanel,
  ClassesSectionsPanel,
  SessionsPanel,
  MultiSchoolPanel,
  AppearancePanel,
  SetupWizardPanel,
  PortalDashboardsPanel,
  SystemUtilitiesPanel,
} from "../components/admin/AdminEnhancementPanels";

type Tab =
  | "overview" | "access" | "portal" | "noticeboard" | "classes" | "sessions"
  | "branches" | "appearance" | "wizard" | "utilities" | "users" | "audit";

export const Admin: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [presets, setPresets] = useState<Record<string, { label: string; description: string }>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [usersWithRoles, setUsersWithRoles] = useState<any[]>([]);

  useEffect(() => {
    if (!schoolSlug) return;
    if (tab === "users" || tab === "access") loadAccess();
    else if (tab === "audit") loadAudit();
  }, [schoolSlug, tab, auditActionFilter]);

  const loadAccess = async () => {
    setLoading(true);
    try {
      const [u, r, p, pr, uwr] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/admin/users`),
        api.get(`/s/${schoolSlug}/api/admin/roles`),
        api.get(`/s/${schoolSlug}/api/admin/permissions`),
        api.get(`/s/${schoolSlug}/api/admin/rbac-presets`),
        api.get(`/s/${schoolSlug}/api/admin/users-with-roles`),
      ]);
      setUsers(u.data || []);
      setRoles(r.data || []);
      setPermissions(p.data || []);
      setPresets(pr.data || {});
      setUsersWithRoles(uwr.data || []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    setLoading(true);
    try {
      const q = auditActionFilter.trim() ? `?action=${encodeURIComponent(auditActionFilter.trim())}` : "";
      const res = await api.get(`/s/${schoolSlug}/api/admin/audit-logs${q}`);
      setAuditLogs(res.data || []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admin/roles`, { name: newRoleName });
      setNewRoleName("");
      toast("Role created", "success");
      loadAccess();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const selectRole = async (roleId: string) => {
    setSelectedRole(roleId);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admin/roles/${roleId}/permissions`);
      setSelectedPerms(res.data ?? []);
    } catch {
      setSelectedPerms([]);
    }
  };

  const applyPreset = async (preset: string) => {
    if (!selectedRole) return;
    await api.post(`/s/${schoolSlug}/api/admin/roles/${selectedRole}/apply-preset`, { preset });
    toast("Preset applied", "success");
    selectRole(selectedRole);
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admin/roles/${selectedRole}/permissions`, { permissionIds: selectedPerms });
      toast("Permissions updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const assignUserRoles = async (userId: string, roleIds: string[]) => {
    try {
      await api.post(`/s/${schoolSlug}/api/admin/users/${userId}/roles`, { roleIds });
      toast("User roles updated", "success");
      loadAccess();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/admin/users/${userId}/status`, { status });
      toast("User status updated", "success");
      loadAccess();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const removeUser = async (userId: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/admin/users/${userId}`);
      toast("User removed", "success");
      loadAccess();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const byModule = permissions.reduce((acc: Record<string, any[]>, p: any) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  }, {});

  const tabs: { id: Tab; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, show: hasPermission("settings.view") },
    { id: "wizard", label: "Setup", icon: Wand2, show: hasPermission("settings.manage") },
    { id: "utilities", label: "Utilities", icon: Database, show: hasPermission("settings.manage") },
    { id: "access", label: "Roles & access", icon: Shield, show: hasPermission("rbac.manage.roles") },
    { id: "users", label: "Users", icon: Users, show: hasPermission("settings.users.view") },
    { id: "portal", label: "Portal", icon: Users, show: true },
    { id: "noticeboard", label: "Noticeboard", icon: Megaphone, show: hasPermission("messaging.view") },
    { id: "classes", label: "Classes", icon: GraduationCap, show: hasPermission("academics.view") },
    { id: "sessions", label: "Sessions", icon: Calendar, show: hasPermission("academics.view") },
    { id: "branches", label: "Multi-school", icon: Building2, show: hasPermission("settings.view") },
    { id: "appearance", label: "Appearance", icon: Palette, show: hasPermission("settings.manage") },
    { id: "audit", label: "Audit", icon: ScrollText, show: hasPermission("audit.view") },
  ];

  const tabBtn = (t: Tab) =>
    `px-3 py-2 rounded-lg text-sm whitespace-nowrap ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration &amp; Access</h1>
          <p className="text-slate-400 mt-1">Roles, sessions, noticeboard, branches, appearance, and setup</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.filter((t) => t.show !== false).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`flex items-center gap-1.5 ${tabBtn(id)}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && schoolSlug && <AdminOverviewPanel schoolSlug={schoolSlug} />}
      {tab === "wizard" && schoolSlug && <SetupWizardPanel schoolSlug={schoolSlug} />}
      {tab === "utilities" && schoolSlug && <SystemUtilitiesPanel schoolSlug={schoolSlug} />}
      {tab === "portal" && schoolSlug && <PortalDashboardsPanel schoolSlug={schoolSlug} />}
      {tab === "noticeboard" && schoolSlug && <NoticeboardAdminPanel schoolSlug={schoolSlug} />}
      {tab === "classes" && schoolSlug && <ClassesSectionsPanel schoolSlug={schoolSlug} />}
      {tab === "sessions" && schoolSlug && <SessionsPanel schoolSlug={schoolSlug} />}
      {tab === "branches" && schoolSlug && <MultiSchoolPanel schoolSlug={schoolSlug} />}
      {tab === "appearance" && schoolSlug && <AppearancePanel schoolSlug={schoolSlug} />}

      {(tab === "access" || tab === "users") && (
        loading ? <LoadingSpinner /> : tab === "users" ? (
          <UsersWithRolesTable
            users={usersWithRoles}
            roles={roles}
            canManage={hasPermission("rbac.manage.roles")}
            onAssign={assignUserRoles}
            canManageStatus={hasPermission("settings.users.manage")}
            onStatusChange={updateUserStatus}
            onRemove={removeUser}
          />
        ) : (
          <RolesAccessPanel
            roles={roles}
            presets={presets}
            byModule={byModule}
            newRoleName={newRoleName}
            setNewRoleName={setNewRoleName}
            createRole={createRole}
            selectedRole={selectedRole}
            selectRole={selectRole}
            selectedPerms={selectedPerms}
            setSelectedPerms={setSelectedPerms}
            applyPreset={applyPreset}
            saveRolePermissions={saveRolePermissions}
          />
        )
      )}

      {tab === "audit" && (
        loading ? <LoadingSpinner /> : (
          <AuditPanel logs={auditLogs} actionFilter={auditActionFilter} setActionFilter={setAuditActionFilter} onSearch={loadAudit} />
        )
      )}
    </div>
  );
};

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );
}

function RolesAccessPanel(props: {
  roles: any[];
  presets: Record<string, { label: string; description: string }>;
  byModule: Record<string, any[]>;
  newRoleName: string;
  setNewRoleName: (v: string) => void;
  createRole: () => void;
  selectedRole: string | null;
  selectRole: (id: string) => void;
  selectedPerms: string[];
  setSelectedPerms: (v: string[]) => void;
  applyPreset: (preset: string) => void;
  saveRolePermissions: () => void;
}) {
  const { roles, presets, byModule, newRoleName, setNewRoleName, createRole, selectedRole, selectRole, selectedPerms, setSelectedPerms, applyPreset, saveRolePermissions } = props;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Staff log in with email/password. Parents and students use the <strong>portal</strong> (separate accounts) — not these roles.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Roles</h3>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="New role (e.g. Bursar)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
            <button type="button" className="btn-primary" onClick={createRole}>Add</button>
          </div>
          <ul className="space-y-2">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-lg ${selectedRole === r.id ? "bg-primary-900/40 border border-primary-600" : "hover:bg-slate-800"}`}
                  onClick={() => selectRole(r.id)}
                >
                  {r.name} {r.isSystem && <span className="text-xs text-slate-500">(system)</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-white">Permissions</h3>
          {!selectedRole ? (
            <p className="text-slate-400 text-sm">Select a role.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {Object.entries(presets).filter(([k]) => k !== "parent_portal").map(([key, p]) => (
                  <button key={key} type="button" className="btn-ghost text-xs" title={p.description} onClick={() => applyPreset(key)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="max-h-80 overflow-y-auto space-y-4">
                {Object.entries(byModule).map(([mod, perms]) => (
                  <div key={mod}>
                    <p className="text-xs uppercase text-slate-500 mb-2">{mod}</p>
                    <div className="space-y-1">
                      {perms.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPerms.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedPerms([...selectedPerms, p.id]);
                              else setSelectedPerms(selectedPerms.filter((id) => id !== p.id));
                            }}
                          />
                          <span className="font-mono text-xs">{p.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-primary" onClick={saveRolePermissions}>Save permissions</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersWithRolesTable({ users, roles, canManage, onAssign, canManageStatus, onStatusChange, onRemove }: {
  users: any[];
  roles: any[];
  canManage: boolean;
  onAssign: (userId: string, roleIds: string[]) => void;
  canManageStatus: boolean;
  onStatusChange: (id: string, status: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead><tr><th>User</th><th>Roles</th><th>Status</th>{canManageStatus && <th>Actions</th>}</tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}<br /><span className="text-slate-500 text-xs">{u.firstName} {u.lastName}</span></td>
              <td>
                {canManage ? (
                  <select
                    className="input text-sm"
                    multiple
                    value={(u.roles ?? []).map((r: any) => r.id)}
                    onBlur={(e) => {
                      const roleIds = Array.from(e.target.selectedOptions).map((o) => o.value);
                      onAssign(u.id, roleIds);
                    }}
                  >
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                ) : (
                  (u.roles ?? []).map((r: any) => r.name).join(", ") || "—"
                )}
              </td>
              <td className="capitalize">{u.status}</td>
              {canManageStatus && (
                <td className="flex flex-wrap gap-1">
                  {u.status !== "active" && <button type="button" className="btn-ghost text-xs" onClick={() => onStatusChange(u.id, "active")}>Activate</button>}
                  <ConfirmAction label="Remove" confirmMessage={`Remove ${u.email}?`} onConfirm={() => onRemove(u.id)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditPanel({ logs, actionFilter, setActionFilter, onSearch }: {
  logs: any[];
  actionFilter: string;
  setActionFilter: (v: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 max-w-md">
        <input className="input flex-1" placeholder="Filter by action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} />
        <button type="button" className="btn-ghost" onClick={onSearch}>Search</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">No audit entries.</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id}>
                <td className="text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="font-mono text-xs">{log.action}</td>
                <td>{log.entityType} {log.entityId?.slice(0, 8)}</td>
                <td className="text-slate-400">{log.actorEmail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
