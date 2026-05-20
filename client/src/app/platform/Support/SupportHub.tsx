import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LifeBuoy,
  Search,
  RefreshCw,
  Loader2,
  Plus,
  X,
  Building2,
  Eye,
  MessageSquare,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { usePlatformAuth } from "../hooks/usePlatformAuth";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type TicketRow = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type TicketMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  authorName: string | null;
  createdAt: string;
};

type SupportHubData = {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    urgent: number;
    unassigned: number;
  };
  schools: { id: string; slug: string; name: string }[];
  assignees: { id: string; name: string; email: string; role: string }[];
  tickets: TicketRow[];
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 ring-blue-600/20",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-600/20",
  waiting: "bg-amber-50 text-amber-700 ring-amber-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  closed: "bg-slate-100 text-slate-600 ring-slate-400/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-slate-100 text-slate-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-50 text-rose-700",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export const SupportHub: React.FC = () => {
  const { toast } = useToast();
  const { admin: me } = usePlatformAuth();
  const [hub, setHub] = useState<SupportHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [assignFilter, setAssignFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ ticket: TicketRow; messages: TicketMessage[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formSubject, setFormSubject] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTenantId, setFormTenantId] = useState("");
  const [formPriority, setFormPriority] = useState("normal");
  const [formCategory, setFormCategory] = useState("general");
  const [formRequesterName, setFormRequesterName] = useState("");
  const [formRequesterEmail, setFormRequesterEmail] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (schoolFilter !== "all") params.set("tenantId", schoolFilter);
      if (assignFilter !== "all") params.set("assigned", assignFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await api.get(`/api/platform/support?${params}`);
      setHub(res.data as SupportHubData);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, statusFilter, priorityFilter, schoolFilter, assignFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setReply("");
    try {
      const res = await api.get(`/api/platform/support/${id}`);
      setDetail(res.data);
    } catch (e: any) {
      toast(e.message, "error");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject.trim() || !formDescription.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/platform/support", {
        tenantId: formTenantId || null,
        subject: formSubject.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        category: formCategory,
        requesterName: formRequesterName.trim() || undefined,
        requesterEmail: formRequesterEmail.trim() || undefined,
      });
      toast("Ticket created", "success");
      setCreateOpen(false);
      setFormSubject("");
      setFormDescription("");
      setFormTenantId("");
      load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const patchTicket = async (patch: Record<string, unknown>) => {
    if (!detailId) return;
    setSaving(true);
    try {
      const res = await api.patch(`/api/platform/support/${detailId}`, patch);
      setDetail(res.data);
      load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!detailId || !reply.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/platform/support/${detailId}/messages`, {
        message: reply.trim(),
        isInternal: internalNote,
      });
      setDetail(res.data);
      setReply("");
      load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const impersonate = async (slug: string) => {
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/impersonate`);
      const url = res.data?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast("No impersonation URL returned", "error");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const filtered = useMemo(() => hub?.tickets ?? [], [hub]);

  const summary = hub?.summary;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LifeBuoy size={20} className="text-blue-600" />
              Support tickets
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Cross-tenant help desk for schools — track issues, assign operators, and open read-only shadow sessions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              New ticket
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Open", value: summary?.open ?? 0 },
          { label: "In progress", value: summary?.inProgress ?? 0 },
          { label: "Waiting", value: summary?.waiting ?? 0 },
          { label: "Resolved", value: summary?.resolved ?? 0 },
          { label: "Urgent", value: summary?.urgent ?? 0, accent: "text-rose-600" },
          { label: "Unassigned", value: summary?.unassigned ?? 0 },
          { label: "Total loaded", value: summary?.total ?? 0 },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${s.accent ?? "text-slate-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} p-3 flex flex-col sm:flex-row flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search subject, description, requester…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(true)}
          />
        </div>
        <select className="input text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="waiting">Waiting</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select className="input text-sm w-auto" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select className="input text-sm w-auto max-w-[200px]" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="all">All schools</option>
          {(hub?.schools ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="input text-sm w-auto max-w-[180px]" value={assignFilter} onChange={(e) => setAssignFilter(e.target.value)}>
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {me && <option value={me.id}>Assigned to me</option>}
          {(hub?.assignees ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => load(true)} className="inline-flex rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
          Apply
        </button>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50/80 cursor-pointer"
                  onClick={() => openDetail(t.id)}
                >
                  <td className="px-4 py-3 max-w-[260px]">
                    <p className="font-medium text-slate-900 truncate">{t.subject}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{t.category}</p>
                    {t.messageCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 mt-0.5">
                        <MessageSquare size={10} /> {t.messageCount}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.tenantSlug ? (
                      <span className="inline-flex items-center gap-1 text-slate-700 truncate">
                        <Building2 size={12} className="text-slate-400 shrink-0" />
                        {t.tenantName}
                      </span>
                    ) : (
                      <span className="text-slate-400">Platform</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_STYLES[t.priority] ?? ""}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{t.assignedAdminName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(t.updatedAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No tickets yet. Create one to track a school issue or internal platform task.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={() => setCreateOpen(false)} />
          <form onSubmit={createTicket} className="relative w-full max-w-lg bg-white rounded-xl shadow-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900">New support ticket</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-md">
                <X size={18} />
              </button>
            </div>
            <input className="input w-full text-sm" placeholder="Subject" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} required />
            <textarea className="input w-full text-sm min-h-[100px]" placeholder="Description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} required />
            <select className="input w-full text-sm" value={formTenantId} onChange={(e) => setFormTenantId(e.target.value)}>
              <option value="">No school (platform-internal)</option>
              {(hub?.schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select className="input text-sm" value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select className="input text-sm" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="onboarding">Onboarding</option>
                <option value="access">Access</option>
              </select>
            </div>
            <input className="input w-full text-sm" placeholder="Requester name (optional)" value={formRequesterName} onChange={(e) => setFormRequesterName(e.target.value)} />
            <input className="input w-full text-sm" type="email" placeholder="Requester email (optional)" value={formRequesterEmail} onChange={(e) => setFormRequesterEmail(e.target.value)} />
            <button type="submit" disabled={saving} className="w-full btn-primary text-sm py-2">
              {saving ? "Creating…" : "Create ticket"}
            </button>
          </form>
        </div>
      )}

      {detailId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={() => { setDetailId(null); setDetail(null); }} />
          <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900 truncate pr-2">{detail?.ticket.subject ?? "Ticket"}</h3>
              <button type="button" onClick={() => { setDetailId(null); setDetail(null); }} className="p-1 rounded-md text-slate-500 hover:bg-slate-100 shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailLoading || !detail ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={detail.ticket.status} />
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_STYLES[detail.ticket.priority]}`}>
                      {detail.ticket.priority}
                    </span>
                    <span className="text-[11px] text-slate-500 capitalize">{detail.ticket.category}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.ticket.description}</p>
                  {detail.ticket.tenantSlug && (
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/platform/tenants/${detail.ticket.tenantSlug}`} className="text-xs text-blue-600 hover:underline">
                        Open school →
                      </Link>
                      <button
                        type="button"
                        onClick={() => impersonate(detail.ticket.tenantSlug!)}
                        className="inline-flex items-center gap-1 text-xs border border-blue-200 text-blue-600 px-2 py-1 rounded-md hover:bg-blue-50"
                      >
                        <Eye size={12} /> Shadow login (read-only)
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <select
                      className="input text-sm"
                      value={detail.ticket.status}
                      disabled={saving}
                      onChange={(e) => patchTicket({ status: e.target.value })}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="waiting">Waiting</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <select
                      className="input text-sm"
                      value={detail.ticket.assignedAdminId ?? ""}
                      disabled={saving}
                      onChange={(e) => patchTicket({ assignedAdminId: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {(hub?.assignees ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Conversation</p>
                    {detail.messages.length === 0 ? (
                      <p className="text-xs text-slate-500">No replies yet.</p>
                    ) : (
                      detail.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-lg px-3 py-2 text-xs ${m.isInternal ? "bg-amber-50 border border-amber-100" : "bg-slate-50 border border-slate-100"}`}
                        >
                          <p className="font-medium text-slate-700">
                            {m.authorName ?? "Operator"}
                            {m.isInternal && <span className="text-amber-600 ml-1">(internal)</span>}
                          </p>
                          <p className="text-slate-600 mt-1 whitespace-pre-wrap">{m.body}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{formatDate(m.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <textarea
                      className="input w-full text-sm min-h-[72px]"
                      placeholder="Reply to ticket…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                      Internal note (not visible to school)
                    </label>
                    <button
                      type="button"
                      disabled={saving || !reply.trim()}
                      onClick={sendReply}
                      className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Sending…" : "Send reply"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
