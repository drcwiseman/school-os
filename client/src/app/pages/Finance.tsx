import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { DollarSign, Loader2, Receipt } from "lucide-react";

function formatMoney(cents: number | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-primary-400" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export const Finance: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<"overview" | "billing" | "collect" | "payments" | "debtors" | "receipts" | "fees">("overview");
  const [collectForm, setCollectForm] = useState({ invoiceId: "", amount: "", method: "cash" });
  const [invoiceForm, setInvoiceForm] = useState({ studentId: "", invoiceNo: "", totalAmount: "", termId: "", dueDate: "" });
  const [bulkForm, setBulkForm] = useState({ termId: "", classId: "", feeStructureId: "" });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [studentList, setStudentList] = useState<{ id: string; firstName: string; lastName: string; admissionNumber: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [feeHeads, setFeeHeads] = useState<{ id: string; name: string }[]>([]);
  const [feeHeadForm, setFeeHeadForm] = useState({ name: "", description: "" });
  const [structureForm, setStructureForm] = useState({
    name: "",
    termId: "",
    classId: "",
    items: [{ feeHeadId: "", amount: "" }],
  });

  useEffect(() => { load(); }, [schoolSlug, tab]);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "overview") {
        const [dash, inv] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/finance/dashboard`),
          api.get(`/s/${schoolSlug}/api/finance/invoices?limit=20`),
        ]);
        setStats(dash.data);
        setInvoices(inv.data || []);
      } else if (tab === "billing") {
        const [stu, trm, cls, fs] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/students?limit=200`),
          api.get(`/s/${schoolSlug}/api/academics/terms`),
          api.get(`/s/${schoolSlug}/api/academics/classes`),
          api.get(`/s/${schoolSlug}/api/finance/fee-structures`),
        ]);
        setStudentList(stu.data ?? []);
        setTerms(trm.data ?? []);
        setClasses(cls.data ?? []);
        setFeeStructures(fs.data ?? []);
      } else if (tab === "collect") {
        setDebtors((await api.get(`/s/${schoolSlug}/api/finance/debtors`)).data ?? []);
      } else if (tab === "payments") {
        setPayments((await api.get(`/s/${schoolSlug}/api/finance/payments`)).data ?? []);
      } else if (tab === "fees") {
        const [fs, fh, trm, cls] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/finance/fee-structures`),
          api.get(`/s/${schoolSlug}/api/finance/fee-heads`),
          api.get(`/s/${schoolSlug}/api/academics/terms`),
          api.get(`/s/${schoolSlug}/api/academics/classes`),
        ]);
        setFeeStructures(fs.data ?? []);
        setFeeHeads(fh.data ?? []);
        setTerms(trm.data ?? []);
        setClasses(cls.data ?? []);
      } else if (tab === "debtors") {
        setDebtors((await api.get(`/s/${schoolSlug}/api/finance/debtors`)).data ?? []);
      } else {
        setReceipts((await api.get(`/s/${schoolSlug}/api/finance/receipts`)).data ?? []);
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const voidPayment = async (id: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/finance/payments/${id}/void`, {});
      toast("Payment voided", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const deleteFeeStructure = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/finance/fee-structures/${id}`);
      toast("Fee structure removed", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/finance/payments`, {
        invoiceId: collectForm.invoiceId,
        amount: Math.round(Number(collectForm.amount) * 100),
        method: collectForm.method,
      });
      toast("Payment recorded", "success");
      setCollectForm({ invoiceId: "", amount: "", method: "cash" });
      setTab("payments");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/finance/invoices/${id}`);
      toast("Invoice removed", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/finance/invoices`, {
        studentId: invoiceForm.studentId,
        invoiceNo: invoiceForm.invoiceNo,
        totalAmount: Math.round(Number(invoiceForm.totalAmount) * 100),
        termId: invoiceForm.termId || undefined,
        dueDate: invoiceForm.dueDate || undefined,
      });
      toast("Invoice created", "success");
      setInvoiceForm({ studentId: "", invoiceNo: "", totalAmount: "", termId: "", dueDate: "" });
      setTab("overview");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const createFeeHead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/finance/fee-heads`, feeHeadForm);
      toast("Fee head added", "success");
      setFeeHeadForm({ name: "", description: "" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const createFeeStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = structureForm.items
      .filter((i) => i.feeHeadId && i.amount)
      .map((i) => ({ feeHeadId: i.feeHeadId, amount: Math.round(Number(i.amount) * 100) }));
    if (items.length === 0) return toast("Add at least one fee line", "error");
    try {
      await api.post(`/s/${schoolSlug}/api/finance/fee-structures`, {
        name: structureForm.name,
        termId: structureForm.termId || undefined,
        classId: structureForm.classId || undefined,
        items,
      });
      toast("Fee structure created", "success");
      setStructureForm({ name: "", termId: "", classId: "", items: [{ feeHeadId: "", amount: "" }] });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const bulkInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/s/${schoolSlug}/api/finance/invoices/bulk`, bulkForm);
      const count = Array.isArray(res.data) ? res.data.length : 0;
      toast(`Created ${count} invoices`, "success");
      setBulkForm({ termId: "", classId: "", feeStructureId: "" });
      setTab("overview");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="text-slate-400 mt-1">Invoices, payments, and collections</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("overview")} className={tabBtn("overview")}>overview</button>
        {hasPermission("finance.invoice.create") && (
          <button type="button" onClick={() => setTab("billing")} className={tabBtn("billing")}>billing</button>
        )}
        <button type="button" onClick={() => setTab("collect")} className={tabBtn("collect")}>collect</button>
        <button type="button" onClick={() => setTab("payments")} className={tabBtn("payments")}>payments</button>
        <button type="button" onClick={() => setTab("fees")} className={tabBtn("fees")}>fee structures</button>
        <button type="button" onClick={() => setTab("debtors")} className={tabBtn("debtors")}>debtors</button>
        <button type="button" onClick={() => setTab("receipts")} className={tabBtn("receipts")}>receipts</button>
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Invoiced" value={formatMoney(stats?.totalInvoiced)} icon={DollarSign} />
            <StatCard label="Total Collected" value={formatMoney(stats?.totalPaid)} icon={Receipt} />
            <StatCard label="Unpaid Invoices" value={String(stats?.unpaidCount ?? 0)} icon={DollarSign} />
          </div>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Recent Invoices</h3></div>
            <table className="table">
              <thead><tr><th>Invoice No</th><th>Amount</th><th>Paid</th><th>Status</th>{hasPermission("finance.invoice.create") && <th>Actions</th>}</tr></thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={hasPermission("finance.invoice.create") ? 5 : 4} className="text-center py-8 text-slate-400">No invoices yet.</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs">{inv.invoiceNo}</td>
                    <td>{formatMoney(inv.totalAmount)}</td>
                    <td>{formatMoney(inv.paidAmount)}</td>
                    <td className="capitalize">{inv.status}</td>
                    {hasPermission("finance.invoice.create") && (
                      <td>
                        <ConfirmAction
                          label="Remove"
                          confirmMessage={`Remove invoice ${inv.invoiceNo}? This soft-deletes the record.`}
                          onConfirm={() => deleteInvoice(inv.id)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "billing" && hasPermission("finance.invoice.create") && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white">Create invoice</h3>
            <form onSubmit={createInvoice} className="space-y-3">
              <div>
                <label className="label">Student</label>
                <select className="input" required value={invoiceForm.studentId} onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}>
                  <option value="">Select student…</option>
                  {studentList.map((s) => (
                    <option key={s.id} value={s.id}>{s.admissionNumber} — {s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Invoice number</label>
                <input className="input" required value={invoiceForm.invoiceNo} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNo: e.target.value })} placeholder="INV-2026-001" />
              </div>
              <div>
                <label className="label">Amount (USD)</label>
                <input className="input" type="number" step="0.01" min="0.01" required value={invoiceForm.totalAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })} />
              </div>
              <div>
                <label className="label">Term (optional)</label>
                <select className="input" value={invoiceForm.termId} onChange={(e) => setInvoiceForm({ ...invoiceForm, termId: e.target.value })}>
                  <option value="">—</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due date (optional)</label>
                <input className="input" type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary w-full">Create invoice</button>
            </form>
          </div>
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white">Bulk billing</h3>
            <p className="text-sm text-slate-400">Generate invoices for all students enrolled in a class using a fee structure.</p>
            <form onSubmit={bulkInvoices} className="space-y-3">
              <div>
                <label className="label">Term</label>
                <select className="input" required value={bulkForm.termId} onChange={(e) => setBulkForm({ ...bulkForm, termId: e.target.value })}>
                  <option value="">Select term…</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" required value={bulkForm.classId} onChange={(e) => setBulkForm({ ...bulkForm, classId: e.target.value })}>
                  <option value="">Select class…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fee structure</label>
                <select className="input" required value={bulkForm.feeStructureId} onChange={(e) => setBulkForm({ ...bulkForm, feeStructureId: e.target.value })}>
                  <option value="">Select structure…</option>
                  {feeStructures.map((fs) => <option key={fs.id} value={fs.id}>{fs.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">Generate invoices</button>
            </form>
          </div>
        </div>
      )}

      {tab === "collect" && hasPermission("finance.payment.create") && (
        <div className="card p-6 max-w-lg space-y-4">
          <h3 className="font-semibold text-white">Record payment</h3>
          <form onSubmit={recordPayment} className="space-y-3">
            <div>
              <label className="label">Unpaid invoice</label>
              <select className="input" required value={collectForm.invoiceId} onChange={(e) => {
                const inv = debtors.find((d) => d.id === e.target.value);
                setCollectForm({
                  ...collectForm,
                  invoiceId: e.target.value,
                  amount: inv ? String((inv.balance ?? 0) / 100) : "",
                });
              }}>
                <option value="">Select invoice…</option>
                {debtors.map((d) => (
                  <option key={d.id} value={d.id}>{d.invoiceNo} — balance {formatMoney(d.balance)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input" type="number" step="0.01" min="0" required value={collectForm.amount} onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={collectForm.method} onChange={(e) => setCollectForm({ ...collectForm, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank transfer</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Record payment</button>
          </form>
        </div>
      )}

      {tab === "payments" && (
        <div className="card overflow-hidden">
          <PaymentsSection
            payments={payments}
            formatMoney={formatMoney}
            canVoid={hasPermission("finance.refund.create")}
            onVoid={voidPayment}
          />
        </div>
      )}

      {tab === "fees" && (
        <div className="space-y-6">
          {hasPermission("finance.invoice.create") && (
            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={createFeeHead} className="card p-6 space-y-3">
                <h3 className="font-semibold text-white">Add fee head</h3>
                <input className="input" required placeholder="Name (e.g. Tuition)" value={feeHeadForm.name} onChange={(e) => setFeeHeadForm({ ...feeHeadForm, name: e.target.value })} />
                <input className="input" placeholder="Description (optional)" value={feeHeadForm.description} onChange={(e) => setFeeHeadForm({ ...feeHeadForm, description: e.target.value })} />
                <button type="submit" className="btn-primary w-full">Add fee head</button>
              </form>
              <form onSubmit={createFeeStructure} className="card p-6 space-y-3">
                <h3 className="font-semibold text-white">Create fee structure</h3>
                <input className="input" required placeholder="Structure name" value={structureForm.name} onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })} />
                <select className="input" value={structureForm.termId} onChange={(e) => setStructureForm({ ...structureForm, termId: e.target.value })}>
                  <option value="">Term (optional)</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select className="input" value={structureForm.classId} onChange={(e) => setStructureForm({ ...structureForm, classId: e.target.value })}>
                  <option value="">Class (optional)</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {structureForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select className="input flex-1" required value={item.feeHeadId} onChange={(e) => {
                      const items = [...structureForm.items];
                      items[idx] = { ...item, feeHeadId: e.target.value };
                      setStructureForm({ ...structureForm, items });
                    }}>
                      <option value="">Fee head…</option>
                      {feeHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    <input className="input w-28" type="number" step="0.01" min="0" required placeholder="USD" value={item.amount} onChange={(e) => {
                      const items = [...structureForm.items];
                      items[idx] = { ...item, amount: e.target.value };
                      setStructureForm({ ...structureForm, items });
                    }} />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setStructureForm({ ...structureForm, items: [...structureForm.items, { feeHeadId: "", amount: "" }] })}>
                    Add line
                  </button>
                  <button type="submit" className="btn-primary flex-1">Save structure</button>
                </div>
              </form>
            </div>
          )}
          {feeHeads.length > 0 && (
            <div className="card p-4">
              <h4 className="text-sm font-medium text-slate-400 mb-2">Fee heads</h4>
              <div className="flex flex-wrap gap-2">
                {feeHeads.map((h) => (
                  <span key={h.id} className="badge-gray">{h.name}</span>
                ))}
              </div>
            </div>
          )}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Fee structures</h3></div>
          <table className="table">
            <thead><tr><th>Name</th><th>Active</th>{hasPermission("finance.invoice.create") && <th>Actions</th>}</tr></thead>
            <tbody>
              {feeStructures.length === 0 ? (
                <tr><td colSpan={hasPermission("finance.invoice.create") ? 3 : 2} className="text-center py-8 text-slate-400">No fee structures.</td></tr>
              ) : feeStructures.map((fs) => (
                <tr key={fs.id}>
                  <td>{fs.name}</td>
                  <td>{fs.isActive ? "Yes" : "No"}</td>
                  {hasPermission("finance.invoice.create") && (
                    <td>
                      <ConfirmAction
                        label="Remove"
                        confirmMessage={`Remove fee structure "${fs.name}"?`}
                        onConfirm={() => deleteFeeStructure(fs.id)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "debtors" && (
        <div className="card overflow-hidden">
          <DebtorsSection debtors={debtors} formatMoney={formatMoney} />
        </div>
      )}

      {tab === "receipts" && (
        <div className="card overflow-hidden">
          <ReceiptsSection receipts={receipts} formatMoney={formatMoney} />
        </div>
      )}
    </div>
  );
};

function PaymentsSection({ payments, formatMoney, canVoid, onVoid }: { payments: any[]; formatMoney: (c?: number) => string; canVoid: boolean; onVoid: (id: string) => void }) {
  return (
    <>
      <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Payments</h3></div>
      <table className="table">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Date</th>
            {canVoid && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr><td colSpan={canVoid ? 5 : 4} className="text-center py-8 text-slate-400">No payments yet.</td></tr>
          ) : payments.map((p) => (
            <tr key={p.id}>
              <td className="font-mono text-xs">{p.receiptNo ?? p.id.slice(0, 8)}</td>
              <td>{formatMoney(p.amount)}</td>
              <td className="capitalize">{p.method ?? "—"}</td>
              <td>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</td>
              {canVoid && (
                <td>
                  <ConfirmAction
                    label="Void"
                    confirmMessage="Void this payment? Allocations will be reversed."
                    onConfirm={() => onVoid(p.id)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function DebtorsSection({ debtors, formatMoney }: { debtors: any[]; formatMoney: (c?: number) => string }) {
  return (
    <>
      <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Debtors</h3></div>
      <table className="table">
        <thead><tr><th>Invoice</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          {debtors.map((d) => (
            <tr key={d.id}><td className="font-mono text-xs">{d.invoiceNo}</td><td>{formatMoney(d.balance)}</td><td>{d.status}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReceiptsSection({ receipts, formatMoney }: { receipts: any[]; formatMoney: (c?: number) => string }) {
  return (
    <>
      <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Receipts</h3></div>
      <table className="table">
        <thead><tr><th>Receipt No</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id}><td className="font-mono text-xs">{r.receiptNo}</td><td>{formatMoney(r.amount)}</td><td>{new Date(r.issuedAt).toLocaleDateString()}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
