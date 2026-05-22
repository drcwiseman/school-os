import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Database, Loader2 } from "lucide-react";

type Props = {
  schoolSlug: string;
  /** Show link to Administration tab when embedded outside Admin */
  showAdminLink?: boolean;
};

export const DemoDataPanel: React.FC<Props> = ({ schoolSlug, showAdminLink }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const canManage = hasPermission("settings.manage");

  const loadDemo = async (full: boolean) => {
    const msg = full
      ? "Replace ALL operational data with a full Uganda secondary demo (54 students, linked parents, teachers)? Your main admin login is kept."
      : "Add missing demo records only (keeps existing students and parents)?";
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/admin/demo-seed`, { full });
      const stats = res.data?.stats;
      const statLine = stats
        ? `${stats.students} students · ${stats.parents} parents · ${stats.staff} staff`
        : "";
      toast([res.data?.message, statLine].filter(Boolean).join(" — "), "success");
    } catch (err: unknown) {
      const apiErr = err as Error & { errors?: { field: string; message: string }[] };
      const detail = apiErr.errors?.map((e) => e.message).join("; ");
      toast(detail || apiErr.message || "Demo load failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) {
    return (
      <div className="card p-6 border border-amber-900/40 bg-amber-950/20">
        <p className="text-sm text-amber-200/90">
          Demo data requires the <span className="font-mono">settings.manage</span> permission.
          Ask your school admin to grant this on your role, or sign in as the school administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4 border border-emerald-900/40 bg-emerald-950/10">
      <div className="flex items-start gap-3">
        <Database className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-white">Uganda secondary demo data</h3>
          <p className="text-sm text-slate-400 mt-1">
            Senior 1–6, 54 students, parents with portal logins, head teacher, subject teachers, UGX settings, and sample invoices.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={loading} onClick={() => loadDemo(true)}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Loading…" : "Load full demo (reset + seed)"}
        </button>
        <button type="button" className="btn-secondary" disabled={loading} onClick={() => loadDemo(false)}>
          Add missing only
        </button>
      </div>
      <div className="text-xs text-slate-500 space-y-1 font-mono">
        <p>Parent portal: parent.s1.01@{schoolSlug}.demo / Parent123!</p>
        <p>Head teacher: headteacher@{schoolSlug}.demo / Demo123!</p>
      </div>
      {showAdminLink && (
        <p className="text-xs text-slate-500">
          Same tools under <Link to={`/s/${schoolSlug}/admin`} className="text-primary-400 hover:underline">Administration</Link>
          {" → "}
          <span className="text-slate-400">Demo data</span> tab.
        </p>
      )}
    </div>
  );
};
