import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../../api/client";

type Row = {
  id: string;
  source: string;
  action: string;
  entity_type: string;
  tenant_name?: string;
  actor?: string;
  created_at: string;
};

export const AuditLogs: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/platform/audit-logs?limit=150")
      .then((res) => setRows(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">School ERP events and platform operator actions.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">School</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.source}-${r.id}`} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.source === "platform" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{r.tenant_name ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.action}</td>
                  <td className="px-5 py-3 text-slate-500">{r.actor ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">No events yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
