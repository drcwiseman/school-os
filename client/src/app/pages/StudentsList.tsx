import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import { Search, Plus, Filter, Loader2 } from "lucide-react";

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: string;
}

export const StudentsList: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    admissionNumber: "",
    firstName: "",
    lastName: "",
    middleName: "",
    gender: "",
    dob: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [schoolSlug]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/students?limit=50`);
      setStudents(res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/s/${schoolSlug}/api/students`, {
        admissionNumber: addForm.admissionNumber,
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        middleName: addForm.middleName || undefined,
        gender: addForm.gender || undefined,
        dob: addForm.dob || undefined,
      });
      toast("Student added", "success");
      setAddForm({ admissionNumber: "", firstName: "", lastName: "", middleName: "", gender: "", dob: "" });
      setShowAdd(false);
      fetchStudents();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (id: string, name: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/students/${id}`);
      toast(`${name} removed`, "success");
      fetchStudents();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="badge-green">Active</span>;
      case "inactive": return <span className="badge-gray">Inactive</span>;
      case "graduated": return <span className="badge-blue">Graduated</span>;
      default: return <span className="badge-gray">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
        {hasPermission("students.create") && (
          <button type="button" className="btn-primary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="w-4 h-4" /> {showAdd ? "Cancel" : "Add Student"}
          </button>
        )}
      </div>

      {showAdd && hasPermission("students.create") && (
        <form onSubmit={createStudent} className="card p-6 grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Admission number</label>
            <input className="input" required value={addForm.admissionNumber} onChange={(e) => setAddForm({ ...addForm, admissionNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">First name</label>
            <input className="input" required value={addForm.firstName} onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" required value={addForm.lastName} onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">Middle name</label>
            <input className="input" value={addForm.middleName} onChange={(e) => setAddForm({ ...addForm, middleName: e.target.value })} />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={addForm.gender} onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" value={addForm.dob} onChange={(e) => setAddForm({ ...addForm, dob: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save student"}
            </button>
          </div>
        </form>
      )}

      <div className="card p-4">
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by name or admission number..." 
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-ghost">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="table-wrap rounded-xl overflow-hidden border border-slate-700/50">
          <table className="table">
            <thead>
              <tr>
                <th>Adm. No</th>
                <th>Name</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.filter(s => 
                  `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(search.toLowerCase())
                ).map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.admissionNumber}</td>
                    <td className="font-medium text-white">{s.firstName} {s.lastName}</td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td className="text-right space-x-2">
                      <Link to={`/s/${schoolSlug}/students/${s.id}`} className="btn-ghost text-xs inline-flex">
                        View
                      </Link>
                      {hasPermission("students.delete") && (
                        <ConfirmAction
                          label="Remove"
                          confirmMessage={`Remove student ${s.firstName} ${s.lastName}?`}
                          onConfirm={() => removeStudent(s.id, `${s.firstName} ${s.lastName}`)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
