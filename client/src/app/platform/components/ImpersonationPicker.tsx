import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { normalizeAppUrl } from "../../lib/app-origin";

export type ImpersonationUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roleNames: string[];
};

type StaffNeedingLogin = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  department: string | null;
  suggestedRole: string;
};

type Props = {
  slug: string;
  schoolName?: string;
  compact?: boolean;
  onSuccess?: () => void;
};

export const ImpersonationPicker: React.FC<Props> = ({ slug, schoolName, compact, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<ImpersonationUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [staffNeedingLogin, setStaffNeedingLogin] = useState<StaffNeedingLogin[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [userId, setUserId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [provisionStaffLogin, setProvisionStaffLogin] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/platform/tenants/${slug}/impersonation-targets`);
      const list = (res.data?.users ?? []) as ImpersonationUser[];
      setUsers(list);
      setRoles(res.data?.roles ?? []);
      setStaffNeedingLogin((res.data?.staffNeedingLogin ?? []) as StaffNeedingLogin[]);
      const teachers = list.filter((u) => u.roleNames.some((r) => r.toLowerCase() === "teacher"));
      if (!userId && !staffId) {
        if (teachers.length) {
          setUserId(teachers[0].id);
          setStaffId("");
        } else if (list.length) {
          const admin = list.find((u) =>
            u.roleNames.some((r) => /school administrator|administrator/i.test(r)),
          );
          setUserId(admin?.id ?? list[0].id);
        } else if ((res.data?.staffNeedingLogin ?? []).length) {
          setStaffId((res.data.staffNeedingLogin as StaffNeedingLogin[])[0].id);
          setUserId("");
        }
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not load users", "error");
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!roleFilter) return users;
    return users.filter((u) => u.roleNames.some((r) => r.toLowerCase() === roleFilter.toLowerCase()));
  }, [users, roleFilter]);

  useEffect(() => {
    if (staffId) return;
    if (filtered.length && !filtered.some((u) => u.id === userId)) {
      setUserId(filtered[0].id);
    }
  }, [filtered, userId, staffId]);

  const selected = users.find((u) => u.id === userId);
  const selectedStaff = staffNeedingLogin.find((s) => s.id === staffId);

  const impersonate = async () => {
    if (!userId && !staffId) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { readOnly };
      if (staffId) {
        body.staffId = staffId;
        body.roleName = roleFilter || selectedStaff?.suggestedRole || "Teacher";
        body.provisionStaffLogin = provisionStaffLogin;
      } else {
        body.userId = userId;
        if (roleFilter) body.roleName = roleFilter;
      }
      const res = await api.post(`/api/platform/tenants/${slug}/impersonate`, body);
      const raw = res.data?.url?.startsWith("http")
        ? res.data.url
        : `${window.location.origin}${res.data.url}`;
      window.open(normalizeAppUrl(raw), "_blank", "noopener,noreferrer");
      const who = res.data?.user;
      toast(
        readOnly
          ? `Shadow session: ${who?.firstName ?? ""} ${who?.lastName ?? ""}`.trim()
          : `Opened as ${who?.email ?? "user"}`,
        "success",
      );
      onSuccess?.();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Impersonation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading staff accounts…
      </div>
    );
  }

  if (users.length === 0 && staffNeedingLogin.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        No ERP users or teaching staff for {schoolName ?? slug}. Add employees in HR with an email, or create a school administrator.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Filter by role
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setStaffId("");
            }}
          >
            <option value="">All roles ({users.length})</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r} ({users.filter((u) => u.roleNames.some((n) => n.toLowerCase() === r.toLowerCase())).length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Login as ERP user
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setStaffId("");
            }}
            disabled={!filtered.length}
          >
            {filtered.length === 0 && <option value="">No users for this role</option>}
            {filtered.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} — {u.roleNames.join(", ") || "No role"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {staffNeedingLogin.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-900">
            Teachers in HR without ERP login ({staffNeedingLogin.length})
          </p>
          <select
            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setUserId("");
            }}
          >
            <option value="">— Select to create login &amp; enter —</option>
            {staffNeedingLogin.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.email}>
                {s.firstName} {s.lastName} ({s.employeeNo})
                {!s.email ? " — add email in HR first" : ` · ${s.suggestedRole}`}
              </option>
            ))}
          </select>
          {selectedStaff && (
            <label className="flex items-center gap-2 text-xs text-amber-900">
              <input
                type="checkbox"
                checked={provisionStaffLogin}
                onChange={(e) => setProvisionStaffLogin(e.target.checked)}
              />
              Create ERP login ({selectedStaff.suggestedRole}) before opening
            </label>
          )}
        </div>
      )}

      {(selected || selectedStaff) && (
        <p className="text-xs text-slate-500 font-mono">
          {selected
            ? `${selected.email} · ${selected.roleNames.join(" · ")}`
            : selectedStaff?.email
              ? `${selectedStaff.email} · will provision as ${selectedStaff.suggestedRole}`
              : "Add an email in HR before impersonating this teacher"}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
        Read-only shadow (no writes)
      </label>

      <button
        type="button"
        disabled={submitting || (!userId && !staffId) || Boolean(staffId && selectedStaff && !selectedStaff.email)}
        onClick={() => void impersonate()}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
        Open school as selected user
      </button>
    </div>
  );
};
