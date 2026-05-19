import React from "react";
import { LifeBuoy, Eye } from "lucide-react";

export const SupportHub: React.FC = () => (
  <div className="space-y-6">
    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
      <LifeBuoy className="text-blue-400" /> Support & shadow access
    </h2>
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm rounded-xl p-8">
      <p className="text-sm text-slate-400">
        Cross-tenant ticket hub and <strong className="text-slate-900">read-only impersonation</strong> require a scoped platform session token — never reuse staff cookies. See ARCHITECTURE.md platform layer.
      </p>
      <button type="button" className="mt-4 inline-flex items-center gap-2 text-xs border border-blue-500/30 text-blue-400 px-4 py-2 rounded-lg">
        <Eye size={14} /> Impersonation router (Phase 17)
      </button>
    </div>
  </div>
);
