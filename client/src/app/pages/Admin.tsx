import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, Shield, Users, ScrollText } from "lucide-react";

type Tab = "users" | "roles" | "audit";

export const Admin: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  useEffect(() => {
    loadAll();
  }, [schoolSlug, tab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      if (tab === "users") {
        const res = await api.get(`/s/${schoolSlug}/api/admin/users`);
        setUsers(res.data || []);
      } else if (tab === "roles") {
        const [r, p] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/admin/roles`),
          api.get(`/s/${schoolSlug}/api/admin/permissions`),
        ]);
        setRoles(r.data || []);
        setPermissions(p.data || []);
      } else {
        const res = await api.get(`/s/${schoolSlug}/api/admin/audit-logs`);
        setAuditLogs(res.data || []);
      }
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
      loadAll();
    } catch (err: any) {
      toast(err.message, "error");
    }
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

  const byModule = permissions.reduce((acc: Record<string, any[]>, p: any) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  }, {});

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "roles", label: "Roles & Permissions", icon: Shield },
    { id: "audit", label: "Audit Log", icon: ScrollText },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users &amp; Roles</h1>
          <p className="text-slate-400 mt-1">Staff accounts, RBAC, and audit trail (school-scoped only)</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-700/50 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "bg-primary-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === "users" ? (
        <UsersTable users={users} />
      ) : tab === "roles" ? (
        <RolesPanel
          roles={roles}
          byModule={byModule}
          newRoleName={newRoleName}
          setNewRoleName={setNewRoleName}
          createRole={createRole}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          selectedPerms={selectedPerms}
          setSelectedPerms={setSelectedPerms}
          saveRolePermissions={saveRolePermissions}
        />
      ) : (
        <AuditTable logs={auditLogs} />
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

function UsersTable({ users }: { users: any[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr><th>Email</th><th>Name</th><th>Status</th></tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={3} className="text-center py-8 text-slate-400">No users found.</td></tr>
          ) : users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.firstName} {u.lastName}</td>
              <td><span className="badge-green capitalize">{u.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RolesPanel(props: {
  roles: any[];
  byModule: Record<string, any[]>;
  newRoleName: string;
  setNewRoleName: (v: string) => void;
  createRole: () => void;
  selectedRole: string | null;
  setSelectedRole: (v: string | null) => void;
  selectedPerms: string[];
  setSelectedPerms: (v: string[]) => void;
  saveRolePermissions: () => void;
}) {
  const { roles, byModule, newRoleName, setNewRoleName, createRole, selectedRole, setSelectedRole, selectedPerms, setSelectedPerms, saveRolePermissions } = props;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-white">Roles</h3>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="New role name (e.g. Bursar)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
          <button type="button" className="btn-primary" onClick={createRole}>Add</button>
        </div>
        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 rounded-lg ${selectedRole === r.id ? "bg-primary-900/40 border border-primary-600" : "hover:bg-slate-800"}`}
                onClick={() => { setSelectedRole(r.id); setSelectedPerms([]); }}
              >
                {r.name} {r.isSystem && <span className="text-xs text-slate-500">(system)</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-6">
        <h3 className="font-semibold text-white mb-4">Assign Permissions</h3>
        {!selectedRole ? (
          <p className="text-slate-400 text-sm">Select a role to assign permissions.</p>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto space-y-4">
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
            <button type="button" className="btn-primary mt-4" onClick={saveRolePermissions}>Save Permissions</button>
          </>
        )}
      </div>
    </div>
  );
}

function AuditTable({ logs }: { logs: any[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="table text-sm">
        <thead>
          <tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th></tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-8 text-slate-400">No audit entries.</td></tr>
          ) : logs.map((log) => (
            <tr key={log.id}>
              <td className="text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="font-mono text-xs">{log.action}</td>
              <td>{log.entityType} {log.entityId?.slice(0, 8)}</td>
              <td className="text-slate-400">{log.actorUserId?.slice(0, 8) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
