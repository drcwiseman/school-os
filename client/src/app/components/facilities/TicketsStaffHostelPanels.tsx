import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Loader2 } from "lucide-react";

type StaffOpt = { id: string; firstName: string; lastName: string; employeeNo: string };

export const TicketsManagementPanel: React.FC<{ schoolSlug: string; staff: StaffOpt[] }> = ({ schoolSlug, staff }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", category: "maintenance", priority: "normal", assignedToStaffId: "",
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, list] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/tickets/dashboard`),
        api.get(`/s/${schoolSlug}/api/tickets`),
      ]);
      setDash(d.data);
      setRows(list.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/tickets`, {
      ...form,
      assignedToStaffId: form.assignedToStaffId || undefined,
    });
    toast("Ticket created", "success");
    setForm({ title: "", description: "", category: "maintenance", priority: "normal", assignedToStaffId: "" });
    load();
  };

  const resolve = async (id: string) => {
    const notes = prompt("Resolution notes (optional)") ?? "";
    await api.patch(`/s/${schoolSlug}/api/tickets/${id}`, { status: "resolved", resolutionNotes: notes });
    toast("Ticket resolved", "success");
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-slate-500 text-sm">Open</p><p className="text-2xl font-bold text-amber-400">{dash.open ?? 0}</p></div>
          <div className="card p-4"><p className="text-slate-500 text-sm">Resolved</p><p className="text-2xl font-bold text-emerald-400">{dash.resolved ?? 0}</p></div>
          <div className="card p-4"><p className="text-slate-500 text-sm">High priority</p><p className="text-2xl font-bold text-red-400">{dash.high ?? 0}</p></div>
        </div>
      )}
      {hasPermission("ticket.manage") && (
        <form onSubmit={create} className="card p-5 grid md:grid-cols-3 gap-3">
          <input className="input md:col-span-2" placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="maintenance">Maintenance</option>
            <option value="it">IT</option>
            <option value="facilities">Facilities</option>
            <option value="transport">Transport</option>
            <option value="other">Other</option>
          </select>
          <textarea className="input md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select className="input" value={form.assignedToStaffId} onChange={(e) => setForm({ ...form, assignedToStaffId: e.target.value })}>
            <option value="">Assign to…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.employeeNo} {s.firstName}</option>)}
          </select>
          <button type="submit" className="btn-primary">Create ticket</button>
        </form>
      )}
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>#</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Assignee</th><th></th></tr></thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.ticket.id}>
                <td className="font-mono text-xs">{row.ticket.ticketNumber}</td>
                <td>{row.ticket.title}</td>
                <td>{row.ticket.category}</td>
                <td>{row.ticket.priority}</td>
                <td>{row.ticket.status}</td>
                <td>{row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : "—"}</td>
                <td>
                  {hasPermission("ticket.manage") && row.ticket.status !== "resolved" && row.ticket.status !== "closed" && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => resolve(row.ticket.id)}>Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const StaffHostelManagementPanel: React.FC<{ schoolSlug: string; staff: StaffOpt[] }> = ({ schoolSlug, staff }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [grid, setGrid] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [setupForm, setSetupForm] = useState({ blockName: "", roomNames: "" });
  const [allocForm, setAllocForm] = useState({ roomId: "", staffId: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g, a] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/staff-hostel/dashboard`),
        api.get(`/s/${schoolSlug}/api/staff-hostel/rooms`),
        api.get(`/s/${schoolSlug}/api/staff-hostel/allocations`),
      ]);
      setDash(d.data);
      setGrid(g.data ?? []);
      setAllocations(a.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const setup = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomList = setupForm.roomNames.split("\n").filter(Boolean).map((name) => ({ name: name.trim() }));
    await api.post(`/s/${schoolSlug}/api/staff-hostel/setup-block`, { blockName: setupForm.blockName, rooms: roomList });
    toast("Staff hostel block created", "success");
    load();
  };

  const allocate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/staff-hostel/allocations`, allocForm);
    toast("Staff allocated", "success");
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-4 gap-3">
          <div className="card p-3"><p className="text-slate-500 text-sm">Rooms</p><p className="text-xl font-bold text-white">{dash.rooms}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Capacity</p><p className="text-xl font-bold text-white">{dash.capacity}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Occupied</p><p className="text-xl font-bold text-emerald-400">{dash.occupied}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Occupancy</p><p className="text-xl font-bold text-violet-400">{dash.pct}%</p></div>
        </div>
      )}
      {hasPermission("staff_hostel.manage") && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={setup} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Setup block</h3>
            <input className="input" placeholder="Block name" required value={setupForm.blockName} onChange={(e) => setSetupForm({ ...setupForm, blockName: e.target.value })} />
            <textarea className="input min-h-[80px]" placeholder="Rooms (one per line)" required value={setupForm.roomNames} onChange={(e) => setSetupForm({ ...setupForm, roomNames: e.target.value })} />
            <button type="submit" className="btn-primary">Create</button>
          </form>
          <form onSubmit={allocate} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Allocate staff</h3>
            <select className="input" required value={allocForm.roomId} onChange={(e) => setAllocForm({ ...allocForm, roomId: e.target.value })}>
              <option value="">Room…</option>
              {grid.map((row: any) => (
                <option key={row.room.id} value={row.room.id}>{row.block.name} — {row.room.name}</option>
              ))}
            </select>
            <select className="input" required value={allocForm.staffId} onChange={(e) => setAllocForm({ ...allocForm, staffId: e.target.value })}>
              <option value="">Staff…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.employeeNo} {s.firstName} {s.lastName}</option>)}
            </select>
            <button type="submit" className="btn-primary">Allocate</button>
          </form>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Block</th><th>Room</th><th>Cap.</th><th>Occupied</th></tr></thead>
          <tbody>
            {grid.map((row: any) => (
              <tr key={row.room.id}>
                <td>{row.block.name}</td>
                <td>{row.room.name}</td>
                <td>{row.room.capacity}</td>
                <td>{row.occupied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Staff</th><th>Room</th><th>From</th><th></th></tr></thead>
          <tbody>
            {allocations.map((row: any) => (
              <tr key={row.allocation.id}>
                <td>{row.staffMember.employeeNo} {row.staffMember.firstName} {row.staffMember.lastName}</td>
                <td>{row.block.name} / {row.room.name}</td>
                <td>{new Date(row.allocation.fromDate).toLocaleDateString()}</td>
                <td>
                  {hasPermission("staff_hostel.manage") && (
                    <button type="button" className="btn-ghost text-xs" onClick={async () => {
                      await api.post(`/s/${schoolSlug}/api/staff-hostel/allocations/${row.allocation.id}/vacate`, {});
                      load();
                    }}>Vacate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
