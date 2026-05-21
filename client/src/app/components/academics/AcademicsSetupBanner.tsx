import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Info } from "lucide-react";

type Props = { schoolSlug: string };

export const AcademicsSetupBanner: React.FC<Props> = ({ schoolSlug }) => {
  const [counts, setCounts] = useState<{ years: number; terms: number; classes: number; subjects: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/context`)
      .then((r) => setCounts(r.data?.counts ?? null))
      .catch((err: any) => setError(err.message ?? "API error"));
  }, [schoolSlug]);

  if (error) {
    return (
      <div className="card p-4 border border-red-900/50 text-sm text-slate-300">
        Academics API error: <strong className="text-red-400">{error}</strong>. On the server run{" "}
        <code className="text-xs bg-slate-800 px-1 rounded">npm run db:repair --prefix server</code> then restart.
      </div>
    );
  }

  if (!counts) return null;

  const ready = counts.years > 0 && counts.terms > 0 && counts.classes > 0;
  if (ready) return null;

  return (
    <div className="card p-4 border border-amber-900/50 text-sm text-slate-300 flex gap-2">
      <Info className="w-5 h-5 text-amber-400 shrink-0" />
      <span>
        Set up your structure: {counts.years === 0 && "add an academic year, "}
        {counts.terms === 0 && "add a term, "}
        {counts.classes === 0 && "add a class, "}
        or{" "}
        <Link to={`/s/${schoolSlug}/admin`} className="text-amber-400 hover:underline">Admin → Utilities</Link> →{" "}
        <strong>Load demo data</strong>.
      </span>
    </div>
  );
};
