import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { Loader2 } from "lucide-react";

function formatMoney(cents: number | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

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

  const logout = async () => {
    await api.post(`/s/${schoolSlug}/api/portal/logout`, {});
    window.location.href = `/s/${schoolSlug}/portal/login`;
  };

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
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">Parent & student portal</h1>
            <p className="text-slate-400 text-sm">{account?.email}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-ghost text-sm" onClick={logout}>Sign out</button>
            <Link to={`/s/${schoolSlug}/portal/login`} className="text-sm text-slate-400 hover:text-white">Switch account</Link>
          </div>
        </div>

        {account?.type === "parent" && data && (
          <>
            <PortalCard title="Children">
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.children ?? []).length === 0 ? <li>No linked children.</li> : (data.children ?? []).map((c: any) => (
                  <li key={c.id}>{c.firstName} {c.lastName} — {c.admissionNumber}</li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="Fee statements">
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.statements ?? []).length === 0 ? <li>No invoices.</li> : (data.statements ?? []).map((i: any) => (
                  <li key={i.id}>{i.invoiceNo} — {formatMoney(i.totalAmount)} — <span className="capitalize">{i.status}</span></li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="Report cards">
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.reportCards ?? []).length === 0 ? <li>No published report cards yet.</li> : (data.reportCards ?? []).map((rc: any) => (
                  <li key={rc.id}>Student {rc.studentId?.slice(0, 8)} — published {new Date(rc.createdAt).toLocaleDateString()}</li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="Attendance (recent)">
              <AttendanceList rows={data.attendance ?? []} showStudent />
            </PortalCard>

            <PortalCard title="Announcements">
              <ul className="text-slate-300 text-sm space-y-2">
                {(data.announcements ?? []).length === 0 ? <li>No announcements.</li> : (data.announcements ?? []).map((a: any) => (
                  <li key={a.id}><strong className="text-white">{a.title}</strong><br />{a.body}</li>
                ))}
              </ul>
            </PortalCard>
          </>
        )}

        {account?.type === "student" && data && (
          <>
            <PortalCard title="Profile">
              <p className="text-slate-300 text-sm">
                {data.student?.firstName} {data.student?.lastName} — {data.student?.admissionNumber}
              </p>
            </PortalCard>

            {data.reportCard && (
              <PortalCard title="Report card">
                <p className="text-slate-300 text-sm">Latest published report — {new Date(data.reportCard.createdAt).toLocaleDateString()}</p>
              </PortalCard>
            )}

            <PortalCard title="Assignments">
              <ul className="text-slate-300 text-sm space-y-1">
                {(data.assignments ?? []).length === 0 ? <li>No assignments.</li> : (data.assignments ?? []).map((a: any) => (
                  <li key={a.id}>{a.title} — due {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="Attendance (recent)">
              <AttendanceList rows={data.attendance ?? []} />
            </PortalCard>
          </>
        )}
      </div>
    </div>
  );
};

function PortalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-white font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function AttendanceList({ rows, showStudent }: { rows: any[]; showStudent?: boolean }) {
  if (rows.length === 0) return <p className="text-slate-400 text-sm">No attendance records yet.</p>;
  return (
    <ul className="text-slate-300 text-sm space-y-1">
      {rows.map((r, i) => (
        <li key={i}>
          {showStudent && r.studentId ? `${r.studentId.slice(0, 8)} — ` : ""}
          {r.date ? new Date(r.date).toLocaleDateString() : "—"} — <span className="capitalize">{r.status}</span>
        </li>
      ))}
    </ul>
  );
}
