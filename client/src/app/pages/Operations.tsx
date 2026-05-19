import React, { useState } from "react";
import { ModuleCrud } from "../components/ModuleCrud";

const MODULES = [
  { id: "discipline", label: "Discipline", path: "discipline/incidents", perm: "discipline.view",
    columns: [{ key: "category", label: "Category" }, { key: "severity", label: "Severity" }, { key: "description", label: "Description" }],
    fields: [{ name: "studentId", label: "Student UUID", required: true }, { name: "category", label: "Category", required: true }, { name: "description", label: "Description", required: true }, { name: "severity", label: "Severity" }],
  },
  { id: "health", label: "Health", path: "health/visits", perm: "health.view",
    columns: [{ key: "complaint", label: "Complaint" }, { key: "visitDate", label: "Visit", render: (r: any) => new Date(r.visitDate).toLocaleDateString() }],
    fields: [{ name: "studentId", label: "Student UUID", required: true }, { name: "complaint", label: "Complaint", required: true }, { name: "treatment", label: "Treatment" }],
  },
  { id: "library", label: "Library", path: "library/books", perm: "library.view",
    columns: [{ key: "title", label: "Title" }, { key: "author", label: "Author" }],
    fields: [{ name: "title", label: "Title", required: true }, { name: "author", label: "Author" }, { name: "isbn", label: "ISBN" }],
  },
  { id: "inventory", label: "Inventory", path: "inventory/items", perm: "inventory.view",
    columns: [{ key: "sku", label: "SKU" }, { key: "name", label: "Name" }, { key: "quantity", label: "Qty" }],
    fields: [{ name: "sku", label: "SKU", required: true }, { name: "name", label: "Name", required: true }, { name: "quantity", label: "Quantity", type: "number" as const }],
  },
  { id: "transport", label: "Transport", path: "transport/routes", perm: "transport.view",
    columns: [{ key: "name", label: "Route" }],
    fields: [{ name: "name", label: "Route name", required: true }],
  },
  { id: "boarding", label: "Boarding", path: "boarding/houses", perm: "boarding.view",
    columns: [{ key: "name", label: "House" }],
    fields: [{ name: "name", label: "House name", required: true }],
  },
] as const;

export const Operations: React.FC = () => {
  const [mod, setMod] = useState<(typeof MODULES)[number]["id"]>("discipline");
  const current = MODULES.find((m) => m.id === mod)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations</h1>
          <p className="text-slate-400 mt-1">Discipline, health, library, inventory, transport, boarding</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {MODULES.map((m) => (
          <button key={m.id} type="button" onClick={() => setMod(m.id)} className={`px-3 py-2 rounded-lg text-sm ${mod === m.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            {m.label}
          </button>
        ))}
      </div>

      <ModuleCrud title={current.label} apiPath={current.path} columns={[...current.columns]} fields={[...current.fields]} />
    </div>
  );
};
