import React from "react";
import { Info } from "lucide-react";

export const HRSetupBanner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 flex gap-3">
    <Info className="w-5 h-5 shrink-0 text-amber-400" />
    <div>
      <p className="font-medium text-amber-100">HR data could not load completely</p>
      <p className="mt-1 text-amber-200/90">
        {message ?? "The server database may be missing HR tables (leave, attendance, contracts)."}
      </p>
      <p className="mt-2 text-xs text-amber-200/80">
        On the VPS run{" "}
        <code className="bg-amber-950/50 px-1.5 py-0.5 rounded font-mono">npm run db:repair --prefix server</code>
        {" "}then <code className="bg-amber-950/50 px-1.5 py-0.5 rounded font-mono">pm2 restart school-os</code> and hard-refresh.
      </p>
    </div>
  </div>
);
