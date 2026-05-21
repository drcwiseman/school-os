import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Loader2, Megaphone } from "lucide-react";

export const StudentNoticeboardPage: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/student-mgmt/noticeboard`)
      .then((r) => setRows(r.data ?? []))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Megaphone className="w-5 h-5" /> Student noticeboard</h2>
        <Link to={`/s/${schoolSlug}/messaging`} className="btn-ghost text-sm">Manage announcements</Link>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (
        <ul className="space-y-3">
          {rows.map((a: any) => (
            <li key={a.id} className="card p-4">
              <p className="text-white font-medium">{a.title}</p>
              <p className="text-slate-500 text-xs capitalize mb-2">{a.audience} · {new Date(a.createdAt).toLocaleString()}</p>
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{a.body}</p>
            </li>
          ))}
          {!rows.length && <p className="text-slate-500">No published announcements for students/parents.</p>}
        </ul>
      )}
    </div>
  );
};
