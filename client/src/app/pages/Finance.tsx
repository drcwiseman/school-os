import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { DollarSign, Loader2, Receipt } from "lucide-react";
import {
  AccountsDashboardPanel,
  AutoInvoicesPanel,
  BudgetsPanel,
  ConcessionsPanel,
  DiscountsPanel,
  DonationsPanel,
  FEE_TYPES,
  IncomeExpensePanel,
  PaymentGatewaysPanel,
  PaymentHistoryPanel,
} from "../components/finance/FinanceEnhancementPanels";

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
  const { hasPermission, formatMoney, currency, country } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  type FinanceTab =
    | "overview" | "billing" | "collect" | "payments" | "debtors" | "receipts" | "fees"
    | "aging" | "accounting" | "statements"
    | "concessions" | "discounts" | "auto-invoices" | "donations" | "budgets" | "gateways" | "income";
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [aging, setAging] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [statements, setStatements] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
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
  const [feeHeads, setFeeHeads] = useState<{ id: string; name: string; feeType?: string }[]>([]);
  const [feeHeadForm, setFeeHeadForm] = useState({ name: "", feeType: "tuition", description: "" });
  const [structureForm, setStructureForm] = useState({
    name: "",
    termId: "",
    classId: "",
    items: [{ feeHeadId: "", amount: "" }],
  });
  const [expandedStructureId, setExpandedStructureId] = useState<string | null>(null);
  const [structureDetail, setStructureDetail] = useState<{ name: string; items: { feeHeadName: string; amount: number }[]; total: number } | null>(null);

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
      } else if (tab === "payments" && hasPermission("finance.refund.create")) {
        setPayments((await api.get(`/s/${schoolSlug}/api/finance/payments`)).data ?? []);
      } else if (["concessions", "discounts", "auto-invoices", "donations", "budgets", "gateways", "income"].includes(tab)) {
        /* panels load their own data */
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
      } else if (tab === "aging") {
        setAging((await api.get(`/s/${schoolSlug}/api/finance/arrears-aging`)).data);
      } else if (tab === "accounting") {
        const [acc, led] = await Promise.all([
          api.get(`/s/${schoolSlug}/api/finance/accounts`),
          api.get(`/s/${schoolSlug}/api/finance/ledger`),
        ]);
        setAccounts(acc.data ?? []);
        setLedger(led.data ?? []);
      } else if (tab === "statements") {
        setStatements((await api.get(`/s/${schoolSlug}/api/finance/statements`)).data);
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
      setFeeHeadForm({ name: "", feeType: "tuition", description: "" });
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const loadStructureLines = async (id: string) => {
    if (expandedStructureId === id) {
      setExpandedStructureId(null);
      setStructureDetail(null);
      return;
    }
    try {
      const res = await api.get(`/s/${schoolSlug}/api/finance/fee-structures/${id}`);
      setStructureDetail(res.data);
      setExpandedStructureId(id);
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

  const tabBtn = (t: FinanceTab) =>
    `px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="text-slate-400 mt-1 text-sm">All amounts in {currency} · {country === "UG" ? "Uganda" : country} region</p>
          <p className="text-slate-400 mt-1">Fee management, accounting, concessions, budgets, and collections</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("overview")} className={tabBtn("overview")}>dashboard</button>
        {hasPermission("finance.invoice.create") && (
          <button type="button" onClick={() => setTab("billing")} className={tabBtn("billing")}>billing</button>
        )}
        <button type="button" onClick={() => setTab("collect")} className={tabBtn("collect")}>collect</button>
        <button type="button" onClick={() => setTab("payments")} className={tabBtn("payments")}>payment history</button>
        <button type="button" onClick={() => setTab("fees")} className={tabBtn("fees")}>fee types</button>
        <button type="button" onClick={() => setTab("auto-invoices")} className={tabBtn("auto-invoices")}>auto invoices</button>
        <button type="button" onClick={() => setTab("concessions")} className={tabBtn("concessions")}>concessions</button>
        <button type="button" onClick={() => setTab("discounts")} className={tabBtn("discounts")}>discounts</button>
        <button type="button" onClick={() => setTab("donations")} className={tabBtn("donations")}>donations</button>
        <button type="button" onClick={() => setTab("budgets")} className={tabBtn("budgets")}>budgets</button>
        <button type="button" onClick={() => setTab("income")} className={tabBtn("income")}>income & expense</button>
        <button type="button" onClick={() => setTab("gateways")} className={tabBtn("gateways")}>gateways</button>
        <button type="button" onClick={() => setTab("debtors")} className={tabBtn("debtors")}>debtors</button>
        <button type="button" onClick={() => setTab("receipts")} className={tabBtn("receipts")}>receipts</button>
        <button type="button" onClick={() => setTab("aging")} className={tabBtn("aging")}>arrears</button>
        <button type="button" onClick={() => setTab("accounting")} className={tabBtn("accounting")}>accounting</button>
        <button type="button" onClick={() => setTab("statements")} className={tabBtn("statements")}>statements</button>
      </div>

      {tab === "overview" && schoolSlug && (
        <>
          <AccountsDashboardPanel schoolSlug={schoolSlug} formatMoney={formatMoney} />
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
                <label className="label">Amount ({currency})</label>
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

      {tab === "payments" && schoolSlug && (
        <div className="space-y-4">
          <PaymentHistoryPanel schoolSlug={schoolSlug} formatMoney={formatMoney} />
          {hasPermission("finance.refund.create") && payments.length > 0 && (
            <div className="card overflow-hidden">
              <PaymentsSection payments={payments} formatMoney={formatMoney} canVoid onVoid={voidPayment} />
            </div>
          )}
        </div>
      )}

      {tab === "concessions" && schoolSlug && <ConcessionsPanel schoolSlug={schoolSlug} />}
      {tab === "discounts" && schoolSlug && <DiscountsPanel schoolSlug={schoolSlug} formatMoney={formatMoney} />}
      {tab === "auto-invoices" && schoolSlug && <AutoInvoicesPanel schoolSlug={schoolSlug} />}
      {tab === "donations" && schoolSlug && <DonationsPanel schoolSlug={schoolSlug} formatMoney={formatMoney} />}
      {tab === "budgets" && schoolSlug && <BudgetsPanel schoolSlug={schoolSlug} formatMoney={formatMoney} />}
      {tab === "gateways" && schoolSlug && <PaymentGatewaysPanel schoolSlug={schoolSlug} />}
      {tab === "income" && schoolSlug && <IncomeExpensePanel schoolSlug={schoolSlug} formatMoney={formatMoney} />}

      {tab === "fees" && (
        <div className="space-y-6">
          {hasPermission("finance.invoice.create") && (
            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={createFeeHead} className="card p-6 space-y-3">
                <h3 className="font-semibold text-white">Add fee head</h3>
                <input className="input" required placeholder="Name (e.g. Tuition)" value={feeHeadForm.name} onChange={(e) => setFeeHeadForm({ ...feeHeadForm, name: e.target.value })} />
                <select className="input" value={feeHeadForm.feeType} onChange={(e) => setFeeHeadForm({ ...feeHeadForm, feeType: e.target.value })}>
                  {FEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
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
                    <input className="input w-28" type="number" step="0.01" min="0" required placeholder={currency} value={item.amount} onChange={(e) => {
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
                  <span key={h.id} className="badge-gray">{h.name}{h.feeType ? ` · ${h.feeType}` : ""}</span>
                ))}
              </div>
            </div>
          )}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Fee structures</h3></div>
          <table className="table">
            <thead><tr><th>Name</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {feeStructures.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-slate-400">No fee structures.</td></tr>
              ) : feeStructures.map((fs) => (
                <tr key={fs.id}>
                  <td>{fs.name}</td>
                  <td>{fs.isActive ? "Yes" : "No"}</td>
                  <td className="space-x-2">
                    <button type="button" className="btn-ghost text-xs" onClick={() => loadStructureLines(fs.id)}>
                      {expandedStructureId === fs.id ? "Hide lines" : "View lines"}
                    </button>
                    {hasPermission("finance.invoice.create") && (
                      <ConfirmAction
                        label="Remove"
                        confirmMessage={`Remove fee structure "${fs.name}"?`}
                        onConfirm={() => deleteFeeStructure(fs.id)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {structureDetail && expandedStructureId && (
            <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
              <h4 className="text-sm font-medium text-white mb-2">{structureDetail.name} — line items</h4>
              <ul className="text-sm space-y-1">
                {structureDetail.items.map((item, i) => (
                  <li key={i} className="flex justify-between text-slate-300">
                    <span>{item.feeHeadName}</span>
                    <span>{formatMoney(item.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm font-semibold text-white mt-2">Total: {formatMoney(structureDetail.total)}</p>
            </div>
          )}
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

      {tab === "aging" && aging && (
        <div className="grid md:grid-cols-4 gap-4">
          {(["current", "d30", "d60", "d90"] as const).map((k) => (
            <div key={k} className="card p-4">
              <p className="text-slate-500 text-sm capitalize">{k}</p>
              <p className="text-2xl font-bold text-white">{(aging[k] ?? []).length}</p>
              <p className="text-xs text-slate-500 mt-1">invoices</p>
            </div>
          ))}
        </div>
      )}

      {tab === "accounting" && (
        <div className="space-y-4">
          <div className="card p-4 flex gap-2">
            <button type="button" className="btn-primary" onClick={async () => {
              const code = window.prompt("Account code");
              const name = window.prompt("Account name");
              if (!code || !name) return;
              await api.post(`/s/${schoolSlug}/api/finance/accounts`, { code, name });
              load();
            }}>Add account</button>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-white mb-2">Chart of accounts</h3>
            {accounts.map((a) => <p key={a.id} className="text-slate-300 text-sm">{a.code} — {a.name}</p>)}
          </div>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">General ledger</h3></div>
            <table className="table">
              <thead><tr><th>Date</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
              <tbody>
                {ledger.map((l, i) => (
                  <tr key={i}>
                    <td>{l.entryDate}</td>
                    <td>{l.accountCode} {l.accountName}</td>
                    <td>{formatMoney(l.debitMinor)}</td>
                    <td>{formatMoney(l.creditMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "statements" && statements && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold text-white">Profit & Loss</h3>
            <p className="text-slate-400 mt-2">Revenue: {formatMoney(statements.profitAndLoss?.revenueMinor)}</p>
            <p className="text-slate-400">Expenses: {formatMoney(statements.profitAndLoss?.expensesMinor)}</p>
            <p className="text-white font-bold mt-2">Net: {formatMoney(statements.profitAndLoss?.netMinor)}</p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-white">Balance sheet (summary)</h3>
            <p className="text-slate-400 mt-2">Assets: {formatMoney(statements.balanceSheet?.assetsMinor)}</p>
            <p className="text-slate-400">Liabilities: {formatMoney(statements.balanceSheet?.liabilitiesMinor)}</p>
          </div>
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
