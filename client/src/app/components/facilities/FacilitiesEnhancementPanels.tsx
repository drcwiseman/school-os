import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Loader2, ChevronRight } from "lucide-react";

type StudentOpt = { id: string; firstName: string; lastName: string; admissionNumber?: string };
type StaffOpt = { id: string; firstName: string; lastName: string; employeeNo: string };
type FacilitiesTab =
  | "overview" | "library" | "cards" | "transport" | "hostel" | "activities" | "rooms"
  | "gate-passes" | "tickets" | "staff-hostel";

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  tab: FacilitiesTab;
  onNavigate: (tab: FacilitiesTab) => void;
  enabled: boolean;
}> = ({ label, value, valueClass = "text-white", tab, onNavigate, enabled }) => (
  <button
    type="button"
    disabled={!enabled}
    onClick={() => enabled && onNavigate(tab)}
    className={`card p-4 text-left w-full transition group ${
      enabled
        ? "hover:border-teal-500/40 hover:bg-slate-800/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/50"
        : "opacity-50 cursor-not-allowed"
    }`}
  >
    <p className="text-slate-500 text-sm">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    {enabled && (
      <p className="text-xs text-teal-400/90 mt-2 flex items-center gap-0.5 group-hover:text-teal-300">
        Manage <ChevronRight className="w-3 h-3" />
      </p>
    )}
  </button>
);

const QUICK_LINKS: { tab: FacilitiesTab; label: string }[] = [
  { tab: "library", label: "Library" },
  { tab: "cards", label: "Library cards" },
  { tab: "transport", label: "Transport" },
  { tab: "hostel", label: "Hostel" },
  { tab: "activities", label: "Activities" },
  { tab: "rooms", label: "Rooms" },
  { tab: "gate-passes", label: "Gate passes" },
  { tab: "tickets", label: "Tickets" },
  { tab: "staff-hostel", label: "Staff hostel" },
];

export const FacilitiesOverviewPanel: React.FC<{
  schoolSlug: string;
  onNavigate: (tab: FacilitiesTab) => void;
  availableTabs: string[];
}> = ({ schoolSlug, onNavigate, availableTabs }) => {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const can = (tab: FacilitiesTab) => availableTabs.includes(tab);

  useEffect(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/facilities/overview`)
      .then((r) => setData(r.data ?? {}))
      .catch((err: Error) => {
        toast(err.message || "Could not load overview", "error");
        setData({ upcomingActivities: 0, campusRooms: 0 });
      })
      .finally(() => setLoading(false));
  }, [schoolSlug, toast]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {(data.library != null || can("library")) && (
          <>
            <StatCard
              label="Library titles"
              value={data.library?.books ?? 0}
              tab="library"
              onNavigate={onNavigate}
              enabled={can("library")}
            />
            <StatCard
              label="Active loans"
              value={data.library?.activeLoans ?? 0}
              valueClass="text-amber-400"
              tab="library"
              onNavigate={onNavigate}
              enabled={can("library")}
            />
          </>
        )}
        {(data.transport != null || can("transport")) && (
          <StatCard
            label="Transport routes"
            value={data.transport?.routes ?? 0}
            tab="transport"
            onNavigate={onNavigate}
            enabled={can("transport")}
          />
        )}
        {(data.hostel != null || can("hostel")) && (
          <StatCard
            label="Hostel occupancy"
            value={`${data.hostel?.occupied ?? 0}/${data.hostel?.capacity ?? 0}`}
            valueClass="text-emerald-400"
            tab="hostel"
            onNavigate={onNavigate}
            enabled={can("hostel")}
          />
        )}
        <StatCard
          label="Upcoming activities"
          value={data.upcomingActivities ?? 0}
          valueClass="text-violet-400"
          tab="activities"
          onNavigate={onNavigate}
          enabled={can("activities")}
        />
        <StatCard
          label="Campus rooms"
          value={data.campusRooms ?? 0}
          tab="rooms"
          onNavigate={onNavigate}
          enabled={can("rooms")}
        />
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-white mb-3">Quick actions</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.filter((q) => can(q.tab)).map((q) => (
            <button
              key={q.tab}
              type="button"
              className="btn-secondary text-sm"
              onClick={() => onNavigate(q.tab)}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-3">Click a metric card or button to open that module and add or edit records.</p>
      </div>
    </div>
  );
};

/** @deprecated Use LibraryCrudPanel from ./LibraryCrudPanel */
export const LibraryManagementPanel: React.FC<{
  schoolSlug: string;
  students: StudentOpt[];
  staff: StaffOpt[];
}> = ({ schoolSlug, students, staff }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [bookCopies, setBookCopies] = useState<any[]>([]);
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "" });
  const [barcode, setBarcode] = useState("");
  const [loanForm, setLoanForm] = useState({ copyId: "", memberType: "student" as "student" | "staff", memberId: "", dueAt: "" });
  const [loading, setLoading] = useState(true);
  const [activityMember, setActivityMember] = useState({ type: "student" as "student" | "staff", id: "" });
  const [activity, setActivity] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, b, l, c] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/library/dashboard`),
        api.get(`/s/${schoolSlug}/api/library/books`),
        api.get(`/s/${schoolSlug}/api/library/loans/enriched`),
        api.get(`/s/${schoolSlug}/api/library/lookup/copies`),
      ]);
      setDash(d.data);
      setBooks(b.data ?? []);
      setLoans(l.data ?? []);
      setCopies(c.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!selectedBook) { setBookCopies([]); return; }
    api.get(`/s/${schoolSlug}/api/library/books/${selectedBook}/copies`).then((r) => setBookCopies(r.data ?? []));
  }, [selectedBook, schoolSlug]);

  const loadActivity = async () => {
    if (!activityMember.id) return;
    const q = activityMember.type === "student" ? `studentId=${activityMember.id}` : `staffId=${activityMember.id}`;
    const res = await api.get(`/s/${schoolSlug}/api/library/member-activity?${q}`);
    setActivity(res.data ?? []);
  };

  const addBook = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/library/books`, bookForm);
    toast("Book added", "success");
    setBookForm({ title: "", author: "", isbn: "" });
    load();
  };

  const addCopy = async () => {
    if (!selectedBook || !barcode) return;
    await api.post(`/s/${schoolSlug}/api/library/books/${selectedBook}/copies`, { barcode });
    setBarcode("");
    toast("Copy added", "success");
    const r = await api.get(`/s/${schoolSlug}/api/library/books/${selectedBook}/copies`);
    setBookCopies(r.data ?? []);
    load();
  };

  const issueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { copyId: loanForm.copyId };
    if (loanForm.dueAt) body.dueAt = loanForm.dueAt;
    if (loanForm.memberType === "student") body.studentId = loanForm.memberId;
    else body.staffId = loanForm.memberId;
    await api.post(`/s/${schoolSlug}/api/library/loans/issue`, body);
    toast("Loan issued", "success");
    load();
  };

  const returnLoan = async (id: string) => {
    await api.post(`/s/${schoolSlug}/api/library/loans/${id}/return`, {});
    toast("Returned", "success");
    load();
  };

  const editBook = async (book: { id: string; title: string; author?: string }) => {
    const title = window.prompt("Book title", book.title);
    if (title == null || !title.trim()) return;
    const author = window.prompt("Author", book.author ?? "") ?? book.author;
    await api.patch(`/s/${schoolSlug}/api/library/books/${book.id}`, { title: title.trim(), author: author || undefined });
    toast("Book updated", "success");
    load();
  };

  const deleteBook = async (id: string, title: string) => {
    if (!window.confirm(`Delete “${title}” and all its copies?`)) return;
    try {
      await api.delete(`/s/${schoolSlug}/api/library/books/${id}`);
      toast("Book removed", "success");
      if (selectedBook === id) setSelectedBook("");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="card p-3"><span className="text-slate-500">Books</span><p className="text-xl font-bold text-white">{dash.books}</p></div>
          <div className="card p-3"><span className="text-slate-500">Copies avail.</span><p className="text-xl font-bold text-emerald-400">{dash.copies?.available ?? 0}</p></div>
          <div className="card p-3"><span className="text-slate-500">Active loans</span><p className="text-xl font-bold text-white">{dash.loans?.active ?? 0}</p></div>
          <div className="card p-3"><span className="text-slate-500">Overdue</span><p className="text-xl font-bold text-amber-400">{dash.loans?.overdue ?? 0}</p></div>
          <div className="card p-3"><span className="text-slate-500">Cards active</span><p className="text-xl font-bold text-white">{dash.cards?.active ?? 0}</p></div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Title</th><th>Author</th><th>ISBN</th>{hasPermission("library.manage") && <th></th>}</tr></thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td className="text-slate-400">{b.author ?? "—"}</td>
                <td className="text-slate-400">{b.isbn ?? "—"}</td>
                {hasPermission("library.manage") && (
                  <td className="space-x-2 whitespace-nowrap">
                    <button type="button" className="btn-ghost text-xs" onClick={() => editBook(b)}>Edit</button>
                    <button type="button" className="btn-ghost text-xs text-rose-400" onClick={() => deleteBook(b.id, b.title)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {hasPermission("library.manage") && (
          <form onSubmit={addBook} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Add book</h3>
            <input className="input" placeholder="Title" required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
            <input className="input" placeholder="Author" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
            <input className="input" placeholder="ISBN" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} />
            <button type="submit" className="btn-primary">Save book</button>
          </form>
        )}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-white">Copies</h3>
          <select className="input" value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
            <option value="">Select book…</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          {hasPermission("library.manage") && (
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              <button type="button" className="btn-secondary" onClick={addCopy}>Add copy</button>
            </div>
          )}
          <ul className="text-sm text-slate-300 max-h-32 overflow-y-auto">{bookCopies.map((c) => <li key={c.id}>{c.barcode} — {c.status}</li>)}</ul>
        </div>
      </div>
      {hasPermission("library.manage") && (
        <form onSubmit={issueLoan} className="card p-5 grid md:grid-cols-4 gap-3 items-end">
          <h3 className="font-semibold text-white md:col-span-4">Issue loan</h3>
          <select className="input" required value={loanForm.copyId} onChange={(e) => setLoanForm({ ...loanForm, copyId: e.target.value })}>
            <option value="">Available copy…</option>
            {copies.map((row: any) => (
              <option key={row.copy.id} value={row.copy.id}>{row.book.title} — {row.copy.barcode}</option>
            ))}
          </select>
          <select className="input" value={loanForm.memberType} onChange={(e) => setLoanForm({ ...loanForm, memberType: e.target.value as "student" | "staff", memberId: "" })}>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>
          <select className="input" required value={loanForm.memberId} onChange={(e) => setLoanForm({ ...loanForm, memberId: e.target.value })}>
            <option value="">Member…</option>
            {(loanForm.memberType === "student" ? students : staff).map((m) => (
              <option key={m.id} value={m.id}>
                {"admissionNumber" in m && m.admissionNumber ? `${m.admissionNumber} — ` : ""}{m.firstName} {m.lastName}
              </option>
            ))}
          </select>
          <input className="input" type="date" value={loanForm.dueAt} onChange={(e) => setLoanForm({ ...loanForm, dueAt: e.target.value })} />
          <button type="submit" className="btn-primary">Issue</button>
        </form>
      )}
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Book</th><th>Member</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loans.map((row: any) => {
              const member = row.student
                ? `${row.student.admissionNumber ?? ""} ${row.student.firstName} ${row.student.lastName}`.trim()
                : row.staffMember
                  ? `${row.staffMember.employeeNo} ${row.staffMember.firstName} ${row.staffMember.lastName}`
                  : "—";
              return (
                <tr key={row.loan.id}>
                  <td>{row.book.title}</td>
                  <td>{member}{row.card?.cardNumber ? ` · ${row.card.cardNumber}` : ""}</td>
                  <td className="text-slate-400">{row.loan.dueAt ? new Date(row.loan.dueAt).toLocaleDateString() : "—"}</td>
                  <td>{row.loan.returnedAt ? "Returned" : "Active"}</td>
                  <td>
                    {!row.loan.returnedAt && hasPermission("library.manage") && (
                      <button type="button" className="btn-ghost text-xs" onClick={() => returnLoan(row.loan.id)}>Return</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-white">Member activity</h3>
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-[140px]" value={activityMember.type} onChange={(e) => setActivityMember({ type: e.target.value as "student" | "staff", id: "" })}>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>
          <select className="input flex-1 min-w-[200px]" value={activityMember.id} onChange={(e) => setActivityMember({ ...activityMember, id: e.target.value })}>
            <option value="">Select…</option>
            {(activityMember.type === "student" ? students : staff).map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={loadActivity}>Load history</button>
        </div>
        <ul className="text-sm text-slate-300 space-y-1">
          {activity.map((a: any, i: number) => (
            <li key={i}>{a.book.title} · {a.copy.barcode} · {new Date(a.loan.loanedAt).toLocaleDateString()}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const LibraryCardsPanel: React.FC<{
  schoolSlug: string;
  students: StudentOpt[];
  staff: StaffOpt[];
}> = ({ schoolSlug, students, staff }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [form, setForm] = useState({ memberType: "student" as "student" | "staff", memberId: "", cardNumber: "", notes: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/library/cards`)
      .then((r) => setCards(r.data ?? []))
      .catch((err: any) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { memberType: form.memberType, notes: form.notes };
    if (form.cardNumber) body.cardNumber = form.cardNumber;
    if (form.memberType === "student") body.studentId = form.memberId;
    else body.staffId = form.memberId;
    await api.post(`/s/${schoolSlug}/api/library/cards`, body);
    toast("Card issued", "success");
    setForm({ memberType: "student", memberId: "", cardNumber: "", notes: "" });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await api.patch(`/s/${schoolSlug}/api/library/cards/${id}`, { status });
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />;

  return (
    <div className="space-y-6">
      {hasPermission("library.manage") && (
        <form onSubmit={create} className="card p-5 grid md:grid-cols-4 gap-3 items-end">
          <select className="input" value={form.memberType} onChange={(e) => setForm({ ...form, memberType: e.target.value as "student" | "staff", memberId: "" })}>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>
          <select className="input" required value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
            <option value="">Member…</option>
            {(form.memberType === "student" ? students : staff).map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
          <input className="input" placeholder="Card # (auto if blank)" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
          <button type="submit" className="btn-primary">Issue card</button>
        </form>
      )}
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Card</th><th>Member</th><th>Status</th><th>Issued</th><th></th></tr></thead>
          <tbody>
            {cards.map((row: any) => {
              const name = row.student
                ? `${row.student.firstName} ${row.student.lastName}`
                : row.staffMember
                  ? `${row.staffMember.firstName} ${row.staffMember.lastName}`
                  : "—";
              return (
                <tr key={row.card.id}>
                  <td className="font-mono">{row.card.cardNumber}</td>
                  <td>{name} <span className="text-slate-500 text-xs">({row.card.memberType})</span></td>
                  <td>{row.card.status}</td>
                  <td className="text-slate-400">{new Date(row.card.issuedAt).toLocaleDateString()}</td>
                  <td>
                    {hasPermission("library.manage") && (
                      <span className="space-x-2">
                        {row.card.status === "active" && (
                          <button type="button" className="btn-ghost text-xs" onClick={() => setStatus(row.card.id, "suspended")}>Suspend</button>
                        )}
                        {row.card.status !== "active" && (
                          <button type="button" className="btn-ghost text-xs" onClick={() => setStatus(row.card.id, "active")}>Activate</button>
                        )}
                        {row.card.status !== "lost" && (
                          <button type="button" className="btn-ghost text-xs text-rose-400" onClick={() => setStatus(row.card.id, "lost")}>Mark lost</button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TransportManagementPanel: React.FC<{ schoolSlug: string; students: StudentOpt[] }> = ({ schoolSlug, students }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [fleet, setFleet] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [routeForm, setRouteForm] = useState({ name: "", stops: "" });
  const [vehicleForm, setVehicleForm] = useState({ registration: "", capacity: "", routeId: "" });
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", licenseNo: "" });
  const [assignForm, setAssignForm] = useState({ routeId: "", studentId: "", stopId: "" });
  const [stops, setStops] = useState<any[]>([]);
  const [gps, setGps] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [subTab, setSubTab] = useState<"fleet" | "gps" | "fuel">("fleet");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, f, r, a] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/transport/dashboard`),
        api.get(`/s/${schoolSlug}/api/transport/fleet-overview`),
        api.get(`/s/${schoolSlug}/api/transport/routes`),
        api.get(`/s/${schoolSlug}/api/transport/assignments/enriched`),
      ]);
      setDash(d.data);
      setFleet(f.data ?? []);
      setRoutes(r.data ?? []);
      setAssignments(a.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!assignForm.routeId || !schoolSlug) { setStops([]); return; }
    api.get(`/s/${schoolSlug}/api/transport/routes/${assignForm.routeId}/stops`).then((r) => setStops(r.data ?? [])).catch(() => setStops([]));
  }, [assignForm.routeId, schoolSlug]);

  useEffect(() => {
    if (subTab === "gps" && schoolSlug) {
      api.get(`/s/${schoolSlug}/api/transport/gps/live`).then((r) => setGps(r.data ?? [])).catch(() => {});
    }
    if (subTab === "fuel" && schoolSlug) {
      api.get(`/s/${schoolSlug}/api/transport/fuel`).then((r) => setFuel(r.data ?? [])).catch(() => {});
    }
  }, [subTab, schoolSlug]);

  const addRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    const stops = routeForm.stops.split("\n").filter(Boolean).map((name, i) => ({ name: name.trim(), orderNo: i }));
    await api.post(`/s/${schoolSlug}/api/transport/routes-with-stops`, { name: routeForm.name, stops });
    toast("Route created", "success");
    setRouteForm({ name: "", stops: "" });
    load();
  };

  const addVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/transport/vehicles`, {
      registration: vehicleForm.registration,
      capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
      routeId: vehicleForm.routeId || undefined,
    });
    toast("Vehicle added", "success");
    load();
  };

  const addDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/transport/drivers`, driverForm);
    toast("Driver added", "success");
    load();
  };

  const assignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { routeId: assignForm.routeId, studentId: assignForm.studentId };
    if (assignForm.stopId) body.stopId = assignForm.stopId;
    await api.post(`/s/${schoolSlug}/api/transport/assignments`, body);
    toast("Student assigned to route", "success");
    load();
  };

  const linkDriver = async (driverId: string, vehicleId: string) => {
    await api.patch(`/s/${schoolSlug}/api/transport/drivers/${driverId}/vehicle`, { vehicleId: vehicleId || null });
    toast("Driver assignment updated", "success");
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3"><p className="text-slate-500 text-sm">Routes</p><p className="text-xl font-bold text-white">{dash.routes}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Vehicles</p><p className="text-xl font-bold text-white">{dash.vehicles}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Drivers</p><p className="text-xl font-bold text-emerald-400">{dash.drivers?.active ?? 0}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Students on routes</p><p className="text-xl font-bold text-white">{dash.studentAssignments}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Unassigned vehicles</p><p className="text-xl font-bold text-amber-400">{dash.vehiclesWithoutRoute}</p></div>
        </div>
      )}
      {hasPermission("transport.manage") && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form onSubmit={addRoute} className="card p-4 space-y-2">
            <h3 className="font-semibold text-white text-sm">New route</h3>
            <input className="input" placeholder="Route name" required value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} />
            <textarea className="input min-h-[80px]" placeholder="Stops (one per line)" value={routeForm.stops} onChange={(e) => setRouteForm({ ...routeForm, stops: e.target.value })} />
            <button type="submit" className="btn-primary w-full">Create route</button>
          </form>
          <form onSubmit={addVehicle} className="card p-4 space-y-2">
            <h3 className="font-semibold text-white text-sm">Vehicle</h3>
            <input className="input" placeholder="Registration" required value={vehicleForm.registration} onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value })} />
            <input className="input" type="number" placeholder="Capacity" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} />
            <select className="input" value={vehicleForm.routeId} onChange={(e) => setVehicleForm({ ...vehicleForm, routeId: e.target.value })}>
              <option value="">Route (optional)</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button type="submit" className="btn-primary w-full">Add vehicle</button>
          </form>
          <form onSubmit={addDriver} className="card p-4 space-y-2">
            <h3 className="font-semibold text-white text-sm">Driver</h3>
            <input className="input" placeholder="Name" required value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} />
            <input className="input" placeholder="Phone" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} />
            <input className="input" placeholder="License" value={driverForm.licenseNo} onChange={(e) => setDriverForm({ ...driverForm, licenseNo: e.target.value })} />
            <button type="submit" className="btn-primary w-full">Add driver</button>
          </form>
        </div>
      )}
      <div className="card p-5">
        <h3 className="font-semibold text-white mb-3">Fleet</h3>
        <div className="space-y-2 text-sm">
          {fleet.map((row: any) => (
            <div key={row.vehicle.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-2 text-slate-300">
              <span>{row.vehicle.registration} · Route: {row.route?.name ?? "—"} · Driver: {row.driver?.name ?? "—"}</span>
              {hasPermission("transport.manage") && row.driver && (
                <select className="input max-w-[180px] text-xs" defaultValue={row.driver.vehicleId ?? ""} onChange={(e) => linkDriver(row.driver.id, e.target.value)}>
                  <option value="">Unassign vehicle</option>
                  {fleet.map((f: any) => <option key={f.vehicle.id} value={f.vehicle.id}>{f.vehicle.registration}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
      {hasPermission("transport.manage") && (
        <form onSubmit={assignStudent} className="card p-5 flex flex-wrap gap-3 items-end">
          <select className="input" required value={assignForm.routeId} onChange={(e) => setAssignForm({ ...assignForm, routeId: e.target.value, stopId: "" })}>
            <option value="">Route…</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="input" value={assignForm.stopId} onChange={(e) => setAssignForm({ ...assignForm, stopId: e.target.value })}>
            <option value="">Stop (optional)…</option>
            {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" required value={assignForm.studentId} onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}>
            <option value="">Student…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNumber} {s.firstName} {s.lastName}</option>)}
          </select>
          <button type="submit" className="btn-primary">Assign to route</button>
        </form>
      )}
      <div className="flex gap-2">
        {(["fleet", "gps", "fuel"] as const).map((t) => (
          <button key={t} type="button" className={`tab-pill ${subTab === t ? "active" : ""}`} onClick={() => setSubTab(t)}>{t}</button>
        ))}
      </div>
      {subTab === "gps" && (
        <div className="card p-5 text-sm text-slate-300 space-y-2">
          {gps.length === 0 ? <p>No live GPS pings.</p> : gps.map((g: any) => (
            <p key={g.vehicle.id}>{g.vehicle.registration}: {g.ping.lat}, {g.ping.lng}</p>
          ))}
        </div>
      )}
      {subTab === "fuel" && (
        <div className="card p-5 text-sm text-slate-300 space-y-2">
          {fuel.map((f) => <p key={f.id}>{f.liters}L · vehicle {String(f.vehicleId).slice(0, 8)}</p>)}
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Student</th><th>Route</th><th>Stop</th><th></th></tr></thead>
          <tbody>
            {assignments.map((row: any) => (
              <tr key={row.assignment.id}>
                <td>{row.student.admissionNumber} {row.student.firstName} {row.student.lastName}</td>
                <td>{row.route.name}</td>
                <td className="text-slate-400">{row.stop?.name ?? "—"}</td>
                <td>
                  {hasPermission("transport.manage") && (
                    <button
                      type="button"
                      className="btn-ghost text-xs text-rose-400"
                      onClick={async () => {
                        if (!window.confirm("Remove this student from the route?")) return;
                        await api.delete(`/s/${schoolSlug}/api/transport/assignments/${row.assignment.id}`);
                        toast("Assignment removed", "success");
                        load();
                      }}
                    >
                      Remove
                    </button>
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

export const HostelManagementPanel: React.FC<{ schoolSlug: string; students: StudentOpt[] }> = ({ schoolSlug, students }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [grid, setGrid] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [setupForm, setSetupForm] = useState({ houseName: "", roomNames: "" });
  const [allocForm, setAllocForm] = useState({ roomId: "", studentId: "" });
  const [visitors, setVisitors] = useState<any[]>([]);
  const [visitorForm, setVisitorForm] = useState({ visitorName: "", studentId: "", purpose: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g, a, h, r, v] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/boarding/dashboard`),
        api.get(`/s/${schoolSlug}/api/boarding/rooms/grid`),
        api.get(`/s/${schoolSlug}/api/boarding/allocations/enriched`),
        api.get(`/s/${schoolSlug}/api/boarding/houses`),
        api.get(`/s/${schoolSlug}/api/boarding/rooms`),
        api.get(`/s/${schoolSlug}/api/boarding/visitors`),
      ]);
      setDash(d.data);
      setGrid(g.data ?? []);
      setAllocations(a.data ?? []);
      setHouses(h.data ?? []);
      setRooms(r.data ?? []);
      setVisitors(v.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const addVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/boarding/visitors`, visitorForm);
    toast("Visitor checked in", "success");
    setVisitorForm({ visitorName: "", studentId: "", purpose: "" });
    load();
  };

  const checkoutVisitor = async (id: string) => {
    await api.post(`/s/${schoolSlug}/api/boarding/visitors/${id}/checkout`, {});
    toast("Visitor checked out", "success");
    load();
  };

  const setupHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomList = setupForm.roomNames.split("\n").filter(Boolean).map((name) => ({ name: name.trim() }));
    await api.post(`/s/${schoolSlug}/api/boarding/setup-house`, { houseName: setupForm.houseName, rooms: roomList });
    toast("House and rooms created", "success");
    load();
  };

  const allocate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/boarding/allocations`, allocForm);
    toast("Student allocated", "success");
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3"><p className="text-slate-500 text-sm">Houses</p><p className="text-xl font-bold text-white">{dash.houses}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Rooms</p><p className="text-xl font-bold text-white">{dash.rooms}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Capacity</p><p className="text-xl font-bold text-white">{dash.capacity}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Occupied</p><p className="text-xl font-bold text-emerald-400">{dash.occupied}</p></div>
          <div className="card p-3"><p className="text-slate-500 text-sm">Occupancy</p><p className="text-xl font-bold text-violet-400">{dash.pct}%</p></div>
        </div>
      )}
      {hasPermission("boarding.manage") && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={setupHouse} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Setup house & rooms</h3>
            <input className="input" placeholder="House name" required value={setupForm.houseName} onChange={(e) => setSetupForm({ ...setupForm, houseName: e.target.value })} />
            <textarea className="input min-h-[100px]" placeholder="Room names (one per line)" required value={setupForm.roomNames} onChange={(e) => setSetupForm({ ...setupForm, roomNames: e.target.value })} />
            <button type="submit" className="btn-primary">Create</button>
          </form>
          <form onSubmit={allocate} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Allocate student</h3>
            <select className="input" required value={allocForm.roomId} onChange={(e) => setAllocForm({ ...allocForm, roomId: e.target.value })}>
              <option value="">Room…</option>
              {rooms.map((rm) => {
                const house = houses.find((h) => h.id === rm.houseId);
                return <option key={rm.id} value={rm.id}>{house?.name} — {rm.name}</option>;
              })}
            </select>
            <select className="input" required value={allocForm.studentId} onChange={(e) => setAllocForm({ ...allocForm, studentId: e.target.value })}>
              <option value="">Student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
            <button type="submit" className="btn-primary">Allocate</button>
          </form>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>House</th><th>Room</th><th>Cap.</th><th>Occupied</th><th>Vacancy</th></tr></thead>
          <tbody>
            {grid.map((row: any) => (
              <tr key={row.room.id}>
                <td>{row.house.name}</td>
                <td>{row.room.name}</td>
                <td>{row.room.capacity}</td>
                <td>{row.occupied}</td>
                <td className={row.vacancy === 0 ? "text-amber-400" : "text-emerald-400"}>{row.vacancy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Student</th><th>House / Room</th><th>From</th><th></th></tr></thead>
          <tbody>
            {allocations.map((row: any) => (
              <tr key={row.allocation.id}>
                <td>{row.student.firstName} {row.student.lastName}</td>
                <td>{row.house.name} / {row.room.name}</td>
                <td className="text-slate-400">{new Date(row.allocation.fromDate).toLocaleDateString()}</td>
                <td>
                  {hasPermission("boarding.manage") && (
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={async () => {
                        await api.post(`/s/${schoolSlug}/api/boarding/allocations/${row.allocation.id}/checkout`, {});
                        toast("Student checked out of room", "success");
                        load();
                      }}
                    >
                      Check out
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-white">Hostel visitors</h3>
        {hasPermission("boarding.manage") && (
          <form onSubmit={addVisitor} className="flex flex-wrap gap-3 items-end">
            <input className="input" placeholder="Visitor name" required value={visitorForm.visitorName} onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })} />
            <select className="input" value={visitorForm.studentId} onChange={(e) => setVisitorForm({ ...visitorForm, studentId: e.target.value })}>
              <option value="">Student (optional)</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
            <input className="input" placeholder="Purpose" value={visitorForm.purpose} onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })} />
            <button type="submit" className="btn-secondary">Check in</button>
          </form>
        )}
        <ul className="text-sm text-slate-300 space-y-2">
          {visitors.map((v) => (
            <li key={v.id} className="flex justify-between border-b border-slate-800 py-2">
              <span>{v.visitorName} · {v.checkOut ? "Out" : "In"} · {v.purpose ?? "—"}</span>
              {hasPermission("boarding.manage") && !v.checkOut && (
                <button type="button" className="btn-ghost text-xs" onClick={() => checkoutVisitor(v.id)}>Check out</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ACTIVITY_TYPES = [
  { value: "co_curricular", label: "Co-curricular" },
  { value: "extracurricular", label: "Extracurricular" },
  { value: "club", label: "Club" },
  { value: "sports", label: "Sports" },
  { value: "cultural", label: "Cultural" },
];

export const ActivitiesManagementPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", eventType: "co_curricular", venue: "", startsAt: "", endsAt: "", audience: "students",
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/facilities/activities`)
      .then((r) => setItems(r.data ?? []))
      .catch((err: any) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/facilities/activities`, form);
    toast("Activity scheduled", "success");
    setForm({ title: "", description: "", eventType: "co_curricular", venue: "", startsAt: "", endsAt: "", audience: "students" });
    load();
  };

  const togglePublish = async (id: string, published: boolean) => {
    await api.patch(`/s/${schoolSlug}/api/facilities/activities/${id}`, { published: !published });
    load();
  };

  const editActivity = async (ev: any) => {
    const title = window.prompt("Title", ev.title);
    if (title == null || !title.trim()) return;
    const venue = window.prompt("Venue", ev.venue ?? "") ?? ev.venue;
    await api.patch(`/s/${schoolSlug}/api/facilities/activities/${ev.id}`, { title: title.trim(), venue: venue || undefined });
    toast("Activity updated", "success");
    load();
  };

  const removeActivity = async (id: string, title: string) => {
    if (!window.confirm(`Delete activity “${title}”?`)) return;
    await api.delete(`/s/${schoolSlug}/api/facilities/activities/${id}`);
    toast("Activity deleted", "success");
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-6">
      {hasPermission("messaging.manage") && (
        <form onSubmit={create} className="card p-5 grid md:grid-cols-3 gap-3">
          <input className="input md:col-span-2" placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="input" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
            {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className="input" placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          <input className="input" type="datetime-local" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          <button type="submit" className="btn-primary">Schedule</button>
        </form>
      )}
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Activity</th><th>Type</th><th>When</th><th>Venue</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.title}</td>
                <td className="text-slate-400">{ev.eventType}</td>
                <td>{new Date(ev.startsAt).toLocaleString()}</td>
                <td>{ev.venue ?? "—"}</td>
                <td>
                  {hasPermission("messaging.manage") && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => togglePublish(ev.id, ev.published)}>
                      {ev.published ? "Published" : "Draft"}
                    </button>
                  )}
                </td>
                <td className="space-x-2 whitespace-nowrap">
                  {hasPermission("messaging.manage") && (
                    <>
                      <button type="button" className="btn-ghost text-xs" onClick={() => editActivity(ev)}>Edit</button>
                      <button type="button" className="btn-ghost text-xs text-rose-400" onClick={() => removeActivity(ev.id, ev.title)}>Delete</button>
                    </>
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

export const RoomsManagementPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [roomForm, setRoomForm] = useState({ name: "", roomType: "general", building: "", capacity: "", status: "available" });
  const [bookForm, setBookForm] = useState({ roomId: "", title: "", startsAt: "", endsAt: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, b] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/facilities/rooms`),
        api.get(`/s/${schoolSlug}/api/facilities/rooms/bookings`),
      ]);
      setData(r.data);
      setBookings(b.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/facilities/rooms`, {
      ...roomForm,
      capacity: roomForm.capacity ? Number(roomForm.capacity) : undefined,
    });
    toast("Room added", "success");
    load();
  };

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/facilities/rooms/bookings`, bookForm);
    toast("Booking created", "success");
    load();
  };

  const updateRoomStatus = async (id: string, status: string) => {
    await api.patch(`/s/${schoolSlug}/api/facilities/rooms/${id}`, { status });
    toast("Room updated", "success");
    load();
  };

  const deleteRoom = async (id: string, name: string) => {
    if (!window.confirm(`Delete campus room “${name}”?`)) return;
    await api.delete(`/s/${schoolSlug}/api/facilities/rooms/${id}`);
    toast("Room deleted", "success");
    load();
  };

  const cancelBooking = async (id: string) => {
    if (!window.confirm("Cancel this booking?")) return;
    await api.delete(`/s/${schoolSlug}/api/facilities/rooms/bookings/${id}`);
    toast("Booking cancelled", "success");
    load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  const campus = data?.campus ?? [];
  const academic = data?.academic ?? [];
  const hostel = data?.hostel ?? [];

  return (
    <div className="space-y-6">
      {hasPermission("library.manage") && (
        <form onSubmit={addRoom} className="card p-5 grid md:grid-cols-4 gap-3 items-end">
          <input className="input" placeholder="Room name" required value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} />
          <input className="input" placeholder="Building" value={roomForm.building} onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })} />
          <input className="input" type="number" placeholder="Capacity" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
          <button type="submit" className="btn-primary">Add campus room</button>
        </form>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-white mb-2">Campus rooms</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            {campus.map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-slate-800/50 last:border-0">
                <span>{r.name} · cap {r.capacity ?? "—"}</span>
                {hasPermission("library.manage") ? (
                  <span className="flex items-center gap-2">
                    <select
                      className="input text-xs py-1 max-w-[120px]"
                      value={r.status}
                      onChange={(e) => updateRoomStatus(r.id, e.target.value)}
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                    <button type="button" className="btn-ghost text-xs text-rose-400" onClick={() => deleteRoom(r.id, r.name)}>Delete</button>
                  </span>
                ) : (
                  <span className="text-slate-500">{r.status}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white mb-2">Classrooms (academics)</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            {academic.map((r: any) => <li key={r.id}>{r.name} · cap {r.capacity ?? "—"}</li>)}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white mb-2">Hostel rooms</h3>
          <ul className="text-sm text-slate-300 space-y-1 max-h-48 overflow-y-auto">
            {hostel.map((r: any) => <li key={r.id}>{r.name} · {r.occupied}/{r.capacity}</li>)}
          </ul>
        </div>
      </div>
      {hasPermission("library.manage") && campus.length > 0 && (
        <form onSubmit={book} className="card p-5 flex flex-wrap gap-3 items-end">
          <select className="input" required value={bookForm.roomId} onChange={(e) => setBookForm({ ...bookForm, roomId: e.target.value })}>
            <option value="">Room…</option>
            {campus.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" placeholder="Booking title" required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
          <input className="input" type="datetime-local" required value={bookForm.startsAt} onChange={(e) => setBookForm({ ...bookForm, startsAt: e.target.value })} />
          <button type="submit" className="btn-primary">Book room</button>
        </form>
      )}
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead><tr><th>Room</th><th>Event</th><th>Start</th><th></th></tr></thead>
          <tbody>
            {bookings.map((row: any) => (
              <tr key={row.booking.id}>
                <td>{row.room.name}</td>
                <td>{row.booking.title}</td>
                <td>{new Date(row.booking.startsAt).toLocaleString()}</td>
                <td>
                  {hasPermission("library.manage") && (
                    <button type="button" className="btn-ghost text-xs text-rose-400" onClick={() => cancelBooking(row.booking.id)}>Cancel</button>
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
