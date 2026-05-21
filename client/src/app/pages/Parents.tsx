import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Search, Loader2, Users, Mail, Phone, UserPlus, Shield } from "lucide-react";

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
  const { hasPermission, moduleEnabled } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [portalTarget, setPortalTarget] = useState<ParentRow | null>(null);
  const [portalForm, setPortalForm] = useState({ email: "", password: "" });
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchParents = () => {
    setLoading(true);
    const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
    api.get(`/s/${schoolSlug}/api/parents${q}`)
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchParents();
  }, [schoolSlug, debouncedSearch]);

  const stats = useMemo(() => ({
    total: rows.length,
    withPortal: rows.filter((p) => p.portalAccount).length,
    withChildren: rows.filter((p) => p.children.length > 0).length,
  }), [rows]);

  const provisionPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalTarget) return;
    const studentId = portalTarget.children.find((c) => c.isPrimary)?.studentId ?? portalTarget.children[0]?.studentId;
    if (!studentId) return toast("Link this guardian to a student first", "error");
    setProvisioning(true);
    try {
      await api.post(`/s/${schoolSlug}/api/students/${studentId}/guardians/${portalTarget.id}/parent-portal`, portalForm);
      toast("Parent portal account created", "success");
      setPortalTarget(null);
      setPortalForm({ email: "", password: "" });
      fetchParents();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent dark:from-violet-500/5 -z-10" />

      <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-violet-400" />
            Parents & Guardians
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Directory of guardians linked to students. Manage links and parent portal access from student profiles.
          </p>
        </div>
        {hasPermission("students.create") && (
          <Link
            to={`/s/${schoolSlug}/students/new`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Add student + guardian
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Guardians</p>
          <p className="mt-1 text-2xl font-bold text-violet-400">{loading ? "—" : stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">With portal login</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{loading ? "—" : stats.withPortal}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Linked to students</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{loading ? "—" : stats.withChildren}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
              placeholder="Search name, phone, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500">
            Guardians are created when enrolling students or from a student profile.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-700/50">
                <th className="px-5 py-3 font-semibold text-slate-400">Guardian</th>
                <th className="px-5 py-3 font-semibold text-slate-400">Contact</th>
                <th className="px-5 py-3 font-semibold text-slate-400">Children</th>
                <th className="px-5 py-3 font-semibold text-slate-400">Parent portal</th>
                <th className="px-5 py-3 font-semibold text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-500" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    {debouncedSearch ? "No guardians match your search." : "No guardians yet. Add a student with parent details to get started."}
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{p.relationship}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {p.phone && (
                        <p className="flex items-center gap-1.5 text-sm">
                          <Phone className="w-3.5 h-3.5 text-slate-500" /> {p.phone}
                        </p>
                      )}
                      {p.email && (
                        <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                          <Mail className="w-3.5 h-3.5 text-slate-500" /> {p.email}
                        </p>
                      )}
                      {!p.phone && !p.email && <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <ul className="space-y-1">
                        {p.children.map((c) => (
                          <li key={c.studentId}>
                            <Link
                              to={`/s/${schoolSlug}/students/${c.studentId}`}
                              className="text-violet-400 hover:text-violet-300 font-medium hover:underline"
                            >
                              {c.name}
                            </Link>
                            <span className="text-xs text-slate-500 ml-1">
                              ({c.admissionNumber}){c.isPrimary ? " · primary" : ""}
                            </span>
                          </li>
                        ))}
                        {!p.children.length && <span className="text-slate-500 italic text-xs">Not linked</span>}
                      </ul>
                    </td>
                    <td className="px-5 py-4">
                      {p.portalAccount ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Shield className="w-3 h-3" />
                          {p.portalAccount.email}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-400 border border-slate-600/50">
                          No account
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {p.children[0] && (
                        <Link
                          to={`/s/${schoolSlug}/students/${p.children[0].studentId}`}
                          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                        >
                          View student
                        </Link>
                      )}
                      {moduleEnabled("portal_enabled") && hasPermission("students.edit") && !p.portalAccount && p.children.length > 0 && (
                        <button
                          type="button"
                          className="block ml-auto mt-1 text-xs font-semibold text-violet-400 hover:text-violet-300"
                          onClick={() => {
                            setPortalTarget(p);
                            setPortalForm({ email: p.email ?? "", password: "" });
                          }}
                        >
                          Create portal login
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {portalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={provisionPortal}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">
              Parent portal — {portalTarget.firstName} {portalTarget.lastName}
            </h3>
            <p className="text-sm text-slate-400">Login for the parent mobile/web portal.</p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                value={portalForm.email}
                onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Temporary password</label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                value={portalForm.password}
                onChange={(e) => setPortalForm({ ...portalForm, password: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white"
                onClick={() => setPortalTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={provisioning}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {provisioning ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
