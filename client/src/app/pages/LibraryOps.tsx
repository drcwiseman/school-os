import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Loader2, RotateCcw } from "lucide-react";

export const LibraryOps: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<"books" | "loans" | "overdue" | "fines">("books");
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [copies, setCopies] = useState<any[]>([]);
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "" });
  const [barcode, setBarcode] = useState("");
  const [loanForm, setLoanForm] = useState({ copyId: "", studentId: "", dueAt: "" });

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "books") setBooks((await api.get(`/s/${schoolSlug}/api/library/books`)).data ?? []);
      if (tab === "loans") setLoans((await api.get(`/s/${schoolSlug}/api/library/loans`)).data ?? []);
      if (tab === "overdue") setOverdue((await api.get(`/s/${schoolSlug}/api/library/loans/overdue`)).data ?? []);
      if (tab === "fines") setFines((await api.get(`/s/${schoolSlug}/api/library/fines`)).data ?? []);
    } catch (err: any) { toast(err.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [schoolSlug, tab]);

  useEffect(() => {
    if (!selectedBook || !schoolSlug) { setCopies([]); return; }
    api.get(`/s/${schoolSlug}/api/library/books/${selectedBook}/copies`).then((r) => setCopies(r.data ?? []));
  }, [selectedBook, schoolSlug]);

  const addBook = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/library/books`, bookForm);
    setBookForm({ title: "", author: "", isbn: "" });
    toast("Book added", "success");
    load();
  };

  const addCopy = async () => {
    if (!selectedBook || !barcode) return;
    await api.post(`/s/${schoolSlug}/api/library/books/${selectedBook}/copies`, { barcode });
    setBarcode("");
    toast("Copy added", "success");
    const r = await api.get(`/s/${schoolSlug}/api/library/books/${selectedBook}/copies`);
    setCopies(r.data ?? []);
  };

  const issueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/library/loans`, { ...loanForm, dueAt: loanForm.dueAt || undefined });
    toast("Loan issued", "success");
    setLoanForm({ copyId: "", studentId: "", dueAt: "" });
    setTab("loans");
  };

  const returnLoan = async (id: string) => {
    await api.post(`/s/${schoolSlug}/api/library/loans/${id}/return`, {});
    toast("Returned — fines auto-applied if overdue", "success");
    load();
  };

  const tabs = ["books", "loans", "overdue", "fines"] as const;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="text-slate-400 mt-1">Catalog, copies, lending, overdue & fines</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>{t}</button>
        ))}
      </div>
      {loading ? <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /> : (
        <>
          {tab === "books" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form onSubmit={addBook} className="card p-5 space-y-3">
                <h3 className="font-semibold text-white">Add book</h3>
                <input className="input" placeholder="Title" required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
                <input className="input" placeholder="Author" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
                <input className="input" placeholder="ISBN" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} />
                <button type="submit" className="btn-primary">Save</button>
              </form>
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-white">Books & copies</h3>
                <select className="input" value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
                  <option value="">Select book…</option>
                  {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                  <button type="button" className="btn-secondary" onClick={addCopy}>Add copy</button>
                </div>
                <ul className="text-sm text-slate-300">{copies.map((c) => <li key={c.id}>{c.barcode} — {c.status}</li>)}</ul>
              </div>
            </div>
          )}
          {tab === "loans" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form onSubmit={issueLoan} className="card p-5 space-y-3">
                <h3 className="font-semibold text-white">Issue loan</h3>
                <input className="input" placeholder="Copy UUID" required value={loanForm.copyId} onChange={(e) => setLoanForm({ ...loanForm, copyId: e.target.value })} />
                <input className="input" placeholder="Student UUID" required value={loanForm.studentId} onChange={(e) => setLoanForm({ ...loanForm, studentId: e.target.value })} />
                <input className="input" type="date" value={loanForm.dueAt} onChange={(e) => setLoanForm({ ...loanForm, dueAt: e.target.value })} />
                <button type="submit" className="btn-primary">Issue</button>
              </form>
              <div className="card p-5">
                <ul className="text-sm space-y-2">
                  {loans.map((l) => (
                    <li key={l.id} className="flex justify-between text-slate-300">
                      <span>{l.studentId?.slice(0, 8)} · {l.returnedAt ? "Returned" : "Active"}</span>
                      {!l.returnedAt && (
                        <button type="button" className="btn-ghost text-xs text-primary-400" onClick={() => returnLoan(l.id)}>
                          <RotateCcw className="w-3 h-3" /> Return
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === "overdue" && (
            <div className="card p-5">
              <ul className="text-sm text-slate-300 space-y-2">
                {overdue.length === 0 ? <li>None overdue.</li> : overdue.map((l) => (
                  <li key={l.id} className="flex justify-between">
                    <span>Due {l.dueAt ? new Date(l.dueAt).toLocaleDateString() : "—"}</span>
                    <button type="button" className="btn-ghost text-xs" onClick={() => returnLoan(l.id)}>Return</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === "fines" && (
            <div className="card p-5">
              <ul className="text-sm text-slate-300">{fines.map((f) => <li key={f.id}>Loan {f.loanId.slice(0, 8)} — {(f.amount / 100).toFixed(2)} {f.paid ? "(paid)" : ""}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
