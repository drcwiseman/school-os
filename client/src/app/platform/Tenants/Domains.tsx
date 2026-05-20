import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "../../api/client";

export const DomainsHub: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/platform/tenants")
      .then((r) => setRows(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Domains</h1>
        <p className="mt-1 text-sm text-slate-500">Subdomains and custom domains per school.</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">School</th>
                <th className="px-5 py-3 text-left">Slug / path</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-5 py-3 font-mono text-slate-600">/s/{t.slug}</td>
                  <td className="px-5 py-3 capitalize text-slate-600">{t.status}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/platform/tenants/${t.slug}`} className="text-indigo-600 hover:underline text-xs font-medium">
                      DNS & verify
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
