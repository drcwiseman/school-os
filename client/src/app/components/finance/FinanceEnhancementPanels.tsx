import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { Loader2 } from "lucide-react";

const FEE_TYPES = [
  { value: "tuition", label: "Tuition" },
  { value: "transport", label: "Transport" },
  { value: "hostel", label: "Hostel" },
  { value: "library", label: "Library" },
  { value: "lab", label: "Lab" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
];

function useFinanceMeta(schoolSlug: string) {
  const [students, setStudents] = useState<{ id: string; firstName: string; lastName: string; admissionNumber: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [structures, setStructures] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/students?limit=200`),
      api.get(`/s/${schoolSlug}/api/academics/terms`),
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/finance/fee-structures`),
    ]).then(([s, t, c, fs]) => {
      setStudents(s.data ?? []);
      setTerms(t.data ?? []);
      setClasses(c.data ?? []);
      setStructures(fs.data ?? []);
    }).catch(() => {});
  }, [schoolSlug]);
  return { students, terms, classes, structures };
}

export const AccountsDashboardPanel: React.FC<{ schoolSlug: string; formatMoney: (c?: number) => string }> = ({ schoolSlug, formatMoney }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/finance/accounts-dashboard`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  if (!data) return <p className="text-slate-400 text-sm">Unable to load accounts dashboard.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-slate-500 text-sm">Collected</p><p className="text-xl font-bold text-white">{formatMoney(data.totalPaid)}</p></div>
        <div className="card p-4"><p className="text-slate-500 text-sm">Expenses</p><p className="text-xl font-bold text-white">{formatMoney(data.expensesMinor)}</p></div>
        <div className="card p-4"><p className="text-slate-500 text-sm">Donations</p><p className="text-xl font-bold text-white">{formatMoney(data.donationsMinor)}</p></div>
        <div className="card p-4"><p className="text-slate-500 text-sm">Net position</p><p className="text-xl font-bold text-emerald-400">{formatMoney(data.netMinor)}</p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Collections alert</h4>
          <p className="text-slate-300 text-sm">Unpaid: {data.unpaidCount ?? 0} · Overdue: {data.overdueCount ?? 0}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Revenue by fee type</h4>
          {(data.feeByType ?? []).length === 0 ? (
            <p className="text-slate-500 text-sm">No breakdown yet.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {(data.feeByType ?? []).map((f: any, i: number) => (
                <li key={i} className="flex justify-between text-slate-300 capitalize">
                  <span>{f.feeType ?? "other"}</span>
                  <span>{formatMoney(f.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export const ConcessionsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { students, terms } = useFinanceMeta(schoolSlug);
  const [policies, setPolicies] = useState<any[]>([]);
  const [concessions, setConcessions] = useState<any[]>([]);
  const [policyForm, setPolicyForm] = useState({ name: "", category: "scholarship", percent: "", amountMinor: "", description: "" });
  const [studentForm, setStudentForm] = useState({ studentId: "", policyId: "", termId: "", percent: "", reason: "" });

  const load = useCallback(() => {
    Promise.all([
      api.get(`/s/${schoolSlug}/api/finance/concession-policies`),
      api.get(`/s/${schoolSlug}/api/finance/student-concessions`),
    ]).then(([p, c]) => {
      setPolicies(p.data ?? []);
      setConcessions(c.data ?? []);
    }).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);

  const createPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/concession-policies`, {
      name: policyForm.name,
      category: policyForm.category,
      percent: policyForm.percent ? Number(policyForm.percent) : undefined,
      amountMinor: policyForm.amountMinor ? Math.round(Number(policyForm.amountMinor) * 100) : undefined,
      description: policyForm.description || undefined,
    });
    toast("Concession policy created", "success");
    setPolicyForm({ name: "", category: "scholarship", percent: "", amountMinor: "", description: "" });
    load();
  };

  const grantConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/student-concessions`, {
      studentId: studentForm.studentId,
      policyId: studentForm.policyId || undefined,
      termId: studentForm.termId || undefined,
      percent: studentForm.percent ? Number(studentForm.percent) : undefined,
      reason: studentForm.reason || undefined,
    });
    toast("Student concession granted", "success");
    setStudentForm({ studentId: "", policyId: "", termId: "", percent: "", reason: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={createPolicy} className="card p-6 space-y-3">
          <h3 className="font-semibold text-white">Concession policy</h3>
          <input className="input" required placeholder="Policy name" value={policyForm.name} onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })} />
          <select className="input" value={policyForm.category} onChange={(e) => setPolicyForm({ ...policyForm, category: e.target.value })}>
            <option value="scholarship">Scholarship</option>
            <option value="staff_child">Staff child</option>
            <option value="sibling">Sibling</option>
            <option value="hardship">Hardship</option>
            <option value="other">Other</option>
          </select>
          <input className="input" type="number" min="0" max="100" placeholder="Percent off (optional)" value={policyForm.percent} onChange={(e) => setPolicyForm({ ...policyForm, percent: e.target.value })} />
          <input className="input" type="number" step="0.01" placeholder="Fixed amount off (optional)" value={policyForm.amountMinor} onChange={(e) => setPolicyForm({ ...policyForm, amountMinor: e.target.value })} />
          <button type="submit" className="btn-primary w-full">Save policy</button>
        </form>
        <form onSubmit={grantConcession} className="card p-6 space-y-3">
          <h3 className="font-semibold text-white">Grant to student</h3>
          <select className="input" required value={studentForm.studentId} onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}>
            <option value="">Student…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNumber} — {s.firstName} {s.lastName}</option>)}
          </select>
          <select className="input" value={studentForm.policyId} onChange={(e) => setStudentForm({ ...studentForm, policyId: e.target.value })}>
            <option value="">Policy (optional)</option>
            {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" value={studentForm.termId} onChange={(e) => setStudentForm({ ...studentForm, termId: e.target.value })}>
            <option value="">All terms</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="input" placeholder="Override % (optional)" value={studentForm.percent} onChange={(e) => setStudentForm({ ...studentForm, percent: e.target.value })} />
          <button type="submit" className="btn-primary w-full">Grant concession</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Active student concessions</h3></div>
        <table className="table">
          <thead><tr><th>Student</th><th>Policy</th><th>Discount</th><th>Status</th></tr></thead>
          <tbody>
            {concessions.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-slate-400">None yet.</td></tr>
            ) : concessions.map((row: any) => (
              <tr key={row.concession.id}>
                <td>{row.student?.admissionNumber} {row.student?.firstName} {row.student?.lastName}</td>
                <td>{row.policyName ?? "—"}</td>
                <td>{row.concession.percent ? `${row.concession.percent}%` : row.concession.amountMinor ? `Fixed` : "—"}</td>
                <td className="capitalize">{row.concession.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DiscountsPanel: React.FC<{ schoolSlug: string; formatMoney: (c?: number) => string }> = ({ schoolSlug, formatMoney }) => {
  const { toast } = useToast();
  const { students } = useFinanceMeta(schoolSlug);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", studentId: "", percent: "", amountMinor: "", reason: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/finance/discounts`).then((r) => setRows(r.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/discounts`, {
      name: form.name,
      studentId: form.studentId || undefined,
      percent: form.percent ? Number(form.percent) : undefined,
      amountMinor: form.amountMinor ? Math.round(Number(form.amountMinor) * 100) : undefined,
      reason: form.reason || undefined,
    });
    toast("Discount created", "success");
    setForm({ name: "", studentId: "", percent: "", amountMinor: "", reason: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-6 grid md:grid-cols-3 gap-3">
        <input className="input" required placeholder="Discount name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
          <option value="">All students (policy)</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNumber}</option>)}
        </select>
        <input className="input" type="number" placeholder="% off" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
        <input className="input md:col-span-2" type="number" step="0.01" placeholder="Fixed amount" value={form.amountMinor} onChange={(e) => setForm({ ...form, amountMinor: e.target.value })} />
        <button type="submit" className="btn-primary">Add discount</button>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Name</th><th>Value</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.percent ? `${d.percent}%` : d.amountMinor ? formatMoney(d.amountMinor) : "—"}</td>
                <td className="text-slate-400 text-sm">{d.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AutoInvoicesPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { terms, classes, structures } = useFinanceMeta(schoolSlug);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", feeStructureId: "", termId: "", classId: "", frequency: "term", dueDaysAfter: "14" });

  const load = () => api.get(`/s/${schoolSlug}/api/finance/recurring-schedules`).then((r) => setSchedules(r.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/recurring-schedules`, {
      ...form,
      dueDaysAfter: Number(form.dueDaysAfter),
    });
    toast("Recurring schedule saved", "success");
    setForm({ name: "", feeStructureId: "", termId: "", classId: "", frequency: "term", dueDaysAfter: "14" });
    load();
  };

  const runAll = async () => {
    const res = await api.post(`/s/${schoolSlug}/api/finance/invoices/auto-generate`, { runAllDue: true });
    const d = res.data;
    toast(`Generated ${d?.created?.length ?? 0} invoices (${d?.skipped ?? 0} skipped)`, "success");
    load();
  };

  const runOne = async (id: string) => {
    await api.post(`/s/${schoolSlug}/api/finance/invoices/auto-generate`, { scheduleId: id });
    toast("Invoices generated for schedule", "success");
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card p-6 grid md:grid-cols-2 gap-3">
        <input className="input" required placeholder="Schedule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input" required value={form.feeStructureId} onChange={(e) => setForm({ ...form, feeStructureId: e.target.value })}>
          <option value="">Fee structure…</option>
          {structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input" required value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })}>
          <option value="">Term…</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="term">Per term</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
        <input className="input" type="number" placeholder="Due days after run" value={form.dueDaysAfter} onChange={(e) => setForm({ ...form, dueDaysAfter: e.target.value })} />
        <button type="submit" className="btn-primary md:col-span-2">Add schedule</button>
      </form>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={runAll}>Run all due schedules</button>
        <button type="button" className="btn-ghost" onClick={async () => {
          await api.post(`/s/${schoolSlug}/api/finance/invoices/auto-generate/queue`, {});
          toast("Queued background job", "success");
        }}>Queue background run</button>
      </div>
      <ul className="space-y-2">
        {schedules.map((s) => (
          <li key={s.id} className="card p-4 flex justify-between items-center">
            <div>
              <p className="text-white font-medium">{s.name}</p>
              <p className="text-slate-500 text-sm capitalize">{s.frequency} · due +{s.dueDaysAfter}d{s.lastRunAt ? ` · last ${new Date(s.lastRunAt).toLocaleDateString()}` : ""}</p>
            </div>
            <button type="button" className="btn-ghost text-xs" onClick={() => runOne(s.id)}>Run now</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DonationsPanel: React.FC<{ schoolSlug: string; formatMoney: (c?: number) => string }> = ({ schoolSlug, formatMoney }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ donorName: "", amount: "", purpose: "", paymentMethod: "cash", reference: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/finance/donations`).then((r) => setRows(r.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/donations`, {
      donorName: form.donorName,
      amountMinor: Math.round(Number(form.amount) * 100),
      purpose: form.purpose || undefined,
      paymentMethod: form.paymentMethod,
      reference: form.reference || undefined,
    });
    toast("Donation recorded", "success");
    setForm({ donorName: "", amount: "", purpose: "", paymentMethod: "cash", reference: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-6 grid md:grid-cols-3 gap-3">
        <input className="input" required placeholder="Donor name" value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} />
        <input className="input" type="number" step="0.01" required placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input className="input" placeholder="Purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
        <button type="submit" className="btn-primary md:col-span-3">Record donation</button>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Donor</th><th>Amount</th><th>Purpose</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.donorName}</td>
                <td>{formatMoney(d.amountMinor)}</td>
                <td className="text-slate-400">{d.purpose ?? "—"}</td>
                <td>{new Date(d.receivedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const BudgetsPanel: React.FC<{ schoolSlug: string; formatMoney: (c?: number) => string }> = ({ schoolSlug, formatMoney }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ fiscalYear: String(new Date().getFullYear()), category: "", amountMinor: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/finance/budgets/overview`).then((r) => setRows(r.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/budgets`, {
      fiscalYear: Number(form.fiscalYear),
      category: form.category,
      amountMinor: Math.round(Number(form.amountMinor) * 100),
    });
    toast("Budget line added", "success");
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-6 grid md:grid-cols-4 gap-3">
        <input className="input" type="number" required value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} />
        <input className="input" required placeholder="Category (e.g. events)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="input" type="number" step="0.01" required placeholder="Budget amount" value={form.amountMinor} onChange={(e) => setForm({ ...form, amountMinor: e.target.value })} />
        <button type="submit" className="btn-primary">Add budget</button>
      </form>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Category</th><th>Planned</th><th>Actual</th><th>Variance</th><th>Utilization</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="capitalize">{b.category}</td>
                <td>{formatMoney(b.amountMinor)}</td>
                <td>{formatMoney(b.actualSpentMinor)}</td>
                <td className={b.varianceMinor >= 0 ? "text-emerald-400" : "text-red-400"}>{formatMoney(b.varianceMinor)}</td>
                <td>{b.utilizationPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const PaymentGatewaysPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/finance/payment-gateways`).then((r) => setData(r.data)).catch(() => {});
  }, [schoolSlug]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Online collections use enabled integrations. Record offline payments under Collect.</p>
      {!data?.featureEnabled && (
        <p className="text-amber-400 text-sm">Payment gateways feature is not enabled on your plan.</p>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        {(data?.providers ?? []).map((p: any) => (
          <div key={p.id} className="card p-5">
            <h3 className="font-semibold text-white">{p.name}</h3>
            <p className={`text-sm mt-1 ${p.enabled ? "text-emerald-400" : "text-slate-500"}`}>{p.enabled ? "Connected" : "Not configured"}</p>
            <p className="text-xs text-slate-500 mt-2">Methods: {(p.methods ?? []).join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PaymentHistoryPanel: React.FC<{ schoolSlug: string; formatMoney: (c?: number) => string }> = ({ schoolSlug, formatMoney }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`/s/${schoolSlug}/api/finance/payments/history`)
      .then((r) => setRows(r.data ?? []))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead><tr><th>Student</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Date</th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-8 text-slate-400">No payments yet.</td></tr>
          ) : rows.map((row: any) => (
            <tr key={row.payment.id}>
              <td>{row.student?.admissionNumber} {row.student?.firstName}</td>
              <td className="font-mono text-xs">{row.invoiceNo}</td>
              <td>{formatMoney(row.payment.amount)}</td>
              <td className="capitalize">{row.payment.method ?? "—"}</td>
              <td className="font-mono text-xs">{row.receipt?.receiptNo ?? "—"}</td>
              <td>{row.payment.paidAt ? new Date(row.payment.paidAt).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const IncomeExpensePanel: React.FC<{ schoolSlug: string; formatMoney: (c?: number) => string }> = ({ schoolSlug, formatMoney }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [expForm, setExpForm] = useState({ description: "", amount: "", category: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/finance/income-expense`).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [schoolSlug]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/finance/expenses`, {
      description: expForm.description,
      amount: Math.round(Number(expForm.amount) * 100),
      category: expForm.category || undefined,
    });
    toast("Expense recorded", "success");
    setExpForm({ description: "", amount: "", category: "" });
    load();
  };

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-slate-500 text-sm">Total income</p><p className="text-xl font-bold text-white">{formatMoney(data.incomeMinor)}</p></div>
        <div className="card p-4"><p className="text-slate-500 text-sm">Fee income</p><p className="text-xl font-bold text-white">{formatMoney(data.feeIncomeMinor)}</p></div>
        <div className="card p-4"><p className="text-slate-500 text-sm">Expenses</p><p className="text-xl font-bold text-white">{formatMoney(data.expensesMinor)}</p></div>
        <div className="card p-4"><p className="text-slate-500 text-sm">Net</p><p className="text-xl font-bold text-emerald-400">{formatMoney(data.netMinor)}</p></div>
      </div>
      {hasPermission("finance.payment.create") && (
        <form onSubmit={addExpense} className="card p-6 grid md:grid-cols-4 gap-3">
          <input className="input" required placeholder="Description" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
          <input className="input" type="number" step="0.01" required placeholder="Amount" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
          <input className="input" placeholder="Category" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} />
          <button type="submit" className="btn-primary">Add expense</button>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Recent expenses</h4>
          <ul className="text-sm space-y-1">
            {(data.recentExpenses ?? []).map((e: any) => (
              <li key={e.id} className="flex justify-between text-slate-300">
                <span>{e.description}</span>
                <span>{formatMoney(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Recent donations</h4>
          <ul className="text-sm space-y-1">
            {(data.recentDonations ?? []).map((d: any) => (
              <li key={d.id} className="flex justify-between text-slate-300">
                <span>{d.donorName}</span>
                <span>{formatMoney(d.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export { FEE_TYPES };
