import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api/client";
import { Link } from "react-router-dom";

export const AddonMarketplace: React.FC = () => {
  const [addons, setAddons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/platform/addons")
      .then((r) => setAddons(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Add-ons marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">Global catalog — activate per school on the school detail page.</p>
      </div>
      {loading ? (
        <Loader2 className="animate-spin text-indigo-600 mx-auto" />
      ) : (
        <ul className="space-y-3">
          {addons.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">{a.name}</p>
              <p className="text-xs font-mono text-slate-500 mt-1">{a.code}</p>
              {a.description && <p className="text-sm text-slate-600 mt-2">{a.description}</p>}
            </li>
          ))}
        </ul>
      )}
      <Link to="/platform/tenants" className="text-sm text-indigo-600 font-medium">Manage per school →</Link>
    </div>
  );
};
