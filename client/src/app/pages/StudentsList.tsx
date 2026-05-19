import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

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
                    <td className="text-right">
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
