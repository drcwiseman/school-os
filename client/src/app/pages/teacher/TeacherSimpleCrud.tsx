import React, { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { ConfirmAction } from "../../components/ConfirmAction";

export type SimpleField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "textarea";
  required?: boolean;
  placeholder?: string;
};

export type SimpleColumn<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T extends { id: string }> = {
  title: string;
  items: T[];
  columns: SimpleColumn<T>[];
  fields: SimpleField[];
  loading?: boolean;
  emptyMessage?: string;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  extraForm?: React.ReactNode;
};

export function TeacherSimpleCrud<T extends { id: string }>({
  title,
  items,
  columns,
  fields,
  loading,
  emptyMessage,
  onCreate,
  onUpdate,
  onDelete,
  extraForm,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setEditId(null);
    setForm({});
    setOpen(true);
  };

  const startEdit = (row: T) => {
    setEditId(row.id);
    const next: Record<string, string> = {};
    for (const f of fields) {
      const v = (row as Record<string, unknown>)[f.name];
      if (v == null || v === "") {
        next[f.name] = "";
      } else if (f.type === "datetime-local") {
        const d = new Date(String(v));
        next[f.name] = Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 16);
      } else {
        next[f.name] = String(v);
      }
    }
    setForm(next);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        const v = form[f.name];
        if (v === undefined || v === "") continue;
        body[f.name] = f.type === "number" ? Number(v) : v;
      }
      if (editId) await onUpdate(editId, body);
      else await onCreate(body);
      setOpen(false);
      setEditId(null);
      setForm({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{title}</h3>
        <button type="button" className="btn-primary text-sm" onClick={startCreate}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="card p-4 grid gap-3 sm:grid-cols-2">
          {extraForm}
          {fields.map((f) => (
            <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="label">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  className="input min-h-[80px]"
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  type={f.type ?? "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">{emptyMessage ?? "Nothing here yet."}</p>
        ) : (
          <table className="table text-sm">
            <thead>
              <tr>
                {columns.map((c) => <th key={String(c.key)}>{c.label}</th>)}
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={String(c.key)}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? "—")}
                    </td>
                  ))}
                  <td className="space-x-1 whitespace-nowrap">
                    <button type="button" className="btn-ghost text-xs px-2" onClick={() => startEdit(row)}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <ConfirmAction
                      label="Delete"
                      confirmMessage="Delete this item?"
                      onConfirm={() => onDelete(row.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
