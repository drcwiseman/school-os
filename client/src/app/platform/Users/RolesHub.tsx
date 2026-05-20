import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Search,
  RefreshCw,
  Loader2,
  Check,
  X,
  Users,
  Pencil,
  Save,
  RotateCcw,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type PermissionDef = {
  code: string;
  label: string;
  description: string;
  group: string;
};

type RoleMeta = {
  role: string;
  label: string;
  description: string;
  permissions: string[];
  permissionCount: number;
  hasFullAccess: boolean;
  editable: boolean;
};

type AdminBrief = {
  id: string;
  email: string;
  name: string;
  role: string;
  activeSessions: number;
};

type RolesData = {
  roles: RoleMeta[];
  catalog: PermissionDef[];
  usersByRole: Record<string, AdminBrief[]>;
  canManageRoles: boolean;
  totals: { admins: number; permissions: number };
};

const ROLE_STYLES: Record<string, string> = {
  super_admin: "border-violet-200 bg-violet-50/50",
  support: "border-blue-200 bg-blue-50/50",
  billing: "border-emerald-200 bg-emerald-50/50",
};

export const RolesHub: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<RolesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/roles");
      setData(res.data);
      if (editingRole) {
        const role = res.data?.roles?.find((r: RoleMeta) => r.role === editingRole);
        if (role) setDraftPerms(new Set(role.permissions));
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, editingRole]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = data?.canManageRoles ?? false;

  const startEdit = (role: string) => {
    const r = data?.roles.find((x) => x.role === role);
    if (!r?.editable) return;
    setEditingRole(role);
    setDraftPerms(new Set(r.permissions));
    setSelectedRole(role);
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setDraftPerms(new Set());
  };

  const togglePerm = (code: string, role: string) => {
    if (editingRole !== role) return;
    setDraftPerms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const saveRole = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      const res = await api.patch(`/api/platform/roles/${editingRole}`, {
        permissions: [...draftPerms],
      });
      setData(res.data);
      setEditingRole(null);
      toast("Role permissions saved", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async (role: string) => {
    if (!window.confirm(`Reset "${role}" permissions to system defaults?`)) return;
    try {
      const res = await api.post(`/api/platform/roles/${role}/reset`, {});
      setData(res.data);
      if (editingRole === role) cancelEdit();
      toast("Role reset to defaults", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const filteredCatalog = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.catalog.filter((p) => {
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const roles = data?.roles ?? [];
  const matrixRoles =
    selectedRole === "all"
      ? roles
      : roles.filter((r) => r.role === selectedRole);

  const roleAllowed = (r: RoleMeta, code: string) => {
    if (editingRole === r.role) return draftPerms.has(code);
    return r.hasFullAccess || r.permissions.includes(code);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Shield size={20} className="text-blue-600" />
              Roles & permissions
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Customize what Support and Billing operators can do. Changes apply immediately to API enforcement.
              Assign users on{" "}
              <Link to="/platform/users" className="text-blue-600 font-medium hover:underline">Platform users</Link>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing || !!editingRole}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            {editingRole ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveRole}
                  disabled={saving || draftPerms.size === 0}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : canManage ? null : (
              <Link
                to="/platform/users"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                <Users size={14} />
                Manage users
              </Link>
            )}
          </div>
        </div>
      </div>

      {!canManage && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          You can view roles but not edit them. Only Super Admins (with Manage role permissions) can change capabilities.
        </p>
      )}

      {editingRole && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Editing <strong>{roles.find((r) => r.role === editingRole)?.label}</strong> — click cells in the matrix to toggle permissions, then Save.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {roles.map((r) => (
          <div key={r.role} className={`${CARD} p-4 border-l-4 ${ROLE_STYLES[r.role] ?? ""}`}>
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm font-bold text-slate-900">{r.label}</p>
              {canManage && r.editable && editingRole !== r.role && (
                <button
                  type="button"
                  onClick={() => startEdit(r.role)}
                  className="text-[10px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  <Pencil size={11} /> Edit
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>
            {!r.editable && (
              <p className="text-[10px] text-violet-600 mt-1">Always full access</p>
            )}
            <div className="flex gap-3 mt-3 text-xs text-slate-600">
              <span>
                <strong className="text-slate-900">{r.hasFullAccess && editingRole !== r.role ? "All" : (editingRole === r.role ? draftPerms.size : r.permissionCount)}</strong> perms
              </span>
              <span>
                <strong className="text-slate-900">{data?.usersByRole[r.role]?.length ?? 0}</strong> users
              </span>
            </div>
            {canManage && r.editable && (
              <button
                type="button"
                onClick={() => resetRole(r.role)}
                className="mt-2 text-[10px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
              >
                <RotateCcw size={10} /> Reset defaults
              </button>
            )}
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search permission or capability…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input text-sm w-auto"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          disabled={!!editingRole}
        >
          <option value="all">Matrix: all roles</option>
          {roles.map((r) => (
            <option key={r.role} value={r.role}>{r.label} only</option>
          ))}
        </select>
      </div>

      <div className={`${CARD} overflow-hidden ${editingRole ? "ring-2 ring-blue-300" : ""}`}>
        <p className="px-4 py-3 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100 flex justify-between">
          <span>Permission matrix</span>
          {editingRole && <span className="text-blue-600 normal-case font-medium">Click to toggle</span>}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 min-w-[200px]">Permission</th>
                {matrixRoles.map((r) => (
                  <th key={r.role} className="px-4 py-3 text-center whitespace-nowrap">
                    {r.label}
                    {editingRole === r.role && <span className="block text-blue-600 font-normal normal-case">editing</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCatalog.map((p) => (
                <tr key={p.code} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 text-xs">{p.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{p.code}</p>
                  </td>
                  {matrixRoles.map((r) => {
                    const allowed = roleAllowed(r, p.code);
                    const isEditing = editingRole === r.role && r.editable;
                    const locked = !r.editable;
                    return (
                      <td key={r.role} className="px-4 py-3 text-center">
                        {locked ? (
                          allowed ? (
                            <Check size={18} className="inline text-emerald-600" />
                          ) : (
                            <X size={18} className="inline text-slate-300" />
                          )
                        ) : isEditing ? (
                          <button
                            type="button"
                            onClick={() => togglePerm(p.code, r.role)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                              allowed
                                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                : "bg-white border-slate-200 text-slate-300 hover:border-slate-300"
                            }`}
                            aria-label={allowed ? "Remove permission" : "Grant permission"}
                          >
                            {allowed ? <Check size={16} /> : <X size={16} />}
                          </button>
                        ) : allowed ? (
                          <Check size={18} className="inline text-emerald-600" />
                        ) : (
                          <X size={18} className="inline text-slate-300" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        School-level roles (principal, bursar, teacher) are managed inside each school&apos;s Admin module.
      </p>
    </div>
  );
};
