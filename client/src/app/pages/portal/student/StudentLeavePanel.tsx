import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useToast } from "../../../components/Toast";

type LeaveRow = {
  id: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
};

function statusPill(status: string) {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    approved: "student-portal-pill--ok",
    pending: "student-portal-pill--warn",
    rejected: "student-portal-pill--danger",
  };
  return map[s] ?? "student-portal-pill--neutral";
}

export function StudentLeavePanel({
  schoolSlug,
  studentId,
  initial,
}: {
  schoolSlug: string;
  studentId: string;
  initial: LeaveRow[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [leaves, setLeaves] = useState<LeaveRow[]>(initial);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/s/${schoolSlug}/api/portal/leaves`);
      const all = r.data ?? [];
      setLeaves(all.filter((l: LeaveRow) => l.studentId === studentId));
    } catch {
      setLeaves(initial);
    }
  }, [schoolSlug, studentId, initial]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.endDate < form.startDate) {
      toast("End date must be on or after start date", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/s/${schoolSlug}/api/portal/leaves`, { ...form, studentId });
      setForm({ startDate: "", endDate: "", reason: "" });
      toast("Leave request submitted", "success");
      await load();
    } catch (ex: any) {
      toast(ex.message ?? "Could not submit leave request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 mb-6">
        <label className="text-xs text-[var(--portal-subtle)]">
          From
          <input
            type="date"
            className="portal-input w-full mt-1 rounded-lg text-sm"
            required
            autoComplete="off"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </label>
        <label className="text-xs text-[var(--portal-subtle)]">
          To
          <input
            type="date"
            className="portal-input w-full mt-1 rounded-lg text-sm"
            required
            autoComplete="off"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </label>
        <label className="text-xs text-[var(--portal-subtle)] sm:col-span-2">
          Reason
          <input
            className="portal-input w-full mt-1 rounded-lg text-sm"
            required
            autoComplete="off"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Brief reason for absence"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 portal-btn-primary rounded-lg text-white text-sm py-2 font-medium disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
      <ul className="text-sm space-y-2">
        {leaves.map((l) => (
          <li key={l.id} className="flex justify-between gap-2 rounded-lg border border-[var(--portal-border)] px-3 py-2">
            <span>
              {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
              <span className="block text-xs text-[var(--portal-subtle)] mt-0.5 line-clamp-1">{l.reason}</span>
            </span>
            <span className={`student-portal-pill text-[10px] shrink-0 h-fit ${statusPill(l.status)}`}>{l.status}</span>
          </li>
        ))}
        {!leaves.length && <p className="portal-empty">No leave requests yet.</p>}
      </ul>
    </>
  );
}
