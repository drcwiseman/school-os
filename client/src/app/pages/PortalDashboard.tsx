import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { Loader2 } from "lucide-react";

export const PortalDashboard: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get(`/s/${schoolSlug}/api/portal/me`);
        setAccount(me.account);
        const dash = await api.get(`/s/${schoolSlug}/api/portal/dashboard`);
        setData(dash.data);
      } catch {
        window.location.href = `/s/${schoolSlug}/portal/login`;
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Portal — {account?.type}</h1>
          <Link to={`/s/${schoolSlug}/portal/login`} className="text-sm text-slate-400">Switch account</Link>
        </div>
        {account?.type === "parent" && data && (
          <>
            <div className="card p-5">
              <h2 className="text-white font-semibold mb-2">Children</h2>
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.children ?? []).map((c: any) => (
                  <li key={c.id}>{c.firstName} {c.lastName} ({c.admissionNumber})</li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="text-white font-semibold mb-2">Fee statements</h2>
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.statements ?? []).map((i: any) => (
                  <li key={i.id}>{i.invoiceNo} — {i.status}</li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="text-white font-semibold mb-2">Announcements</h2>
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.announcements ?? []).map((a: any) => (
                  <li key={a.id}><strong>{a.title}</strong>: {a.body}</li>
                ))}
              </ul>
            </div>
          </>
        )}
        {account?.type === "student" && data && (
          <div className="card p-5">
            <h2 className="text-white font-semibold mb-2">Assignments</h2>
            <ul className="text-slate-300 text-sm space-y-1">
              {(data.assignments ?? []).map((a: any) => (
                <li key={a.id}>{a.title} — due {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
