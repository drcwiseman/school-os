import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { ConfirmAction } from "../ConfirmAction";
import { Loader2, Plus, Pencil, Shield, Users, Save } from "lucide-react";

type Role = { id: string; name: string; isSystem?: boolean };
type Permission = { id: string; code: string; module: string };
type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: { id: string; name: string }[];
};

type Props = {
  schoolSlug: string;
  canManageRoles: boolean;
  canManageUsers: boolean;
  canManagePerms: boolean;
};

export const AdminAccessPanel: React.FC<Props> = ({
  schoolSlug,
  canManageRoles,
  canManageUsers,
  canManagePerms,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"users" | "roles">("users");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [presets, setPresets] = useState<Record<string, { label: string; description: string }>>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [editRoleName, setEditRoleName] = useState("");
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    roleIds: [] as string[],
  });
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, pr, uwr] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/admin/roles`),
        api.get(`/s/${schoolSlug}/api/admin/permissions`),
        api.get(`/s/${schoolSlug}/api/admin/rbac-presets`),
        api.get(`/s/${schoolSlug}/api/admin/users-with-roles`),
      ]);
      setRoles(r.data ?? []);
      setPermissions(p.data ?? []);
      setPresets(pr.data ?? {});
      setUsers(uwr.data ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const selectRole = async (roleId: string, name: string) => {
    setSelectedRole(roleId);
    setEditRoleName(name);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admin/roles/${roleId}/permissions`);
      setSelectedPerms(res.data ?? []);
    } catch {
      setSelectedPerms([]);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admin/roles`, { name: newRoleName.trim() });
      setNewRoleName("");
      toast("Role created", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const renameRole = async () => {
    if (!selectedRole || !editRoleName.trim()) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/admin/roles/${selectedRole}`, { name: editRoleName.trim() });
      toast("Role updated", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const deleteRole = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/admin/roles/${id}`);
      if (selectedRole === id) setSelectedRole(null);
      toast("Role deleted", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const applyPreset = async (preset: string) => {
    if (!selectedRole) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admin/roles/${selectedRole}/apply-preset`, { preset });
      toast("Preset applied", "success");
      selectRole(selectedRole, editRoleName);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admin/roles/${selectedRole}/permissions`, { permissionIds: selectedPerms });
      toast("Permissions saved", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/admin/users`, {
        ...userForm,
        roleIds: userForm.roleIds.length ? userForm.roleIds : undefined,
      });
      toast("Staff user created", "success");
      setShowUserForm(false);
      setUserForm({ email: "", password: "", firstName: "", lastName: "", roleIds: [] });
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const saveUserRoles = async () => {
    if (!editingUser) return;
    try {
      await api.post(`/s/${schoolSlug}/api/admin/users/${editingUser.id}/roles`, { roleIds: editRoleIds });
      toast("Roles updated", "success");
      setEditingUser(null);
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/admin/users/${userId}/status`, { status });
      toast("Status updated", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const removeUser = async (userId: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/admin/users/${userId}`);
      toast("User removed", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  const byModule = permissions.reduce((acc: Record<string, Permission[]>, p) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  }, {});

  const selectedRoleRow = roles.find((r) => r.id === selectedRole);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Staff log in with email and password. Parents and students use the portal — not these accounts.
      </p>

      <div className="flex gap-2">
        <button type="button" className={subTab === "users" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setSubTab("users")}>
          <Users className="w-4 h-4 inline mr-1" /> Users ({users.length})
        </button>
        <button type="button" className={subTab === "roles" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setSubTab("roles")}>
          <Shield className="w-4 h-4 inline mr-1" /> Roles ({roles.length})
        </button>
      </div>

      {subTab === "users" && (
        <div className="space-y-4">
          {canManageUsers && (
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <button type="button" className="btn-primary" onClick={() => setShowUserForm(!showUserForm)}>
                <Plus className="w-4 h-4" /> {showUserForm ? "Close" : "Add staff user"}
              </button>
            </div>
          )}
          {showUserForm && canManageUsers && (
            <form onSubmit={createUser} className="card p-5 grid md:grid-cols-2 gap-3">
              <input className="input" required type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              <input className="input" required type="password" minLength={8} placeholder="Password (min 8)" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              <input className="input" required placeholder="First name" value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
              <input className="input" required placeholder="Last name" value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
              <div className="md:col-span-2">
                <label className="label">Roles (optional)</label>
                <select
                  className="input"
                  multiple
                  value={userForm.roleIds}
                  onChange={(e) => setUserForm({ ...userForm, roleIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                >
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary md:col-span-2 max-w-xs">Create user</button>
            </form>
          )}

          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  {canManageUsers && <th className="w-40">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={canManageUsers ? 5 : 4} className="text-center py-10 text-slate-500">No staff users yet.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-white">{u.firstName} {u.lastName}</td>
                    <td className="text-slate-400">{u.email}</td>
                    <td>{(u.roles ?? []).map((r) => r.name).join(", ") || "—"}</td>
                    <td><span className={`capitalize text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-emerald-900/40 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>{u.status}</span></td>
                    {canManageUsers && (
                      <td className="space-x-1 whitespace-nowrap">
                        {canManageRoles && (
                          <button type="button" className="btn-ghost text-xs" onClick={() => { setEditingUser(u); setEditRoleIds((u.roles ?? []).map((r) => r.id)); }}>
                            <Pencil className="w-3 h-3 inline" /> Roles
                          </button>
                        )}
                        {u.status !== "active" && (
                          <button type="button" className="btn-ghost text-xs text-emerald-400" onClick={() => updateUserStatus(u.id, "active")}>Activate</button>
                        )}
                        {u.status === "active" && (
                          <button type="button" className="btn-ghost text-xs" onClick={() => updateUserStatus(u.id, "suspended")}>Suspend</button>
                        )}
                        <ConfirmAction label="Remove" confirmMessage={`Remove ${u.email}?`} onConfirm={() => removeUser(u.id)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingUser && canManageRoles && (
            <div className="card p-5 space-y-3 border border-primary-800/50">
              <h3 className="font-semibold text-white">Edit roles — {editingUser.email}</h3>
              <select
                className="input min-h-[100px]"
                multiple
                value={editRoleIds}
                onChange={(e) => setEditRoleIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
              >
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={saveUserRoles}><Save className="w-4 h-4" /> Save roles</button>
                <button type="button" className="btn-ghost" onClick={() => setEditingUser(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "roles" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-primary-400" /> Roles</h3>
            {canManageRoles && (
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="New role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
                <button type="button" className="btn-primary" onClick={createRole}><Plus className="w-4 h-4" /></button>
              </div>
            )}
            <ul className="space-y-1 max-h-72 overflow-y-auto">
              {roles.map((r) => (
                <li key={r.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${selectedRole === r.id ? "bg-primary-900/40 border border-primary-600" : "hover:bg-slate-800/80"}`}>
                  <button type="button" className="flex-1 text-left text-sm text-white" onClick={() => selectRole(r.id, r.name)}>
                    {r.name}
                    {r.isSystem && <span className="text-xs text-slate-500 ml-2">system</span>}
                  </button>
                  {canManageRoles && !r.isSystem && (
                    <ConfirmAction label="Delete" confirmMessage={`Delete role “${r.name}”?`} onConfirm={() => deleteRole(r.id)} />
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-white">Permissions</h3>
            {!selectedRole ? (
              <p className="text-slate-500 text-sm">Select a role to edit permissions.</p>
            ) : (
              <>
                {canManageRoles && !selectedRoleRow?.isSystem && (
                  <div className="flex gap-2">
                    <input className="input flex-1" value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} />
                    <button type="button" className="btn-ghost" onClick={renameRole}>Rename</button>
                  </div>
                )}
                {canManagePerms && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(presets).filter(([k]) => k !== "parent_portal").map(([key, p]) => (
                        <button key={key} type="button" className="btn-ghost text-xs" title={p.description} onClick={() => applyPreset(key)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-3 border border-slate-800 rounded-lg p-3">
                      {Object.entries(byModule).map(([mod, perms]) => (
                        <div key={mod}>
                          <p className="text-xs uppercase text-slate-500 mb-1">{mod}</p>
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
                    <button type="button" className="btn-primary" onClick={saveRolePermissions}>
                      <Save className="w-4 h-4" /> Save permissions
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
