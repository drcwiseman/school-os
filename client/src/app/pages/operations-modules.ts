import { FACILITIES_OPS_IDS } from "../../lib/facilities-nav";

/** Operations sub-modules — each has its own permission; do not merge under one "operations" role. */
export const OPERATIONS_MODULES = [
  {
    id: "discipline",
    label: "Discipline",
    path: "discipline/incidents",
    perm: "discipline.view",
    columns: [{ key: "category", label: "Category" }, { key: "severity", label: "Severity" }, { key: "description", label: "Description" }],
    fields: [
      { name: "studentId", label: "Student UUID", required: true },
      { name: "category", label: "Category", required: true },
      { name: "description", label: "Description", required: true },
      { name: "severity", label: "Severity" },
    ],
  },
  {
    id: "health",
    label: "Health",
    path: "health/visits",
    perm: "health.view",
    columns: [{ key: "complaint", label: "Complaint" }, { key: "visitDate", label: "Visit", render: (r: Record<string, unknown>) => new Date(r.visitDate as string).toLocaleDateString() }],
    fields: [
      { name: "studentId", label: "Student UUID", required: true },
      { name: "complaint", label: "Complaint", required: true },
      { name: "treatment", label: "Treatment" },
    ],
  },
  {
    id: "library",
    label: "Library",
    path: "library/books",
    perm: "library.view",
    columns: [{ key: "title", label: "Title" }, { key: "author", label: "Author" }],
    fields: [{ name: "title", label: "Title", required: true }, { name: "author", label: "Author" }, { name: "isbn", label: "ISBN" }],
  },
  {
    id: "inventory",
    label: "Inventory",
    path: "inventory/items",
    perm: "inventory.view",
    columns: [{ key: "sku", label: "SKU" }, { key: "name", label: "Name" }, { key: "quantity", label: "Qty" }],
    fields: [
      { name: "sku", label: "SKU", required: true },
      { name: "name", label: "Name", required: true },
      { name: "quantity", label: "Quantity", type: "number" as const },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    path: "transport/routes",
    perm: "transport.view",
    columns: [{ key: "name", label: "Route" }],
    fields: [{ name: "name", label: "Route name", required: true }],
  },
  {
    id: "boarding",
    label: "Boarding",
    path: "boarding/houses",
    perm: "boarding.view",
    columns: [{ key: "name", label: "House" }],
    fields: [{ name: "name", label: "House name", required: true }],
  },
] as const;

export type OperationsModuleId = (typeof OPERATIONS_MODULES)[number]["id"];

/** Shown under /ops/* in sidebar (library, transport, boarding live under Facilities). */
export const OPS_SIDEBAR_MODULES = OPERATIONS_MODULES.filter(
  (m) => !(FACILITIES_OPS_IDS as readonly string[]).includes(m.id),
);
