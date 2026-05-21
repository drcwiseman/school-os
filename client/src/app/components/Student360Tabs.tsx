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
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 shadow-xl rounded-2xl p-6 mt-6 space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-center pb-3 border-b border-slate-800/80">
        <h3 className="text-base font-bold text-white tracking-tight">360° Student Profile</h3>
        <button
          type="button"
          className="px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
          onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/fee-report`)}
        >
          Fee Report PDF
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button 
            key={t} 
            type="button" 
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize tracking-wide transition-all ${
              tab === t 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                : "text-slate-400 hover:text-white bg-slate-950/40 hover:bg-slate-800 border border-slate-800/60"
            }`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === "overview" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
                  <p className="text-white font-medium capitalize mt-0.5">{data.student?.status}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Date of Birth</span>
                  <p className="text-white font-medium mt-0.5">{data.student?.dob ? new Date(data.student.dob).toLocaleDateString() : "—"}</p>
                </div>
              </div>
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic History</span>
                <ul className="space-y-2 mt-0.5">
                  {(data.classHistory ?? []).map((c: any) => (
                    <li key={c.id} className="text-slate-350 text-sm border-l-2 border-blue-500/60 pl-2">
                      {c.className} <span className="text-slate-500 text-xs">— Enrolled: {c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString() : ""}</span>
                    </li>
                  ))}
                  {!(data.classHistory ?? []).length && <li className="text-slate-500 italic">No class history found.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "attendance" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4">
            <ul className="text-sm text-slate-300 space-y-2 max-h-60 overflow-y-auto pr-1">
              {(data.attendance ?? []).map((a: any, i: number) => (
                <li key={i} className="flex justify-between items-center border border-slate-800/50 bg-slate-950/40 rounded-xl px-4 py-2.5">
                  <div>
                    <span className="text-white font-medium">{a.date ? new Date(a.date).toLocaleDateString() : "—"}</span>
                    {a.note && <span className="text-slate-450 text-xs block mt-0.5">{a.note}</span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${
                    a.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                  }`}>
                    {a.status}
                  </span>
                </li>
              ))}
              {!(data.attendance ?? []).length && <li className="text-slate-500 italic text-center py-4">No attendance records found.</li>}
            </ul>
          </div>
        )}

        {tab === "medical" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 space-y-4 max-w-lg">
            <div className="space-y-3">
              <div>
                <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Biometric / RFID ID</label>
                <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Enter biometric sensor reference ID" value={biometricId} onChange={(e) => setBiometricId(e.target.value)} />
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Allergies</label>
                <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Known allergy concerns" value={medical.allergies} onChange={(e) => setMedical({ ...medical, allergies: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Conditions</label>
                <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Underlying medical conditions" value={medical.conditions} onChange={(e) => setMedical({ ...medical, conditions: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Emergency Contact Name</label>
                <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Guardian contact name for emergencies" value={medical.emergencyContact} onChange={(e) => setMedical({ ...medical, emergencyContact: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Emergency Phone</label>
                <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Phone number for immediate contact" value={medical.emergencyPhone} onChange={(e) => setMedical({ ...medical, emergencyPhone: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800/80">
              <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200" onClick={saveMedical}>
                Save Medical Details
              </button>
            </div>
          </div>
        )}

        {tab === "fees" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 space-y-4">
            {data.feeSummary && (
              <div className="grid grid-cols-3 gap-4 border border-slate-800 bg-slate-950/40 rounded-xl p-4 text-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Billed</span>
                  <p className="text-white font-bold text-lg mt-1">{formatMoney(data.feeSummary.totalBilled)}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Paid</span>
                  <p className="text-emerald-450 font-bold text-lg mt-1">{formatMoney(data.feeSummary.totalPaid)}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding</span>
                  <p className="text-amber-450 font-bold text-lg mt-1">{formatMoney(data.feeSummary.outstanding)}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice History</span>
              <ul className="space-y-2">
                {(data.feeHistory ?? []).map((inv: any) => (
                  <li key={inv.id} className="flex justify-between items-center border border-slate-800/60 bg-slate-950/10 rounded-xl px-4 py-3">
                    <div>
                      <span className="text-white font-medium font-mono">{inv.invoiceNo}</span>
                      <span className="text-slate-500 text-xs block mt-0.5">Due: {formatMoney((inv.totalAmount ?? 0) - (inv.paidAmount ?? 0))}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      inv.status === 'fully_paid' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
                {!(data.feeHistory ?? []).length && <li className="text-slate-500 italic py-2 text-center">No fee invoices recorded.</li>}
              </ul>
            </div>
          </div>
        )}

        {tab === "leaves" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4">
            <ul className="text-sm text-slate-300 space-y-2">
              {(data.leaves ?? []).map((l: any) => (
                <li key={l.id} className="border border-slate-800 bg-slate-950/40 rounded-xl px-4 py-3 hover:border-slate-700/60 transition-all flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="text-white font-medium">{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}</span>
                    <p className="text-slate-400 text-xs mt-1">{l.reason}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    l.status === 'approved' 
                      ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' 
                      : l.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-450'
                  }`}>
                    {l.status}
                  </span>
                </li>
              ))}
              {!(data.leaves ?? []).length && <li className="text-slate-500 italic text-center py-4">No leave requests found.</li>}
            </ul>
          </div>
        )}

        {tab === "documents" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4">
            <ul className="text-sm text-slate-350 space-y-2">
              {(data.documents ?? []).map((d: any) => (
                <li key={d.id} className="flex justify-between items-center border border-slate-800 bg-slate-950/40 rounded-xl px-4 py-3">
                  <span className="text-white font-medium capitalize">{d.documentType.replace(/_/g, " ")}</span>
                  <span className="text-slate-500 text-xs font-mono">{d.fileName}</span>
                </li>
              ))}
              {!(data.documents ?? []).length && <li className="text-slate-500 italic text-center py-4">No documents recorded.</li>}
            </ul>
          </div>
        )}

        {tab === "certificates" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 space-y-6 max-w-lg">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Issued Certificates</span>
              <ul className="space-y-2">
                {(data.certificates ?? []).map((c: any) => (
                  <li key={c.id} className="flex justify-between items-center border border-slate-800 bg-slate-950/40 rounded-xl px-4 py-3">
                    <div>
                      <span className="text-white font-medium">{c.title}</span>
                      <span className="text-slate-500 text-xs block mt-0.5">Type: {c.certType.toUpperCase()}</span>
                    </div>
                    <span className="text-slate-450 text-xs">{new Date(c.issuedAt).toLocaleDateString()}</span>
                  </li>
                ))}
                {!(data.certificates ?? []).length && <li className="text-slate-500 italic py-2">No certificates issued.</li>}
              </ul>
            </div>
            
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Issue New Achievement Certificate</span>
              <div className="space-y-3">
                <div>
                  <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-450">Certificate Title</label>
                  <input className="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={certForm.title} onChange={(e) => setCertForm((c) => ({ ...c, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-450">Body / Citation Text</label>
                  <textarea className="w-full px-4 py-3 bg-slate-950 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-550 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[80px]" value={certForm.body} onChange={(e) => setCertForm((c) => ({ ...c, body: e.target.value }))} placeholder="Award description and body text..." />
                </div>
                <div className="flex justify-end">
                  <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200" onClick={issueCert}>
                    Issue & Download Certificate PDF
                  </button>
                </div>
              </div>
            </div>
            
            {(data.transfers ?? []).length > 0 && (
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
                  onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/transfer-certificate?transferId=${data.transfers[0].id}`)}
                >
                  Download Transfer Certificate PDF
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "discipline" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4">
            <ul className="text-sm text-slate-350 space-y-2">
              {(data.discipline ?? []).map((d: any) => (
                <li key={d.id} className="border border-slate-800 bg-slate-950/40 rounded-xl px-4 py-3 hover:border-slate-750/60 transition-all">
                  <span className="text-rose-400 font-bold uppercase text-xs tracking-wider">{d.category}</span>
                  <p className="text-white mt-1 text-sm">{d.description}</p>
                </li>
              ))}
              {!(data.discipline ?? []).length && <li className="text-slate-500 italic text-center py-4">No disciplinary incidents reported.</li>}
            </ul>
          </div>
        )}

        {tab === "ops" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 text-sm text-slate-300">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Hostel Placement</span>
                <span className="text-white font-medium text-base">{data.hostel ? `${data.hostel.house} / Room ${data.hostel.room}` : "No Boarding hostel registered"}</span>
              </div>
              <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Transport Route</span>
                <span className="text-white font-medium text-base">{data.transport?.routeName ?? "No school transport registered"}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 space-y-4">
            <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Performance</span>
                <p className="text-white font-bold text-xl mt-1">{data.analytics?.averagePercent != null ? `${Math.round(data.analytics.averagePercent)}%` : "N/A"}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Assessments</span>
                <p className="text-slate-300 font-bold text-xl mt-1">{data.analytics?.gradeCount ?? 0}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Scorecards</span>
              <ul className="space-y-2">
                {(data.analytics?.grades ?? []).map((g: any, i: number) => (
                  <li key={i} className="flex justify-between items-center border border-slate-800 bg-slate-950/20 rounded-xl px-4 py-3">
                    <span className="text-slate-200 font-medium">{g.assessmentTitle}</span>
                    <span className="text-blue-400 font-bold font-mono">{g.score} / {g.maxScore}</span>
                  </li>
                ))}
                {!(data.analytics?.grades ?? []).length && <li className="text-slate-500 italic text-center py-2">No academic scorecards recorded.</li>}
              </ul>
            </div>
          </div>
        )}

        {tab === "id-card" && (
          <div className="bg-slate-950/20 rounded-xl border border-slate-800/80 p-4 space-y-4">
            <div className="flex justify-center py-2">
              <div className="border border-slate-700 bg-white shadow-xl rounded-2xl p-5 w-72 text-slate-900 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
                <div className="w-full">
                  <h4 className="font-extrabold text-sm uppercase tracking-wider text-indigo-900">Student Identity Card</h4>
                  <div className="w-full h-px bg-slate-200 my-2" />
                </div>
                
                {data.student?.photoUrl ? (
                  <img src={data.student.photoUrl} alt="" className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
                    <span className="text-2xl font-bold text-slate-405">
                      {data.student?.firstName?.[0] ?? ""}{data.student?.lastName?.[0] ?? ""}
                    </span>
                  </div>
                )}
                
                <div>
                  <p className="font-bold text-base text-slate-900 leading-tight">{data.student?.firstName} {data.student?.lastName}</p>
                  <p className="text-xs font-mono text-slate-500 mt-1 font-semibold">ADM. NO: {data.student?.admissionNumber}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center pt-2">
              <button type="button" className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all duration-200" onClick={() => downloadPdf(`/s/${schoolSlug}/api/student-mgmt/students/${studentId}/pdf/id-card`)}>
                Download ID Card PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { DOC_TYPES };
