import React from "react";
import { Database } from "lucide-react";

export const AuditLogs: React.FC = () => (
  <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-10 text-center">
    <Database className="mx-auto text-slate-600 mb-3" size={36} />
    <h2 className="text-lg font-bold text-white">Global audit trail</h2>
    <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
      Platform-level immutable audit stream (tenant suspend, plan changes, impersonation) — wired to append-only <code className="text-slate-300">audit_logs</code> in Phase 17.
    </p>
  </div>
);
