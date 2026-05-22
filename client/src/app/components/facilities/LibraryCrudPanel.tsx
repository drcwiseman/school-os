import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { ConfirmAction } from "../ConfirmAction";
import { Loader2, Plus, Pencil, BookOpen, ClipboardList, Send } from "lucide-react";

type StudentOpt = { id: string; firstName: string; lastName: string; admissionNumber?: string };
type StaffOpt = { id: string; firstName: string; lastName: string; employeeNo: string };
type BookRow = {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  totalCopies?: number;
  availableCopies?: number;
};
type CopyRow = { id: string; barcode: string; status: string; bookId?: string };
type LibSection = "books" | "loans" | "issue";

const EMPTY_BOOK = { title: "", author: "", isbn: "" };

export const LibraryCrudPanel: React.FC<{
  schoolSlug: string;
  students: StudentOpt[];
  staff: StaffOpt[];
}> = ({ schoolSlug, students, staff }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("library.manage");
  const [section, setSection] = useState<LibSection>("books");
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showBookForm, setShowBookForm] = useState(false);
  const [editBookId, setEditBookId] = useState<string | null>(null);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [bookCopies, setBookCopies] = useState<CopyRow[]>([]);
  const [copiesLoading, setCopiesLoading] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [editCopyId, setEditCopyId] = useState<string | null>(null);
  const [editCopyBarcode, setEditCopyBarcode] = useState("");
  const [loanForm, setLoanForm] = useState({
    copyId: "",
    memberType: "student" as "student" | "staff",
    memberId: "",
    dueAt: "",
  });

  const loadBooks = useCallback(async (): Promise<BookRow[]> => {
    try {
      const r = await api.get(`/s/${schoolSlug}/api/library/books/enriched`);
      return r.data ?? [];
    } catch {
      const r = await api.get(`/s/${schoolSlug}/api/library/books`);
      return (r.data ?? []).map((b: BookRow) => ({
        ...b,
        totalCopies: 0,
        availableCopies: 0,
      }));
    }
  }, [schoolSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, b, l, c] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/library/dashboard`).catch(() => ({ data: null })),
        loadBooks(),
        api.get(`/s/${schoolSlug}/api/library/loans/enriched`).catch(async () => {
          const plain = await api.get(`/s/${schoolSlug}/api/library/loans`).catch(() => ({ data: [] }));
          return { data: (plain.data ?? []).map((loan: { id: string; copyId: string; studentId?: string; dueAt?: string; returnedAt?: string }) => ({
            loan,
            copy: { barcode: loan.copyId.slice(0, 8) },
            book: { title: "—" },
          })) };
        }),
        api.get(`/s/${schoolSlug}/api/library/lookup/copies`).catch(() => ({ data: [] })),
      ]);
      setDash(d.data);
      setBooks(b);
      setLoans(l.data ?? []);
      setCopies(c.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast, loadBooks]);

  const loadBookCopies = useCallback(async (bookId: string) => {
    setCopiesLoading(true);
    try {
      const r = await api.get(`/s/${schoolSlug}/api/library/books/${bookId}/copies`);
      setBookCopies(r.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
      setBookCopies([]);
    } finally {
      setCopiesLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (expandedBookId) loadBookCopies(expandedBookId);
    else setBookCopies([]);
  }, [expandedBookId, loadBookCopies]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      b.title.toLowerCase().includes(q)
      || (b.author ?? "").toLowerCase().includes(q)
      || (b.isbn ?? "").toLowerCase().includes(q),
    );
  }, [books, search]);

  const openCreateBook = () => {
    setEditBookId(null);
    setBookForm(EMPTY_BOOK);
    setShowBookForm(true);
  };

  const openEditBook = (b: BookRow) => {
    setEditBookId(b.id);
    setBookForm({ title: b.title, author: b.author ?? "", isbn: b.isbn ?? "" });
    setShowBookForm(true);
  };

  const saveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      title: bookForm.title.trim(),
      author: bookForm.author.trim() || undefined,
      isbn: bookForm.isbn.trim() || undefined,
    };
    try {
      if (editBookId) {
        await api.patch(`/s/${schoolSlug}/api/library/books/${editBookId}`, body);
        toast("Book updated", "success");
      } else {
        await api.post(`/s/${schoolSlug}/api/library/books`, body);
        toast("Book added", "success");
      }
      setShowBookForm(false);
      setEditBookId(null);
      setBookForm(EMPTY_BOOK);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const deleteBook = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/library/books/${id}`);
      toast("Book removed", "success");
      if (expandedBookId === id) setExpandedBookId(null);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const addCopy = async (bookId: string) => {
    if (!newBarcode.trim()) return;
    try {
      await api.post(`/s/${schoolSlug}/api/library/books/${bookId}/copies`, { barcode: newBarcode.trim() });
      setNewBarcode("");
      toast("Copy added", "success");
      loadBookCopies(bookId);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const saveCopyBarcode = async (copyId: string, bookId: string) => {
    if (!editCopyBarcode.trim()) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/library/copies/${copyId}`, { barcode: editCopyBarcode.trim() });
      setEditCopyId(null);
      toast("Barcode updated", "success");
      loadBookCopies(bookId);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const deleteCopy = async (copyId: string, bookId: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/library/copies/${copyId}`);
      toast("Copy removed", "success");
      loadBookCopies(bookId);
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const issueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { copyId: loanForm.copyId };
    if (loanForm.dueAt) body.dueAt = loanForm.dueAt;
    if (loanForm.memberType === "student") body.studentId = loanForm.memberId;
    else body.staffId = loanForm.memberId;
    try {
      await api.post(`/s/${schoolSlug}/api/library/loans/issue`, body);
      toast("Loan issued", "success");
      setLoanForm({ copyId: "", memberType: "student", memberId: "", dueAt: "" });
      load();
      setSection("loans");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const returnLoan = async (id: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/library/loans/${id}/return`, {});
      toast("Returned", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const tabCls = (active: boolean) =>
    `shrink-0 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 whitespace-nowrap ${
      active ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
    }`;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="card p-3"><span className="text-slate-500">Titles</span><p className="text-xl font-bold text-white">{dash.books}</p></div>
          <div className="card p-3"><span className="text-slate-500">Copies avail.</span><p className="text-xl font-bold text-emerald-400">{dash.copies?.available ?? 0}</p></div>
          <div className="card p-3"><span className="text-slate-500">Active loans</span><p className="text-xl font-bold text-white">{dash.loans?.active ?? 0}</p></div>
          <div className="card p-3"><span className="text-slate-500">Overdue</span><p className="text-xl font-bold text-amber-400">{dash.loans?.overdue ?? 0}</p></div>
          <div className="card p-3"><span className="text-slate-500">Library cards</span><p className="text-xl font-bold text-white">{dash.cards?.active ?? 0}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabCls(section === "books")} onClick={() => setSection("books")}>
          <BookOpen className="w-4 h-4" /> Books & copies
        </button>
        <button type="button" className={tabCls(section === "loans")} onClick={() => setSection("loans")}>
          <ClipboardList className="w-4 h-4" /> Loans ({loans.filter((r) => !r.loan?.returnedAt).length} active)
        </button>
        {canManage && (
          <button type="button" className={tabCls(section === "issue")} onClick={() => setSection("issue")}>
            <Send className="w-4 h-4" /> Issue loan
          </button>
        )}
      </div>

      {section === "books" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <input
              className="input max-w-md flex-1 min-w-[200px]"
              placeholder="Search title, author, ISBN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canManage && (
              <button type="button" className="btn-primary" onClick={() => (showBookForm ? setShowBookForm(false) : openCreateBook())}>
                <Plus className="w-4 h-4" /> {showBookForm && !editBookId ? "Close" : "Add book"}
              </button>
            )}
          </div>

          {showBookForm && canManage && (
            <form onSubmit={saveBook} className="card p-5 grid md:grid-cols-3 gap-4">
              <h3 className="font-semibold text-white md:col-span-3">{editBookId ? "Edit book" : "New book"}</h3>
              <div>
                <label className="label">Title *</label>
                <input className="input" required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Author</label>
                <input className="input" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
              </div>
              <div>
                <label className="label">ISBN</label>
                <input className="input" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => { setShowBookForm(false); setEditBookId(null); }}>Cancel</button>
                <button type="submit" className="btn-primary">{editBookId ? "Update" : "Save book"}</button>
              </div>
            </form>
          )}

          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>ISBN</th>
                  <th>Copies</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="text-center py-10 text-slate-400">
                      {books.length === 0 ? "No books yet. Add your first title." : "No books match your search."}
                    </td>
                  </tr>
                ) : filteredBooks.map((b) => (
                  <React.Fragment key={b.id}>
                    <tr className={expandedBookId === b.id ? "bg-slate-800/50" : undefined}>
                      <td className="font-medium text-white">{b.title}</td>
                      <td className="text-slate-400">{b.author ?? "—"}</td>
                      <td className="text-slate-400">{b.isbn ?? "—"}</td>
                      <td>
                        <span className="text-emerald-400">{b.availableCopies ?? 0}</span>
                        <span className="text-slate-500"> / {b.totalCopies ?? 0}</span>
                      </td>
                      {canManage && (
                        <td className="space-x-1 whitespace-nowrap">
                          <button type="button" className="btn-ghost text-xs" onClick={() => setExpandedBookId(expandedBookId === b.id ? null : b.id)}>
                            {expandedBookId === b.id ? "Hide copies" : "Copies"}
                          </button>
                          <button type="button" className="btn-ghost text-xs inline-flex items-center gap-0.5" onClick={() => openEditBook(b)}>
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <ConfirmAction
                            label="Delete"
                            confirmMessage={`Delete “${b.title}” and all copies? Active loans must be returned first.`}
                            onConfirm={() => deleteBook(b.id)}
                          />
                        </td>
                      )}
                    </tr>
                    {expandedBookId === b.id && (
                      <tr>
                        <td colSpan={canManage ? 5 : 4} className="bg-slate-900/80 p-4">
                          {copiesLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-400">Physical copies for <strong className="text-white">{b.title}</strong></p>
                              {bookCopies.length === 0 ? (
                                <p className="text-sm text-slate-500">No copies — add a barcode below.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {bookCopies.map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                                      {editCopyId === c.id ? (
                                        <>
                                          <input
                                            className="input max-w-[200px] py-1"
                                            value={editCopyBarcode}
                                            onChange={(e) => setEditCopyBarcode(e.target.value)}
                                          />
                                          <button type="button" className="btn-primary text-xs" onClick={() => saveCopyBarcode(c.id, b.id)}>Save</button>
                                          <button type="button" className="btn-ghost text-xs" onClick={() => setEditCopyId(null)}>Cancel</button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-mono text-teal-300">{c.barcode}</span>
                                          <span className={`px-2 py-0.5 rounded text-xs ${
                                            c.status === "available" ? "bg-emerald-900/40 text-emerald-300" : "bg-amber-900/40 text-amber-300"
                                          }`}>{c.status}</span>
                                          {canManage && c.status === "available" && (
                                            <>
                                              <button
                                                type="button"
                                                className="btn-ghost text-xs"
                                                onClick={() => { setEditCopyId(c.id); setEditCopyBarcode(c.barcode); }}
                                              >
                                                Edit barcode
                                              </button>
                                              <ConfirmAction
                                                label="Remove"
                                                confirmMessage={`Remove copy ${c.barcode}?`}
                                                onConfirm={() => deleteCopy(c.id, b.id)}
                                              />
                                            </>
                                          )}
                                          {c.status === "loaned" && <span className="text-xs text-slate-500">On loan — return first</span>}
                                        </>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {canManage && (
                                <div className="flex gap-2 max-w-md">
                                  <input
                                    className="input flex-1"
                                    placeholder="New barcode"
                                    value={newBarcode}
                                    onChange={(e) => setNewBarcode(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCopy(b.id))}
                                  />
                                  <button type="button" className="btn-secondary" onClick={() => addCopy(b.id)}>Add copy</button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "loans" && (
        <div className="card overflow-hidden">
          <table className="table text-sm">
            <thead>
              <tr><th>Book</th><th>Barcode</th><th>Member</th><th>Due</th><th>Status</th>{canManage && <th></th>}</tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr><td colSpan={canManage ? 6 : 5} className="text-center py-10 text-slate-400">No loans recorded.</td></tr>
              ) : loans.map((row: any) => {
                const member = row.student
                  ? `${row.student.admissionNumber ?? ""} ${row.student.firstName} ${row.student.lastName}`.trim()
                  : row.staffMember
                    ? `${row.staffMember.employeeNo} ${row.staffMember.firstName} ${row.staffMember.lastName}`
                    : "—";
                const active = !row.loan.returnedAt;
                return (
                  <tr key={row.loan.id}>
                    <td>{row.book.title}</td>
                    <td className="font-mono text-slate-400 text-xs">{row.copy.barcode}</td>
                    <td>{member}</td>
                    <td className="text-slate-400">{row.loan.dueAt ? new Date(row.loan.dueAt).toLocaleDateString() : "—"}</td>
                    <td>{active ? <span className="text-amber-300">Active</span> : <span className="text-slate-500">Returned</span>}</td>
                    <td>
                      {active && canManage && (
                        <button type="button" className="btn-ghost text-xs" onClick={() => returnLoan(row.loan.id)}>Return</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {section === "issue" && canManage && (
        <form onSubmit={issueLoan} className="card p-6 space-y-4 max-w-3xl">
          <h3 className="font-semibold text-white">Issue a loan</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Available copy *</label>
              <select className="input" required value={loanForm.copyId} onChange={(e) => setLoanForm({ ...loanForm, copyId: e.target.value })}>
                <option value="">Select copy…</option>
                {copies.map((row: any) => (
                  <option key={row.copy.id} value={row.copy.id}>
                    {row.book.title} — {row.copy.barcode}
                  </option>
                ))}
              </select>
              {copies.length === 0 && <p className="text-xs text-amber-400 mt-1">Add books and available copies first.</p>}
            </div>
            <div>
              <label className="label">Member type</label>
              <select
                className="input"
                value={loanForm.memberType}
                onChange={(e) => setLoanForm({ ...loanForm, memberType: e.target.value as "student" | "staff", memberId: "" })}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="label">Member *</label>
              <select className="input" required value={loanForm.memberId} onChange={(e) => setLoanForm({ ...loanForm, memberId: e.target.value })}>
                <option value="">Select…</option>
                {(loanForm.memberType === "student" ? students : staff).map((m) => (
                  <option key={m.id} value={m.id}>
                    {"admissionNumber" in m && m.admissionNumber ? `${m.admissionNumber} — ` : ""}{m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input className="input" type="date" value={loanForm.dueAt} onChange={(e) => setLoanForm({ ...loanForm, dueAt: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={!loanForm.copyId || !loanForm.memberId}>Issue loan</button>
        </form>
      )}

      {!canManage && section === "issue" && (
        <p className="text-slate-400 text-sm">You need library.manage permission to issue loans.</p>
      )}
    </div>
  );
};
