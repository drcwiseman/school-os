import React, { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Users } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { schoolPath } from "../../lib/tenant-host";

type PortalRow = {
  type: "parent" | "student";
  email: string;
  status: string;
  studentAdmissionNumber: string | null;
  studentName: string | null;
  guardianName: string | null;
  isDemoAccount: boolean;
  suggestedPassword: string | null;
};

type PortalData = {
  portalUrl: string;
  note: string;
  demoPasswords: { parent: string; student: string };
  counts: { parents: number; students: number };
  parents: PortalRow[];
  students: PortalRow[];
  samples: { parent: PortalRow[]; student: PortalRow[] };
};

export const PortalLoginsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"parent" | "student">("parent");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admin/portal-logins`);
      setData(res.data ?? null);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not load portal logins", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { void load(); }, [load]);

  const portalUrl = data?.portalUrl
    ? (data.portalUrl.startsWith("http") ? data.portalUrl : `${window.location.origin}${data.portalUrl}`)
    : schoolPath(schoolSlug, "portal/login");

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(
      () => toast(`${label} copied`, "success"),
      () => toast("Copy failed", "error"),
    );
  };

  const copyCred = (row: PortalRow) => {
    const pwd = row.suggestedPassword ?? "(password set by school — use reset or ask admin)";
    copy(`${row.email}\n${pwd}`, `${row.type} login`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!data) return null;

  const rows = tab === "parent" ? data.parents : data.students;

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4 border border-primary-900/30 bg-primary-950/10">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-400" />
          Parent &amp; student portal logins
        </h3>
        <p className="text-sm text-slate-400">{data.note}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <code className="text-xs text-primary-300 bg-slate-900/80 px-2 py-1 rounded break-all">{portalUrl}</code>
          <a href={portalUrl} target="_blank" rel="noreferrer" className="btn-primary text-xs inline-flex gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Open portal
          </a>
          <button type="button" className="btn-ghost text-xs" onClick={() => copy(portalUrl, "Portal URL")}>
            <Copy className="w-3.5 h-3.5" /> Copy URL
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-900/50 p-3 border border-slate-800">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Demo parent password</p>
            <p className="font-mono text-emerald-300 mt-1">{data.demoPasswords.parent}</p>
            <p className="text-xs text-slate-500 mt-1">For emails ending in @{schoolSlug}.demo</p>
          </div>
          <div className="rounded-lg bg-slate-900/50 p-3 border border-slate-800">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Demo student password</p>
            <p className="font-mono text-emerald-300 mt-1">{data.demoPasswords.student}</p>
            <p className="text-xs text-slate-500 mt-1">For student.*@{schoolSlug}.demo</p>
          </div>
        </div>
      </div>

      {(data.samples.parent.length > 0 || data.samples.student.length > 0) && (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick copy (demo)</p>
          <div className="flex flex-wrap gap-2">
            {data.samples.parent.map((p) => (
              <button key={p.email} type="button" className="btn-ghost text-xs" onClick={() => copyCred(p)}>
                Parent {p.studentAdmissionNumber}
              </button>
            ))}
            {data.samples.student.map((s) => (
              <button key={s.email} type="button" className="btn-ghost text-xs" onClick={() => copyCred(s)}>
                Student {s.studentAdmissionNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-2 rounded-lg text-sm ${tab === "parent" ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}
          onClick={() => setTab("parent")}
        >
          Parents ({data.counts.parents})
        </button>
        <button
          type="button"
          className={`px-3 py-2 rounded-lg text-sm ${tab === "student" ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}
          onClick={() => setTab("student")}
        >
          Students ({data.counts.students})
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Email</th>
              <th>Linked student</th>
              {tab === "parent" && <th>Guardian</th>}
              <th>Password</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={tab === "parent" ? 5 : 4} className="text-center py-10 text-slate-500">
                  No {tab} portal accounts yet.
                  {tab === "student" && " Create them from a student profile or run Load full demo."}
                  {tab === "parent" && " Run Load full demo or create from Parents / student guardian."}
                </td>
              </tr>
            ) : (
              rows.slice(0, 100).map((r) => (
                <tr key={r.email}>
                  <td className="font-mono text-xs">{r.email}</td>
                  <td>
                    {r.studentAdmissionNumber && (
                      <span>
                        {r.studentAdmissionNumber}
                        {r.studentName && <span className="text-slate-500 block text-xs">{r.studentName}</span>}
                      </span>
                    )}
                  </td>
                  {tab === "parent" && <td className="text-slate-400 text-xs">{r.guardianName ?? "—"}</td>}
                  <td className="font-mono text-xs text-emerald-400">
                    {r.suggestedPassword ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td>
                    <button type="button" className="btn-ghost text-xs py-1" onClick={() => copyCred(r)}>
                      Copy
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {rows.length > 100 && (
          <p className="text-xs text-slate-500 p-3 border-t border-slate-800">Showing first 100 of {rows.length}.</p>
        )}
      </div>
    </div>
  );
};
