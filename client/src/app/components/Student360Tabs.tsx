import React, { useEffect, useState } from "react";
import { api } from "../api/client";

type Props = { schoolSlug: string; studentId: string };

export const Student360Tabs: React.FC<Props> = ({ schoolSlug, studentId }) => {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<any>(null);
  const [medical, setMedical] = useState({ allergies: "", conditions: "", emergencyContact: "", emergencyPhone: "" });
  const [biometricId, setBiometricId] = useState("");

  useEffect(() => {
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
  }, [schoolSlug, studentId]);

  const saveMedical = async () => {
    await api.patch(`/s/${schoolSlug}/api/students/${studentId}/medical`, { medicalJson: medical, biometricId });
  };

  const tabs = ["overview", "medical", "fees", "discipline", "ops", "analytics", "id-card"];
  if (!data) return null;

  return (
    <div className="card p-6 mt-6 space-y-4">
      <h3 className="font-semibold text-white">360° student profile</h3>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm capitalize ${tab === t ? "bg-primary-600/40 text-primary-200" : "text-slate-400"}`}>{t.replace("-", " ")}</button>
        ))}
      </div>
      {tab === "overview" && (
        <ul className="text-sm text-slate-300 space-y-1">
          {(data.classHistory ?? []).map((c: any) => (
            <li key={c.id}>{c.className} — {c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString() : ""}</li>
          ))}
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
        <ul className="text-sm text-slate-300 space-y-1">
          {(data.feeHistory ?? []).map((inv: any) => (
            <li key={inv.id}>{inv.invoiceNo} — {inv.status} — balance {(inv.totalAmount - inv.paidAmount) / 100}</li>
          ))}
        </ul>
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
        <p className="text-sm text-slate-300">Average: {data.analytics?.averagePercent != null ? `${Math.round(data.analytics.averagePercent)}%` : "—"} ({data.analytics?.gradeCount} assessments)</p>
      )}
      {tab === "id-card" && (
        <div className="border border-slate-600 rounded-lg p-4 max-w-xs bg-white text-slate-900 print:block">
          <p className="font-bold">{data.student?.firstName} {data.student?.lastName}</p>
          <p className="text-xs">{data.student?.admissionNumber}</p>
          {data.student?.photoUrl && <img src={data.student.photoUrl} alt="" className="w-20 h-20 object-cover mt-2 rounded" />}
          <button type="button" className="btn-secondary text-xs mt-3" onClick={() => window.print()}>Print ID card</button>
        </div>
      )}
    </div>
  );
};
