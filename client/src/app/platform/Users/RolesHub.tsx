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

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/roles");
      setData(res.data);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

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
              Platform operator roles (not school staff RBAC). Permissions are enforced on every API route. Assign roles on{" "}
              <Link to="/platform/users" className="text-blue-600 font-medium hover:underline">Platform users</Link>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              to="/platform/users"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              <Users size={14} />
              Manage users
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {roles.map((r) => (
          <div key={r.role} className={`${CARD} p-4 border-l-4 ${ROLE_STYLES[r.role] ?? ""}`}>
            <p className="text-sm font-bold text-slate-900">{r.label}</p>
            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>
            <div className="flex gap-3 mt-3 text-xs text-slate-600">
              <span>
                <strong className="text-slate-900">{r.hasFullAccess ? "All" : r.permissionCount}</strong> permissions
              </span>
              <span>
                <strong className="text-slate-900">{data?.usersByRole[r.role]?.length ?? 0}</strong> users
              </span>
            </div>
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
        <select className="input text-sm w-auto" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
          <option value="all">Matrix: all roles</option>
          {roles.map((r) => (
            <option key={r.role} value={r.role}>{r.label} only</option>
          ))}
        </select>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <p className="px-4 py-3 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
          Permission matrix
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 min-w-[200px]">Permission</th>
                {(selectedRole === "all" ? roles : roles.filter((r) => r.role === selectedRole)).map((r) => (
                  <th key={r.role} className="px-4 py-3 text-center whitespace-nowrap">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCatalog.map((p) => (
                <tr key={p.code} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 text-xs">{p.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{p.code}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{p.description}</p>
                  </td>
                  {(selectedRole === "all" ? roles : roles.filter((r) => r.role === selectedRole)).map((r) => {
                    const allowed = r.hasFullAccess || r.permissions.includes(p.code);
                    return (
                      <td key={r.role} className="px-4 py-3 text-center">
                        {allowed ? (
                          <Check size={18} className="inline text-emerald-600" aria-label="Allowed" />
                        ) : (
                          <X size={18} className="inline text-slate-300" aria-label="Denied" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCatalog.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">No permissions match your search.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div key={r.role} className={`${CARD} p-4`}>
            <h3 className="text-sm font-bold text-slate-900">{r.label}</h3>
            <p className="text-xs text-slate-500 mt-1">{r.description}</p>
            {r.hasFullAccess && (
              <p className="text-[11px] text-violet-600 font-medium mt-2">Includes full access (wildcard)</p>
            )}
            <ul className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              {(r.hasFullAccess ? data?.catalog ?? [] : data?.catalog.filter((p) => r.permissions.includes(p.code)) ?? []).map((p) => (
                <li key={p.code} className="text-xs text-slate-600 flex gap-2">
                  <Check size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Assigned users</p>
              {(data?.usersByRole[r.role] ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">No users</p>
              ) : (
                <ul className="space-y-1">
                  {(data?.usersByRole[r.role] ?? []).map((u) => (
                    <li key={u.id} className="text-xs">
                      <span className="font-medium text-slate-800">{u.name}</span>
                      <span className="text-slate-400 block truncate">{u.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        School-level roles (principal, bursar, teacher) are managed inside each school&apos;s Admin module — not on this page.
      </p>
    </div>
  );
};
