import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Loader2, Send } from "lucide-react";

export const PublicApply: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", dob: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api.post(`/s/${schoolSlug}/api/public/apply`, form);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Submission failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white">Apply online</h1>
        <p className="text-slate-400 text-sm mt-1">{schoolSlug}</p>
        {done ? (
          <p className="mt-6 text-emerald-400">Thank you. Your application was received.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input className="input" placeholder="First name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="input" placeholder="Last name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <input type="email" className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input type="date" className="input" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit application</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
