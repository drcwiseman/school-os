import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Cake, Loader2 } from "lucide-react";

export const StudentBirthdaysPage: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/student-mgmt/birthdays/upcoming?days=${days}`)
      .then((r) => setRows(r.data ?? []))
      .finally(() => setLoading(false));
  }, [schoolSlug, days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Cake className="w-5 h-5 text-pink-400" /> Upcoming birthdays</h2>
        <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Next 7 days</option>
          <option value={14}>Next 14 days</option>
          <option value={30}>Next 30 days</option>
          <option value={60}>Next 60 days</option>
        </select>
      </div>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((s: any) => (
            <li key={s.id} className="card p-4">
              <p className="text-white font-medium">{s.firstName} {s.lastName}</p>
              <p className="text-slate-500 text-sm">{s.admissionNumber}</p>
              <p className="text-pink-300 text-sm mt-2">
                {s.dob ? new Date(s.dob).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                {s.daysUntil === 0 ? " · Today!" : ` · in ${s.daysUntil} day(s)`}
              </p>
            </li>
          ))}
          {!rows.length && <p className="text-slate-500 col-span-full">No birthdays in this window.</p>}
        </ul>
      )}
    </div>
  );
};
