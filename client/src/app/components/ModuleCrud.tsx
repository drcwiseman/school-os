import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "./Toast";
import { Loader2, Plus } from "lucide-react";
import { ConfirmAction } from "./ConfirmAction";
import { useAuth } from "../state/AuthContext";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date";
  required?: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

interface ModuleCrudProps {
  title: string;
  apiPath: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  emptyMessage?: string;
  allowDelete?: boolean;
  deletePermission?: string;
}

export const ModuleCrud: React.FC<ModuleCrudProps> = ({ title, apiPath, columns, fields, emptyMessage, allowDelete, deletePermission }) => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/${apiPath}`);
      setRows(res.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug, apiPath]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    fields.forEach((f) => {
      const v = form[f.name];
      if (v === undefined || v === "") return;
      body[f.name] = f.type === "number" ? Number(v) : v;
    });
    try {
      await api.post(`/s/${schoolSlug}/api/${apiPath}`, body);
      toast("Saved", "success");
      setShowForm(false);
      setForm({});
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const canDelete = allowDelete && (!deletePermission || hasPermission(deletePermission));

  const removeRow = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/${apiPath}/${id}`);
      toast("Removed", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <CrudHeader title={title} showForm={showForm} onToggle={() => setShowForm(!showForm)} />

      {showForm && (
        <form onSubmit={submit} className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                required={f.required}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            </div>
          ))}
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{canDelete && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length + (canDelete ? 1 : 0)} className="text-center py-8 text-slate-400">{emptyMessage ?? "No records."}</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>
                  ))}
                  {canDelete && (
                    <td>
                      <ConfirmAction
                        label="Remove"
                        confirmMessage="Remove this record?"
                        onConfirm={() => removeRow(row.id)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

function CrudHeader({ title, showForm, onToggle }: { title: string; showForm: boolean; onToggle: () => void }) {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <button type="button" className="btn-primary" onClick={onToggle}>
        <Plus className="w-4 h-4" /> {showForm ? "Close" : "Add"}
      </button>
    </div>
  );
}
