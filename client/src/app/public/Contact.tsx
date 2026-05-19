import React, { useState } from "react";
import { ChevronDown, Mail, Phone } from "lucide-react";
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
    <section className="section-pad">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="section-label">Enterprise inquiries</p>
          <h1 className="heading-xl mt-3">Request a live demo</h1>
          <p className="body-lg mx-auto mt-4 max-w-2xl">
            Tell us about your institution. Our team responds within one business day.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-marketing-navy">
                <Mail className="h-5 w-5 text-marketing-sage" />
                <a href="mailto:hello@schoolos.app" className="font-medium hover:text-marketing-burgundy">
                  hello@schoolos.app
                </a>
              </div>
              <div className="flex items-center gap-3 text-marketing-navy">
                <Phone className="h-5 w-5 text-marketing-sage" />
                <span className="font-medium">+1 (800) 555-0199</span>
              </div>
            </div>
            <div className="mt-12 space-y-2">
              <h2 className="font-display text-xl font-semibold text-marketing-navy">Frequently asked</h2>
              {FAQ_ITEMS.map((item, i) => (
                <div key={item.q} className="rounded-xl border border-marketing-navy/10 bg-white/80 overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-marketing-navy"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    {item.q}
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <p className="border-t border-marketing-navy/10 px-4 py-3 text-sm leading-relaxed text-marketing-navy/70">
                      {item.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="glass-card p-8 shadow-marketing-lg">
            {status === "success" && (
              <p className="mb-6 rounded-xl bg-marketing-sage/15 px-4 py-3 text-sm text-marketing-sage">
                Thank you — we&apos;ll be in touch shortly.
              </p>
            )}
            {status === "error" && (
              <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                Something went wrong. Email hello@schoolos.app directly.
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" error={errors.fullName}>
                <input className="input-marketing" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
              </Field>
              <Field label="Role" error={errors.role}>
                <select className="input-marketing" value={form.role} onChange={(e) => update("role", e.target.value as LeadFormValues["role"])}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" className="input-marketing" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </Field>
              <Field label="Phone (optional)">
                <input className="input-marketing" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </Field>
              <Field label="School name" error={errors.schoolName} className="sm:col-span-2">
                <input className="input-marketing" value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)} />
              </Field>
              <Field label="Estimated student body" error={errors.studentCount}>
                <select className="input-marketing" value={form.studentCount} onChange={(e) => update("studentCount", e.target.value as LeadFormValues["studentCount"])}>
                  {STUDENT_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Primary pain point" error={errors.painPoint}>
                <select className="input-marketing" value={form.painPoint} onChange={(e) => update("painPoint", e.target.value as LeadFormValues["painPoint"])}>
                  {PAIN_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Additional context" className="sm:col-span-2">
                <textarea className="input-marketing min-h-[100px] resize-y" value={form.message} onChange={(e) => update("message", e.target.value)} />
              </Field>
            </div>
            <button type="submit" disabled={status === "loading"} className="btn-marketing-primary mt-8 w-full disabled:opacity-60">
              {status === "loading" ? "Submitting…" : "Request demo"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

const Field: React.FC<{
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, error, className = "", children }) => (
  <div className={className}>
    <label className="label-marketing">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);
