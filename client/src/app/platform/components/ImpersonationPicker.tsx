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
  const [roleFilter, setRoleFilter] = useState("");
  const [userId, setUserId] = useState("");
  const [readOnly, setReadOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/platform/tenants/${slug}/impersonation-targets`);
      const list = (res.data?.users ?? []) as ImpersonationUser[];
      setUsers(list);
      setRoles(res.data?.roles ?? []);
      if (!userId && list.length) {
        const admin = list.find((u) =>
          u.roleNames.some((r) => /school administrator|administrator/i.test(r)),
        );
        setUserId(admin?.id ?? list[0].id);
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
    return users.filter((u) => u.roleNames.includes(roleFilter));
  }, [users, roleFilter]);

  useEffect(() => {
    if (filtered.length && !filtered.some((u) => u.id === userId)) {
      setUserId(filtered[0].id);
    }
  }, [filtered, userId]);

  const selected = users.find((u) => u.id === userId);

  const impersonate = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/impersonate`, {
        userId,
        readOnly,
      });
      const raw = res.data?.url?.startsWith("http")
        ? res.data.url
        : `${window.location.origin}${res.data.url}`;
      window.open(normalizeAppUrl(raw), "_blank", "noopener,noreferrer");
      const who = res.data?.user;
      toast(
        readOnly
          ? `Shadow session: ${who?.firstName ?? ""} ${who?.lastName ?? ""}`.trim()
          : `Logged in as ${who?.email ?? "user"}`,
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

  if (users.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        No active ERP users for {schoolName ?? slug}. Create a school administrator first.
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
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles ({users.length})</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r} ({users.filter((u) => u.roleNames.includes(r)).length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Login as user
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            {filtered.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} — {u.roleNames.join(", ") || "No role"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <p className="text-xs text-slate-500 font-mono">
          {selected.email}
          {selected.roleNames.length ? ` · ${selected.roleNames.join(" · ")}` : ""}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
        Read-only shadow (no writes)
      </label>

      <button
        type="button"
        disabled={submitting || !userId}
        onClick={() => void impersonate()}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
        Open school as selected user
      </button>
    </div>
  );
};
