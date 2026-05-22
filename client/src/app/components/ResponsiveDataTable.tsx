import React from "react";
import { Loader2 } from "lucide-react";

export type TableColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
  mobileLabel?: string;
};

export function ResponsiveDataTable<T extends { id?: string }>({
  loading,
  rows,
  columns,
  actions,
  emptyMessage = "No records",
  minWidth = 640,
}: {
  loading?: boolean;
  rows: T[];
  columns: TableColumn<T>[];
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  minWidth?: number;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const cell = (row: T, col: TableColumn<T>) => {
    if (col.render) return col.render(row);
    return String((row as Record<string, unknown>)[col.key] ?? "—");
  };

  return (
    <>
      <div className="hidden md:block card overflow-hidden w-full min-w-0">
        <div className="table-wrap">
          <table className="table w-full" style={{ minWidth }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                {actions && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-10 text-app-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.id ?? i}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.hideOnMobile ? "hidden lg:table-cell" : ""}>
                        {cell(row, c)}
                      </td>
                    ))}
                    {actions && <td className="text-right whitespace-nowrap">{actions(row)}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="card p-6 text-center text-app-muted text-sm">{emptyMessage}</div>
        ) : (
          rows.map((row, i) => (
            <div key={row.id ?? i} className="card p-4 space-y-2 min-w-0">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex justify-between gap-3 text-sm">
                    <span className="app-mobile-label shrink-0">{c.mobileLabel ?? c.label}</span>
                    <span className="app-mobile-value text-right break-words">{cell(row, c)}</span>
                  </div>
                ))}
              {actions && (
                <div className="pt-2 border-t app-mobile-divider flex flex-wrap gap-2">{actions(row)}</div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
