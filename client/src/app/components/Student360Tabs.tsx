import React, { useEffect, useState } from "react";
import { api, downloadPdf } from "../api/client";
import { useAuth } from "../state/AuthContext";

type Props = { schoolSlug: string; studentId: string };

const DOC_TYPES = ["national_id", "birth_certificate", "medical_report", "transfer_letter", "achievement", "other"];

export const Student360Tabs: React.FC<Props> = ({ schoolSlug, studentId }) => {
  const { formatMoney } = useAuth();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<any>(null);
  const [medical, setMedical] = useState({ allergies: "", conditions: "", emergencyContact: "", emergencyPhone: "" });
  const [biometricId, setBiometricId] = useState("");
  const [certForm, setCertForm] = useState({ title: "Certificate of Achievement", body: "" });

  const reload = () => {
    api.get(`/s/${schoolSlug}/api/students/${studentId}/360`).then((res) => {
      setData(res.data);
      const m = res.data?.medical ?? {};
      setMedical({
        allergies: m.allergies ?? "",
        conditions: m.conditions ?? "",
        emergencyContact: m.emergencyContact ?? "",
        emergencyPhone: m.emergencyPhone ?? "",
      });
      setBiometricId(res.data?.biometricId ?? "");
    });
  };

  useEffect(() => { reload(); }, [schoolSlug, studentId]);

  const saveMedical = async () => {
    await api.patch(`/s/${schoolSlug}/api/students/${studentId}/medical`, { medicalJson: medical, biometricId });
    reload();
  };

  const issueCert = async () => {
    await downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/achievement-certificate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(certForm),
    });
    reload();
  };

  const tabs = ["overview", "attendance", "fees", "leaves", "documents", "certificates", "medical", "discipline", "ops", "analytics", "id-card"];
  if (!data) return null;

  return (
    <div className="card p-6 mt-6 space-y-4">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h3 className="font-semibold text-white">360° student profile</h3>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/fee-report`)}
        >
          Fee report PDF
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm capitalize ${tab === t ? "bg-primary-600/40 text-primary-200" : "text-slate-400"}`}>{t.replace("-", " ")}</button>
        ))}
      </div>
      {tab === "overview" && (
        <ul className="text-sm text-slate-300 space-y-1">
          <li>Status: <span className="capitalize">{data.student?.status}</span></li>
          {data.student?.dob && <li>DOB: {new Date(data.student.dob).toLocaleDateString()}</li>}
          {(data.classHistory ?? []).map((c: any) => (
            <li key={c.id}>{c.className} — {c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString() : ""}</li>
          ))}
        </ul>
      )}
      {tab === "attendance" && (
        <ul className="text-sm text-slate-300 space-y-1 max-h-48 overflow-y-auto">
          {(data.attendance ?? []).map((a: any, i: number) => (
            <li key={i}>{a.date ? new Date(a.date).toLocaleDateString() : "—"} — <span className="capitalize">{a.status}</span>{a.note ? ` (${a.note})` : ""}</li>
          ))}
          {!(data.attendance ?? []).length && <li className="text-slate-500">No attendance records.</li>}
        </ul>
      )}
      {tab === "medical" && (
        <div className="space-y-2 max-w-lg">
          <input className="input" placeholder="Biometric / RFID ID" value={biometricId} onChange={(e) => setBiometricId(e.target.value)} />
          <input className="input" placeholder="Allergies" value={medical.allergies} onChange={(e) => setMedical({ ...medical, allergies: e.target.value })} />
          <input className="input" placeholder="Conditions" value={medical.conditions} onChange={(e) => setMedical({ ...medical, conditions: e.target.value })} />
          <input className="input" placeholder="Emergency contact" value={medical.emergencyContact} onChange={(e) => setMedical({ ...medical, emergencyContact: e.target.value })} />
          <input className="input" placeholder="Emergency phone" value={medical.emergencyPhone} onChange={(e) => setMedical({ ...medical, emergencyPhone: e.target.value })} />
          <button type="button" className="btn-secondary text-sm" onClick={saveMedical}>Save medical</button>
        </div>
      )}
      {tab === "fees" && (
        <div className="space-y-2 text-sm text-slate-300">
          {data.feeSummary && (
            <p>
              Billed {formatMoney(data.feeSummary.totalBilled)} · Paid {formatMoney(data.feeSummary.totalPaid)} ·
              Outstanding <span className="text-amber-300">{formatMoney(data.feeSummary.outstanding)}</span>
            </p>
          )}
          <ul className="space-y-1">
            {(data.feeHistory ?? []).map((inv: any) => (
              <li key={inv.id}>{inv.invoiceNo} — {inv.status} — due {formatMoney((inv.totalAmount ?? 0) - (inv.paidAmount ?? 0))}</li>
            ))}
          </ul>
        </div>
      )}
      {tab === "leaves" && (
        <ul className="text-sm text-slate-300 space-y-1">
          {(data.leaves ?? []).map((l: any) => (
            <li key={l.id}>{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()} · <span className="capitalize">{l.status}</span> — {l.reason}</li>
          ))}
        </ul>
      )}
      {tab === "documents" && (
        <ul className="text-sm text-slate-300 space-y-1">
          {(data.documents ?? []).map((d: any) => (
            <li key={d.id} className="capitalize">{d.documentType.replace(/_/g, " ")} — {d.fileName}</li>
          ))}
        </ul>
      )}
      {tab === "certificates" && (
        <div className="space-y-3 max-w-lg">
          <ul className="text-sm text-slate-300 space-y-1">
            {(data.certificates ?? []).map((c: any) => (
              <li key={c.id}>{c.title} ({c.certType}) — {new Date(c.issuedAt).toLocaleDateString()}</li>
            ))}
          </ul>
          <input className="input" value={certForm.title} onChange={(e) => setCertForm({ ...certForm, title: e.target.value })} />
          <textarea className="input min-h-[60px]" value={certForm.body} onChange={(e) => setCertForm({ ...certForm, body: e.target.value })} placeholder="Certificate text…" />
          <button type="button" className="btn-primary text-sm" onClick={issueCert}>Issue & download PDF</button>
          {(data.transfers ?? []).length > 0 && (
            <button
              type="button"
              className="btn-ghost text-sm block"
              onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/transfer-certificate?transferId=${data.transfers[0].id}`)}
            >
              Download transfer certificate
            </button>
          )}
        </div>
      )}
      {tab === "discipline" && (
        <ul className="text-sm text-slate-300 space-y-1">
          {(data.discipline ?? []).map((d: any) => (
            <li key={d.id}>{d.category}: {d.description}</li>
          ))}
        </ul>
      )}
      {tab === "ops" && (
        <div className="text-sm text-slate-300 space-y-2">
          <p>Hostel: {data.hostel ? `${data.hostel.house} / ${data.hostel.room}` : "—"}</p>
          <p>Transport: {data.transport?.routeName ?? "—"}</p>
        </div>
      )}
      {tab === "analytics" && (
        <div className="text-sm text-slate-300 space-y-2">
          <p>Average: {data.analytics?.averagePercent != null ? `${Math.round(data.analytics.averagePercent)}%` : "—"} ({data.analytics?.gradeCount} assessments)</p>
          <ul className="space-y-1">
            {(data.analytics?.grades ?? []).map((g: any, i: number) => (
              <li key={i}>{g.assessmentTitle}: {g.score}/{g.maxScore}</li>
            ))}
          </ul>
        </div>
      )}
      {tab === "id-card" && (
        <div className="space-y-3">
          <div className="border border-slate-600 rounded-lg p-4 max-w-xs bg-white text-slate-900">
            <p className="font-bold">{data.student?.firstName} {data.student?.lastName}</p>
            <p className="text-xs">{data.student?.admissionNumber}</p>
            {data.student?.photoUrl && <img src={data.student.photoUrl} alt="" className="w-20 h-20 object-cover mt-2 rounded" />}
          </div>
          <button type="button" className="btn-secondary text-sm" onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/id-card`)}>
            Download ID card PDF
          </button>
        </div>
      )}
    </div>
  );
};

export { DOC_TYPES };
