import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { AlertCircle, BookOpen, Search } from "lucide-react";
import { useToast } from "../../../components/Toast";

type LibraryData = {
  libraryCard: { cardNumber: string; status: string } | null;
  libraryStats: { activeLoans: number; overdueLoans: number; unpaidFines: number };
  libraryLoans: Array<{
    id: string;
    bookTitle: string;
    bookAuthor?: string;
    barcode?: string;
    dueAt?: string;
    returnedAt?: string;
  }>;
  fines: Array<{ id: string; loanId: string; amount: number; paid: boolean }>;
  reservations: Array<{
    id: string;
    status: string;
    bookTitle?: string;
    ebookTitle?: string;
    createdAt: string;
  }>;
};

export function StudentLibraryPanel({ schoolSlug }: { schoolSlug: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<{ books: any[]; ebooks: any[] }>({ books: [], ebooks: [] });
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/portal/student/library`);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/portal/student/library/catalog?q=${encodeURIComponent(q)}`);
      setCatalog(res.data ?? { books: [], ebooks: [] });
    } catch {
      setCatalog({ books: [], ebooks: [] });
    } finally {
      setSearching(false);
    }
  };

  const reserve = async (bookId?: string, ebookId?: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/portal/student/library/reservations`, { bookId, ebookId });
      toast("Reservation requested", "success");
      await load();
    } catch (e: any) {
      toast(e.message ?? "Could not reserve", "error");
    }
  };

  const cancelReservation = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/portal/student/library/reservations/${id}`);
      toast("Reservation cancelled", "success");
      await load();
    } catch (e: any) {
      toast(e.message ?? "Could not cancel", "error");
    }
  };

  if (loading) return <p className="portal-empty text-sm">Loading library…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--portal-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--portal-fg-strong)] mb-2">Membership</h3>
        {data?.libraryCard ? (
          <p className="text-sm">
            Card <span className="font-mono font-semibold">{data.libraryCard.cardNumber}</span>
            <span className={`ml-2 student-portal-pill text-[10px] ${data.libraryCard.status === "active" ? "student-portal-pill--ok" : "student-portal-pill--neutral"}`}>
              {data.libraryCard.status}
            </span>
          </p>
        ) : (
          <p className="portal-empty text-sm">No library card on file. Visit the school library to register.</p>
        )}
        {(data?.libraryStats?.overdueLoans ?? 0) > 0 && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {data!.libraryStats.overdueLoans} overdue loan(s)
          </p>
        )}
        {(data?.libraryStats?.unpaidFines ?? 0) > 0 && (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {data!.libraryStats.unpaidFines} unpaid fine(s) — pay at the library desk.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">My loans</h3>
        {(data?.libraryLoans ?? []).length === 0 ? (
          <p className="portal-empty text-sm">No loans recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data!.libraryLoans.map((l) => (
              <li key={l.id} className="rounded-xl border border-[var(--portal-border)] px-4 py-3">
                <p className="font-medium text-[var(--portal-fg-strong)]">{l.bookTitle}</p>
                <p className="text-xs text-[var(--portal-subtle)]">{l.bookAuthor}{l.barcode ? ` · ${l.barcode}` : ""}</p>
                <p className="text-xs mt-1">
                  Due {l.dueAt ? new Date(l.dueAt).toLocaleDateString() : "—"}
                  {l.returnedAt ? " · Returned" : l.dueAt && new Date(l.dueAt) < new Date() ? " · Overdue" : " · On loan"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">Reservations</h3>
        {(data?.reservations ?? []).length === 0 ? (
          <p className="portal-empty text-sm">No reservations.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data!.reservations.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 rounded-lg border border-[var(--portal-border)] px-3 py-2">
                <span>{r.bookTitle ?? r.ebookTitle ?? "Item"} · <span className="capitalize">{r.status}</span></span>
                {r.status === "pending" && (
                  <button type="button" className="text-xs text-red-600 shrink-0" onClick={() => cancelReservation(r.id)}>
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">Browse catalog</h3>
        <form onSubmit={search} className="flex gap-2 mb-3">
          <input
            className="portal-input flex-1 rounded-lg text-sm"
            placeholder="Search title, author, ISBN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={searching} className="portal-btn-primary rounded-lg text-white text-xs px-3 py-2 inline-flex items-center gap-1">
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </form>
        {catalog.books.length === 0 && catalog.ebooks.length === 0 && query.trim() ? (
          <p className="portal-empty text-sm">No matches.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {catalog.books.map((b) => (
              <li key={b.id} className="flex justify-between gap-2 rounded-lg border border-[var(--portal-border)] px-3 py-2">
                <span>
                  <BookOpen className="w-3.5 h-3.5 inline mr-1 portal-accent-text" />
                  {b.title}{b.author ? ` · ${b.author}` : ""}
                  <span className="text-[var(--portal-subtle)] text-xs ml-1">({b.availableCopies ?? 0} available)</span>
                </span>
                <button type="button" className="text-xs portal-accent-text shrink-0" onClick={() => reserve(b.id)}>
                  Reserve
                </button>
              </li>
            ))}
            {catalog.ebooks.map((eb) => (
              <li key={eb.id} className="flex justify-between gap-2 rounded-lg border border-[var(--portal-border)] px-3 py-2">
                <span>{eb.title} <span className="text-[10px] uppercase text-[var(--portal-subtle)]">e-book</span></span>
                <button type="button" className="text-xs portal-accent-text shrink-0" onClick={() => reserve(undefined, eb.id)}>
                  Reserve
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
