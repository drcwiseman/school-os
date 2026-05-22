import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  X,
  Shield,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { usePlatformAuth } from "../hooks/usePlatformAuth";
import { PasswordInput } from "../../components/PasswordInput";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  support: "Support",
  billing: "Billing",
};

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-violet-50 text-violet-700 ring-violet-600/20",
  support: "bg-blue-50 text-blue-700 ring-blue-600/20",
  billing: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

type AdminRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  activeSessions: number;
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ROLE_STYLES[role] ?? "bg-slate-100 text-slate-600"}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export const PlatformUsersHub: React.FC = () => {
  const { toast } = useToast();
  const { admin: me } = usePlatformAuth();
  const canManage = me?.role === "super_admin";

  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [modal, setModal] = useState<"create" | "edit" | "password" | null>(null);
  const [editRow, setEditRow] = useState<AdminRow | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("support");
  const [formPassword, setFormPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/api/platform/users");
      const payload = res.data as { admins?: AdminRow[] } | AdminRow[] | undefined;
      setRows(Array.isArray(payload) ? payload : (payload?.admins ?? []));
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

  const stats = useMemo(() => ({
    total: rows.length,
    superAdmin: rows.filter((r) => r.role === "super_admin").length,
    support: rows.filter((r) => r.role === "support").length,
    billing: rows.filter((r) => r.role === "billing").length,
    online: rows.filter((r) => r.activeSessions > 0).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
      );
    });
  }, [rows, search, roleFilter]);

  const openCreate = () => {
    setEditRow(null);
    setFormEmail("");
    setFormName("");
    setFormRole("support");
    setFormPassword("");
    setModal("create");
  };

  const openEdit = (row: AdminRow) => {
    setEditRow(row);
    setFormName(row.name);
    setFormRole(row.role);
    setModal("edit");
  };

  const openPassword = (row: AdminRow) => {
    setEditRow(row);
    setFormPassword("");
    setModal("password");
  };

  const saveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/platform/users", {
        email: formEmail,
        name: formName,
        role: formRole,
        password: formPassword,
      });
      toast("User created — welcome email sent with login details", "success");
      setModal(null);
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    try {
      await api.patch(`/api/platform/users/${editRow.id}`, { name: formName, role: formRole });
      toast("User updated", "success");
      setModal(null);
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    try {
      await api.post(`/api/platform/users/${editRow.id}/reset-password`, { newPassword: formPassword });
      toast("Password reset — email sent with new login details", "success");
      setModal(null);
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (row: AdminRow) => {
    if (!window.confirm(`Remove platform user "${row.name}" (${row.email})?`)) return;
    try {
      await api.delete(`/api/platform/users/${row.id}`);
      toast("User removed", "success");
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    }
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
              <Users size={20} className="text-blue-600" />
              Platform users
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              SchoolOS operator accounts (not school staff). New users and password resets receive an email with login URL and credentials (requires platform SMTP on the server).
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
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus size={14} />
                Add user
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Super admin", value: stats.superAdmin },
          { label: "Support", value: stats.support },
          { label: "Billing", value: stats.billing },
          { label: "Active sessions", value: stats.online },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search name, email, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="support">Support</option>
          <option value="billing">Billing</option>
        </select>
      </div>

      {!canManage && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          You have read-only access. Contact a super admin to add or change platform users.
        </p>
      )}

      <div className={`${CARD} p-4 mb-2`}>
        <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
          <Shield size={12} /> Role capabilities
        </p>
        <ul className="text-xs text-slate-600 space-y-1 grid sm:grid-cols-3 gap-2">
          <li><strong className="text-violet-700">Super Admin</strong> — full platform access, provision schools, plans, payouts</li>
          <li><strong className="text-blue-700">Support</strong> — view schools, features, suspend, support tickets, stats</li>
          <li><strong className="text-emerald-700">Billing</strong> — subscriptions, plans read/assign, revenue & finance views</li>
        </ul>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Joined</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50/80 ${r.id === me?.id ? "bg-blue-50/30" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-[11px] text-slate-500">{r.email}</p>
                    {r.id === me?.id && <p className="text-[10px] text-blue-600 font-medium">You</p>}
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={r.role} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600 tabular-nums">
                    {r.activeSessions > 0 ? (
                      <span className="text-emerald-600 font-medium">{r.activeSessions} active</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDate(r.createdAt)}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openEdit(r)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => openPassword(r)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-amber-600" title="Reset password">
                          <KeyRound size={15} />
                        </button>
                        {r.id !== me?.id && (
                          <button type="button" onClick={() => removeAdmin(r)} className="p-1.5 rounded text-slate-500 hover:bg-red-50 hover:text-red-600" title="Remove">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">No platform users match your filters.</p>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {modal === "create" ? "Add platform user" : modal === "edit" ? "Edit user" : "Reset password"}
              </h2>
              <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            {modal === "create" && (
              <form onSubmit={saveCreate} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Email</label>
                  <input type="email" required className="input text-sm mt-1 w-full" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Display name</label>
                  <input required className="input text-sm mt-1 w-full" value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Role</label>
                  <select className="input text-sm mt-1 w-full" value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    <option value="super_admin">Super Admin</option>
                    <option value="support">Support</option>
                    <option value="billing">Billing</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Initial password (min 8)</label>
                  <PasswordInput required minLength={8} className="input text-sm mt-1 w-full" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} autoComplete="new-password" />
                </div>
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Creating…" : "Create user"}
                </button>
              </form>
            )}
            {modal === "edit" && editRow && (
              <form onSubmit={saveEdit} className="p-6 space-y-4">
                <p className="text-sm text-slate-600">{editRow.email}</p>
                <div>
                  <label className="text-xs font-medium text-slate-600">Display name</label>
                  <input required className="input text-sm mt-1 w-full" value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Role</label>
                  <select className="input text-sm mt-1 w-full" value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    <option value="super_admin">Super Admin</option>
                    <option value="support">Support</option>
                    <option value="billing">Billing</option>
                  </select>
                </div>
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </form>
            )}
            {modal === "password" && editRow && (
              <form onSubmit={savePassword} className="p-6 space-y-4">
                <p className="text-sm text-slate-600">Set a new password for <strong>{editRow.name}</strong>. Active sessions will be revoked.</p>
                <div>
                  <label className="text-xs font-medium text-slate-600">New password (min 8)</label>
                  <PasswordInput required minLength={8} className="input text-sm mt-1 w-full" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} autoComplete="new-password" />
                </div>
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Resetting…" : "Reset password"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
