import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Search, Loader2, Users } from "lucide-react";

type Child = { studentId: string; name: string; admissionNumber: string; isPrimary: boolean };
type ParentRow = {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  children: Child[];
  portalAccount: { email: string; status: string } | null;
};

export const Parents: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    api.get(`/s/${schoolSlug}/api/parents${q}`)
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [schoolSlug, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Users className="w-7 h-7 text-primary-400" /> Parents & guardians</h1>
      </div>
      <div className="card p-4">
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap rounded-xl overflow-hidden border border-slate-700/50">
          <table className="table">
            <thead>
              <tr>
                <th>Guardian</th>
                <th>Contact</th>
                <th>Children</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">No guardians found.</td></tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-medium text-white">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-500">{p.relationship}</p>
                    </td>
                    <td className="text-sm">
                      {p.phone && <p>{p.phone}</p>}
                      {p.email && <p className="text-slate-400">{p.email}</p>}
                      {p.address && <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.address}</p>}
                    </td>
                    <td>
                      <ul className="text-sm space-y-1">
                        {p.children.map((c) => (
                          <li key={c.studentId}>
                            <Link to={`/s/${schoolSlug}/students/${c.studentId}`} className="text-primary-400 hover:underline">
                              {c.name}
                            </Link>
                            <span className="text-xs text-slate-500 ml-1">({c.admissionNumber}){c.isPrimary ? " · primary" : ""}</span>
                          </li>
                        ))}
                        {!p.children.length && <span className="text-slate-500">—</span>}
                      </ul>
                    </td>
                    <td>
                      {p.portalAccount ? (
                        <span className="badge-green text-xs">{p.portalAccount.email}</span>
                      ) : (
                        <span className="badge-gray text-xs">No account</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
