import React, { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { api } from "../../api/client";

type Row = {
  id: string;
  source: string;
  action: string;
  entity_type: string;
  tenant_id?: string;
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
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <Database size={20} className="text-slate-500" /> Global audit trail
      </h2>
      <p className="text-xs text-slate-400">
        School ERP events plus platform actions (provision, domain, impersonation, add-ons).
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-[#090f1c] border border-slate-900 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="text-slate-500 border-b border-slate-900">
              <tr>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">Source</th>
                <th className="text-left py-3 px-4">School</th>
                <th className="text-left py-3 px-4">Action</th>
                <th className="text-left py-3 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-slate-900/60">
              {rows.map((r) => (
                <tr key={`${r.source}-${r.id}`} className="hover:bg-slate-900/30">
                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={r.source === "platform" ? "text-purple-400" : "text-blue-400"}>
                      {r.source}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">{r.tenant_name ?? "—"}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px]">{r.action}</td>
                  <td className="py-2.5 px-4 text-slate-500">{r.actor ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No audit events yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
