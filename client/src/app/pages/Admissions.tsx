import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Plus, CheckCircle, Clock, XCircle, Search, UserPlus } from "lucide-react";

const PIPELINE_STAGES = ["inquiry", "interview", "offered", "rejected", "enrolled"] as const;

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  createdAt: string;
  convertedTo: string | null;
}

export const Admissions: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newApplicant, setNewApplicant] = useState({ firstName: "", lastName: "", email: "" });

  useEffect(() => {
    fetchApplicants();
  }, [schoolSlug]);

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admissions`);
      setApplicants(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/admissions`, newApplicant);
      setShowAdd(false);
      setNewApplicant({ firstName: "", lastName: "", email: "" });
      fetchApplicants();
    } catch (err) {
      console.error(err);
    }
  };

  const updateStage = async (id: string, stage: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/admissions/${id}/stage`, { stage });
      toast("Stage updated", "success");
      fetchApplicants();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleEnroll = async (id: string) => {
    const admissionNumber = prompt("Enter admission number for the new student:");
    if (!admissionNumber) return;

    try {
      await api.post(`/s/${schoolSlug}/api/admissions/${id}/enroll`, { admissionNumber });
      fetchApplicants();
    } catch (err: any) {
      alert("Failed to enroll: " + err.message);
    }
  };

  const getStageIcon = (stage: string, convertedTo: string | null) => {
    if (convertedTo) return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    if (stage === "rejected") return <XCircle className="w-5 h-5 text-red-400" />;
    return <Clock className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admissions Pipeline</h1>
          <p className="text-slate-400 mt-1">Manage inquiries and enroll new students</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Inquiry
        </button>
      </div>

      {showAdd && (
        <div className="card p-6 mb-6 border-blue-500/30">
          <h3 className="font-semibold text-white mb-4">Add New Applicant</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input required className="input" placeholder="First Name" value={newApplicant.firstName} onChange={e => setNewApplicant({...newApplicant, firstName: e.target.value})} />
            <input required className="input" placeholder="Last Name" value={newApplicant.lastName} onChange={e => setNewApplicant({...newApplicant, lastName: e.target.value})} />
            <input type="email" className="input" placeholder="Email (Optional)" value={newApplicant.email} onChange={e => setNewApplicant({...newApplicant, email: e.target.value})} />
            <div className="md:col-span-3 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Save Applicant</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-slate-700/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="text" placeholder="Search applicants..." className="input pl-9" />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Applied Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
              ) : applicants.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">No applicants in the pipeline.</td></tr>
              ) : applicants.map(app => (
                <tr key={app.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 font-bold">
                        {app.firstName.charAt(0)}
                      </div>
                      <span className="font-medium text-white">{app.firstName} {app.lastName}</span>
                    </div>
                  </td>
                  <td className="text-slate-400">{app.email || "-"}</td>
                  <td>
                    {!app.convertedTo ? (
                      <select
                        className="input text-sm py-1 capitalize"
                        value={app.stage}
                        onChange={(e) => updateStage(app.id, e.target.value)}
                      >
                        {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        {getStageIcon(app.stage, app.convertedTo)}
                        <span className="capitalize">{app.stage}</span>
                      </div>
                    )}
                  </td>
                  <td className="text-slate-400">{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td className="text-right">
                    {!app.convertedTo && (
                      <button onClick={() => handleEnroll(app.id)} className="btn-ghost text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20">
                        <UserPlus className="w-4 h-4" /> Enroll
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
