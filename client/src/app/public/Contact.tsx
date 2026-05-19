import React, { useState } from "react";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { PageHero } from "./components/PageHero";
import { FAQ_ITEMS } from "./data/marketing";
import {
  leadFormSchema,
  PAIN_POINTS,
  ROLES,
  STUDENT_RANGES,
  type LeadFormValues,
} from "./schemas/contact";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const emptyForm: LeadFormValues = {
  fullName: "",
  role: "Principal / Headmaster",
  email: "",
  phone: "",
  schoolName: "",
  studentCount: "300 – 800",
  painPoint: "Fragmented systems & spreadsheets",
  message: "",
};

export const Contact: React.FC = () => {
  const [form, setForm] = useState<LeadFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormValues, string>>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const update = <K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadFormSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof LeadFormValues, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof LeadFormValues;
        if (key) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setForm(emptyForm);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Enterprise inquiries"
        title="Request a live demo"
        subtitle="Tell us about your institution. Our team responds within one business day."
      />

      <section className="section-pad !pt-8">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2">
          <div>
            <div className="space-y-5">
              <a href="mailto:hello@schoolos.app" className="flex items-center gap-4 rounded-xl border border-marketing-navy/8 bg-white p-4 shadow-sm transition-shadow hover:shadow-marketing">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-marketing-sage/12">
                  <Mail className="h-5 w-5 text-marketing-sage" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-marketing-navy/45">Email</p>
                  <p className="font-semibold text-marketing-navy">hello@schoolos.app</p>
                </div>
              </a>
              <div className="flex items-center gap-4 rounded-xl border border-marketing-navy/8 bg-white p-4 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-marketing-sage/12">
                  <Phone className="h-5 w-5 text-marketing-sage" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-marketing-navy/45">Phone</p>
                  <p className="font-semibold text-marketing-navy">+1 (800) 555-0199</p>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="font-display text-xl font-semibold text-marketing-navy">Frequently asked</h2>
              <div className="mt-4 space-y-2">
                {FAQ_ITEMS.map((item, i) => (
                  <div key={item.q} className="overflow-hidden rounded-xl border border-marketing-navy/8 bg-white shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold text-marketing-navy"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      {item.q}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-marketing-sage transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                    </button>
                    {openFaq === i && (
                      <p className="border-t border-marketing-navy/6 px-4 py-3 text-sm leading-relaxed text-marketing-navy/65">
                        {item.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="glass-card-elevated p-8 lg:p-10">
            {status === "success" && (
              <p className="mb-6 rounded-xl bg-marketing-sage/12 px-4 py-3 text-sm font-medium text-marketing-sage">
                Thank you — we&apos;ll be in touch within one business day.
              </p>
            )}
            {status === "error" && (
              <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                Something went wrong. Email hello@schoolos.app directly.
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" error={errors.fullName}>
                <input className="input-mkt" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
              </Field>
              <Field label="Role" error={errors.role}>
                <select className="input-mkt" value={form.role} onChange={(e) => update("role", e.target.value as LeadFormValues["role"])}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" className="input-mkt" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </Field>
              <Field label="Phone (optional)">
                <input className="input-mkt" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </Field>
              <Field label="School name" error={errors.schoolName} className="sm:col-span-2">
                <input className="input-mkt" value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)} />
              </Field>
              <Field label="Estimated student body" error={errors.studentCount}>
                <select className="input-mkt" value={form.studentCount} onChange={(e) => update("studentCount", e.target.value as LeadFormValues["studentCount"])}>
                  {STUDENT_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Primary pain point" error={errors.painPoint}>
                <select className="input-mkt" value={form.painPoint} onChange={(e) => update("painPoint", e.target.value as LeadFormValues["painPoint"])}>
                  {PAIN_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Additional context" className="sm:col-span-2">
                <textarea className="input-mkt min-h-[100px] resize-y" value={form.message} onChange={(e) => update("message", e.target.value)} />
              </Field>
            </div>
            <button type="submit" disabled={status === "loading"} className="btn-mkt-primary mt-8 w-full disabled:opacity-60">
              {status === "loading" ? "Submitting…" : "Request demo"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
};

const Field: React.FC<{
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, error, className = "", children }) => (
  <div className={className}>
    <label className="label-mkt">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);
