import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Server, Users, GraduationCap, CreditCard, Shield, Search, Ban, Eye, RefreshCw, Briefcase,
  Database, Globe, Terminal, CheckCircle, Settings, Layers, ShieldCheck, Box, HelpCircle,
  ArrowRightLeft, CheckSquare, AlertCircle, Activity, UserCheck
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { formatMoneyMinor } from "../../lib/currencies";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  country?: string;
  currency?: string;
  planCode?: string;
  planName?: string;
  studentCount?: number;
  staffCount?: number;
  erpUserCount?: number;
};

type Stats = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalStaff?: number;
  totalStudents: number;
  totalJobs: number;
  failedJobs: number;
  pendingJobs?: number;
  runningJobs?: number;
  totalRevenue: number;
  mrr?: number;
  displayCurrency?: string;
  fxProvider?: string;
};

type FeatureRow = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const PlatformDashboard: React.FC = () => {
  const { toast } = useToast();
  
  // Tabs for the Dashboard layout
  const [activeTab, setActiveTab] = useState<"overview" | "security" | "modules" | "schools">("overview");
  
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Plans & Features states
  const [plans, setPlans] = useState<any[]>([]);
  const [globalFeatures, setGlobalFeatures] = useState<any[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState("");
  const [tenantFeatures, setTenantFeatures] = useState<FeatureRow[]>([]);
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Impersonation (Shadowing) simulator states
  const [shadowTenant, setShadowTenant] = useState<TenantRow | null>(null);
  const [shadowLog, setShadowLog] = useState<string[]>([]);
  
  // Exchange rate simulator states
  const [fxBase, setFxBase] = useState("USD");
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [fxSimAmount, setFxSimAmount] = useState("100");
  const [fxSimTarget, setFxSimTarget] = useState("KES");

  const load = async () => {
    try {
      const [t, s, settings, p, gf] = await Promise.all([
        api.get("/api/platform/tenants"),
        api.get("/api/platform/stats"),
        api.get("/api/platform/settings"),
        api.get("/api/platform/plans"),
        api.get("/api/platform/features"),
      ]);
      setTenants(t.data ?? []);
      if (s.data) setStats(s.data);
      if (settings.data?.displayCurrency) setDisplayCurrency(settings.data.displayCurrency);
      if (p.data) setPlans(p.data);
      if (gf.data) setGlobalFeatures(gf.data);
    } catch (e: any) {
      toast(e.message || "Failed to load command center telemetry", "error");
    }
  };

  useEffect(() => {
    load().then(() => setLoading(false));
  }, []);

  // Fetch FX rates when base changes
  useEffect(() => {
    api.get(`/api/platform/exchange-rates?base=${fxBase}`)
      .then((res) => {
        if (res.data?.rates) setFxRates(res.data.rates);
      })
      .catch(() => {});
  }, [fxBase]);

  const saveCurrency = async (code: string) => {
    try {
      await api.patch("/api/platform/settings", { displayCurrency: code });
      setDisplayCurrency(code);
      await load();
      toast(`Platform default display currency is now ${code}`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const toggleStatus = async (slug: string, status: "active" | "suspended" | "trial") => {
    const actionLabel = status === "suspended" ? "Suspend" : status === "active" ? "Reactivate" : "Reset trial state of";
    if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} school /s/${slug}?`)) return;
    try {
      await api.patch(`/api/platform/tenants/${slug}/status`, { status });
      await load();
      toast(`Tenant slug "${slug}" is now ${status}`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const loadTenantFeatures = async (slug: string) => {
    setSelectedTenantSlug(slug);
    if (!slug) {
      setTenantFeatures([]);
      return;
    }
    try {
      const res = await api.get(`/api/platform/tenants/${slug}/features`);
      setTenantFeatures(res.data ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const saveTenantFeatures = async () => {
    if (!selectedTenantSlug) return;
    setSavingFeatures(true);
    try {
      await api.patch(`/api/platform/tenants/${selectedTenantSlug}/features`, {
        features: tenantFeatures.map((f) => ({ code: f.code, enabled: f.enabled })),
      });
      toast("School-level relational feature flags updated successfully", "success");
      await load();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleImpersonate = async (tenant: TenantRow) => {
    try {
      const res = await api.post(`/api/platform/tenants/${tenant.slug}/impersonate`);
      setShadowTenant(tenant);
      setShadowLog([
        `[SecOps] Impersonation token issued for ${tenant.name}`,
        `[SecOps] Read-only session · expires ${res.data?.expiresAt ?? "15m"}`,
        `[SecOps] Opening ${res.data?.url ?? "school console"}…`,
      ]);
      window.open(res.data?.url, "_blank", "noopener,noreferrer");
      toast("Shadow session opened (read-only)", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );
  }, [tenants, search]);

  const cur = stats?.displayCurrency ?? displayCurrency;
  const fmt = (n: number) => formatMoneyMinor(n, cur);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      suspended: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      disabled: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      pending: "bg-amber-500/10 text-amber-400 border-amber-500/20"
    };
    return (
      <span className={`px-2.5 py-0.5 text-[10px] tracking-wide font-semibold rounded border uppercase ${map[status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-slate-450 text-sm font-medium animate-pulse">Establishing secure telemetry channel…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner Control Center */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-[#0a1224] to-[#070e1c] p-6 rounded-2xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-ping" />
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Macro-Economic Command Center
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Platform SaaS administration & isolation telemetry console — consolidated with live FX rates via <strong className="text-blue-400">{stats?.fxProvider ?? "frankfurter.app"}</strong>
          </p>
        </div>
        
        {/* Quick global controls */}
        <div className="flex items-center gap-3 bg-[#060b13]/80 border border-slate-800 p-2 rounded-xl shrink-0">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 pl-2">Base Currency</label>
          <select
            className="bg-[#0b1322] border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={cur}
            onChange={(e) => saveCurrency(e.target.value)}
          >
            {["USD", "KES", "EUR", "GBP", "NGN", "ZAR", "INR", "AED", "UGX"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              load();
              toast("Platform metrics updated live", "success");
            }}
            className="p-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
            title="Refresh Consolidated Telemetry"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Command Navigation */}
      <div className="border-b border-slate-855 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "overview"
              ? "border-blue-500 text-blue-400 bg-blue-500/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          }`}
        >
          <Activity size={14} /> Macro Telemetry
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "security"
              ? "border-blue-500 text-blue-400 bg-blue-500/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          }`}
        >
          <Shield size={14} /> Isolation & RLS Guard
        </button>
        <button
          onClick={() => setActiveTab("modules")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "modules"
              ? "border-blue-500 text-blue-400 bg-blue-500/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          }`}
        >
          <Box size={14} /> Relational Features Flag
        </button>
        <button
          onClick={() => setActiveTab("schools")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "schools"
              ? "border-blue-500 text-blue-400 bg-blue-500/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          }`}
        >
          <Server size={14} /> Registered Schools ({tenants.length})
        </button>
      </div>

      {/* Tab: Macro Telemetry */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Key Metrics Bento */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <BentoCard
              title="Schools Provisioned"
              value={String(stats?.totalTenants ?? 0)}
              sub={`${stats?.activeTenants ?? 0} active SaaS nodes (Billing Plans: ${plans.length})`}
              icon={Server}
              accent="blue"
            />
            <BentoCard
              title="ERP User Accounts"
              value={String(stats?.totalUsers ?? 0)}
              sub="Operator & admin accounts"
              icon={Users}
              accent="purple"
            />
            <BentoCard
              title="HR Employee Registry"
              value={String(stats?.totalStaff ?? 0)}
              sub="Teachers & academic staff"
              icon={Briefcase}
              accent="blue"
            />
            <BentoCard
              title="Students Enrolled"
              value={String(stats?.totalStudents ?? 0)}
              sub="Portal + ERP active database"
              icon={GraduationCap}
              accent="emerald"
            />
            <BentoCard
              title="MRR Consolidated"
              value={fmt(stats?.mrr ?? 0)}
              sub={`Consolidated ARR ${fmt(stats?.totalRevenue ?? 0)}`}
              icon={CreditCard}
              accent="emerald"
              highlight
            />
          </section>

          {/* Quick Informational Notice */}
          <div className="bg-[#0f1b35] border border-blue-900/50 text-blue-300 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs shadow-md">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">SaaS Architecture Boundaries Enforced</p>
                <p className="text-slate-400 mt-1">
                  Global SaaS metrics are aggregated dynamically. Real-time conversion takes regional minor-unit pricing and runs exchange rates in-memory. Soft deletion controls verify payments.
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-slate-400 shrink-0 self-end md:self-center">
              <span>System Jobs: <strong className="text-white">{stats?.totalJobs ?? 0}</strong></span>
              <span>Failed Queue: <strong className="text-rose-400">{stats?.failedJobs ?? 0}</strong></span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" /> Live polling</span>
            </div>
          </div>

          {/* Currency exchange matrix & simulator */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="text-blue-400" size={16} /> Regional Exchange Rates Matrix
                  </h3>
                  <p className="text-[10px] text-slate-400">Consolidated on-the-fly currency calculations based on base {fxBase}</p>
                </div>
                <select
                  value={fxBase}
                  onChange={(e) => setFxBase(e.target.value)}
                  className="bg-[#060b13] border border-slate-800 text-[11px] rounded px-2 py-1 text-slate-300"
                >
                  {["USD", "EUR", "GBP", "KES", "NGN", "UGX", "ZAR"].map((c) => (
                    <option key={c} value={c}>Base: {c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["USD", "EUR", "GBP", "KES", "NGN", "UGX", "ZAR", "INR"].map((targetCode) => {
                  if (targetCode === fxBase) return null;
                  const rate = fxRates[targetCode];
                  return (
                    <div key={targetCode} className="bg-[#050912] border border-slate-850 p-3 rounded-lg hover:border-slate-800 transition-all">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{targetCode}</p>
                      <p className="text-base font-bold text-slate-200 mt-1">
                        {rate ? rate.toLocaleString(undefined, { maximumFractionDigits: 4 }) : <span className="text-slate-600 text-xs animate-pulse">loading...</span>}
                      </p>
                      <p className="text-[8px] text-slate-600 mt-0.5">1 {fxBase} = {rate ?? "?"} {targetCode}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="text-blue-400" size={16} /> FX Conversion Simulator
                </h3>
                <p className="text-[10px] text-slate-400">Verify minor units conversions for invoicing</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Source Amount ({fxBase})</label>
                  <input
                    type="number"
                    value={fxSimAmount}
                    onChange={(e) => setFxSimAmount(e.target.value)}
                    className="w-full bg-[#050912] border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200 mt-1 focus:outline-none"
                    placeholder="Enter major unit amount..."
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Target Currency</label>
                  <select
                    value={fxSimTarget}
                    onChange={(e) => setFxSimTarget(e.target.value)}
                    className="w-full bg-[#050912] border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200 mt-1 focus:outline-none"
                  >
                    {["KES", "UGX", "NGN", "ZAR", "USD", "GBP", "EUR"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {fxRates[fxSimTarget] && (
                  <div className="bg-[#0f172a]/80 p-3 rounded-lg border border-slate-800 text-xs mt-2 space-y-1">
                    <p className="text-slate-400 text-[10px]">Calculated Output:</p>
                    <p className="text-white font-bold text-lg">
                      {((Number(fxSimAmount) || 0) * fxRates[fxSimTarget]).toLocaleString(undefined, { style: "currency", currency: fxSimTarget })}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      Minor units: {Math.round((Number(fxSimAmount) || 0) * fxRates[fxSimTarget] * 100).toLocaleString()} cents/minor
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security & RLS Guard */}
      {activeTab === "security" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Authorization boundary layout cards */}
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="text-blue-500" size={18} /> The Three Autonomous Security Worlds
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Our database and authorization layers are completely bifurcated. Platform permissions and school permissions do not share auth engines.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Domain 1 */}
              <div className="bg-gradient-to-b from-[#0a142c] to-[#070b13] border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg"><Shield size={18} /></div>
                  <span className="text-[9px] uppercase font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">PLATFORM SaaS</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Platform-Level SaaS Management</h4>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Operated by the SchoolOS global team. These accounts do not represent employees at any individual school and <strong>MUST NOT contain a tenant_id</strong>.
                  </p>
                </div>
                <div className="bg-[#050912] p-2.5 rounded-lg border border-slate-850/50 space-y-1 font-mono text-[9px]">
                  <p className="text-emerald-400">TABLE: platform_admins</p>
                  <p className="text-slate-500">FIELDS: id, email, password_hash, role</p>
                  <p className="text-slate-500">SCOPES: plans.manage, tenants.provision</p>
                </div>
              </div>

              {/* Domain 2 */}
              <div className="bg-gradient-to-b from-[#1b0b2e] to-[#070b13] border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="bg-purple-500/20 text-purple-400 p-2 rounded-lg"><Users size={18} /></div>
                  <span className="text-[9px] uppercase font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded">SCHOOL TENANT</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Tenant-Level School ERP</h4>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Operated by staff members of a specific school (e.g. Bursars, Teachers, HR Managers). Authenticates solely inside the school's unique slug context.
                  </p>
                </div>
                <div className="bg-[#050912] p-2.5 rounded-lg border border-slate-850/50 space-y-1 font-mono text-[9px]">
                  <p className="text-purple-400">TABLE: users, roles, user_roles</p>
                  <p className="text-slate-500">FILTER: tenant_id = ctx.tenantId</p>
                  <p className="text-slate-500">SCOPES: standard granular tenant RBAC</p>
                </div>
              </div>

              {/* Domain 3 */}
              <div className="bg-gradient-to-b from-[#0b281f] to-[#070b13] border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg"><UserCheck size={18} /></div>
                  <span className="text-[9px] uppercase font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">PORTAL ONLY</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ownership-Based Portal Scope</h4>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Dedicated portals for Parents and Students. These users have strictly restricted scopes, bypassing standard RBAC entirely for absolute security.
                  </p>
                </div>
                <div className="bg-[#050912] p-2.5 rounded-lg border border-slate-850/50 space-y-1 font-mono text-[9px]">
                  <p className="text-emerald-400">TABLE: parent_accounts, student_accounts</p>
                  <p className="text-slate-500">RULE: Bypasses standard RBAC</p>
                  <p className="text-slate-500">SCOPES: Own records, linked children only</p>
                </div>
              </div>
            </div>
          </section>

          {/* Database & Compliance Guard Checklist */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-5">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare size={16} className="text-emerald-400" /> Database Audit-Safety & Soft Delete Compliance
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Critical tables enforce soft-delete constraints with <code>deleted_at</code>/<code>deleted_by</code> columns.</p>
              </div>

              <div className="space-y-2">
                <ComplianceItem table="payments" description="Enforces financial audit trace protection" checked />
                <ComplianceItem table="marks" description="Protects historical academic score overrides" checked />
                <ComplianceItem table="payroll_runs" description="Maintains permanent salary disbursement safety" checked />
                <ComplianceItem table="payroll_items" description="Preserves exact historical employee payroll records" checked />
                <ComplianceItem table="invoices" description="Guarantees compliance under school tax rules" checked />
                <ComplianceItem table="students" description="Maintains immutable record trail for enrolled pupils" checked />
                <ComplianceItem table="staff" description="Keeps records of former teachers & employees intact" checked />
              </div>
            </div>

            <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-5">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal size={16} className="text-blue-400" /> SecOps Row-Level Security Safeguards
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Operational safeguards protecting multi-tenant integrity across systems.</p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 bg-[#050912] p-3 rounded-lg border border-slate-850">
                  <div className="bg-blue-500/10 text-blue-400 p-1.5 rounded h-fit"><Database size={16} /></div>
                  <div className="text-xs">
                    <p className="font-semibold text-white">Dynamic Context Query Helper</p>
                    <p className="text-slate-400 mt-1 leading-relaxed">
                      All queries run scoped by the active tenant ID loaded inside express middleware via: <code>WHERE tenant_id = ctx.tenantId</code>. Direct queries without filters are banned.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 bg-[#050912] p-3 rounded-lg border border-slate-850">
                  <div className="bg-purple-500/10 text-purple-400 p-1.5 rounded h-fit"><Globe size={16} /></div>
                  <div className="text-xs">
                    <p className="font-semibold text-white">File Upload Storage Isolation Rules</p>
                    <p className="text-slate-400 mt-1 leading-relaxed">
                      Assets uploaded inside student profiles, contracts, or exams map strictly to isolated folders:
                      <code className="block mt-1.5 text-blue-400 bg-slate-950 p-1 px-2 rounded text-[10px]">/uploads/{"{tenant_id}"}/{"{student_id}"}/docs/</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secure shadow mode simulation console */}
          <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="text-rose-500" size={16} /> Secure Shadow impersonation console
                </h3>
                <p className="text-[10px] text-slate-400">Simulate developer impersonation rules enforcing row-level isolation logic</p>
              </div>
              {shadowTenant && (
                <button
                  onClick={() => setShadowTenant(null)}
                  className="text-[10px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded"
                >
                  Clear context
                </button>
              )}
            </div>

            {shadowTenant ? (
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-slate-950/80 rounded-lg p-4 border border-slate-900 font-mono text-[10px] space-y-1.5 text-slate-300">
                  {shadowLog.map((log, i) => (
                    <p key={i} className={i === shadowLog.length - 1 ? "text-emerald-400" : "text-slate-450"}>{log}</p>
                  ))}
                </div>
                <div className="bg-[#060b13] p-4 rounded-lg border border-slate-850 text-xs space-y-2">
                  <p className="font-bold text-white">Active Scoped context</p>
                  <div className="space-y-1 text-slate-400">
                    <p>School ID: <span className="font-mono text-blue-400">{shadowTenant.id}</span></p>
                    <p>Slug: <span className="font-mono text-purple-400">/s/{shadowTenant.slug}</span></p>
                    <p>Security Context: <span className="text-emerald-400 font-semibold">Strict Scope Enforced</span></p>
                  </div>
                  <div className="pt-2 border-t border-slate-850">
                    <Link
                      to={`/s/${shadowTenant.slug}/dashboard`}
                      className="w-full inline-flex justify-center items-center gap-1.5 py-1.5 text-center text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition-all"
                    >
                      <Eye size={12} /> Open Portal as Scoped Administrator
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-slate-800 rounded-lg bg-[#050912]">
                <HelpCircle className="text-slate-600 mb-2" size={24} />
                <p className="text-xs text-slate-400 font-medium">No active impersonation context</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-xs">Select any school in the "Registered Schools" tab and trigger "Shadow" to inspect row-level isolation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Relational Features Catalog */}
      {activeTab === "modules" && (
        <div className="space-y-8 animate-fadeIn">
          <div className="bg-[#0f1b35] border border-blue-900/50 text-blue-300 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Layers size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Modern Relational Feature Flagging Engine ({globalFeatures.length} catalog modules)</p>
                <p className="text-slate-400 mt-1 leading-relaxed text-xs">
                  We replaced the legacy, unmaintainable <code>feature_flags_json</code> column with strict relational database tables: <code>features</code> & <code>tenant_features</code>. This allows SaaS operators to query feature statuses dynamically, scale billing scopes correctly, and run robust settings analytics in-engine.
                </p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* School selector & relational features toggle list */}
            <div className="lg:col-span-2 bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Settings size={16} className="text-blue-400" /> Relational Features Control Panel
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Toggle relational feature limits on a per-tenant node basis.</p>
                </div>

                <select
                  className="bg-[#060b13] border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                  value={selectedTenantSlug}
                  onChange={(e) => loadTenantFeatures(e.target.value)}
                >
                  <option value="">Select school node…</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.slug}>{t.name} (/s/{t.slug})</option>
                  ))}
                </select>
              </div>

              {selectedTenantSlug ? (
                <div className="space-y-3">
                  {tenantFeatures.map((feat) => (
                    <div
                      key={feat.code}
                      className={`flex items-start justify-between p-3.5 rounded-lg border transition-all ${
                        feat.enabled
                          ? "bg-blue-500/[0.01] border-slate-800"
                          : "bg-slate-950/40 border-slate-900/60 opacity-60"
                      }`}
                    >
                      <div className="space-y-0.5 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">{feat.name}</p>
                          <code className="text-[9px] font-mono text-blue-400 bg-slate-950 px-1.5 py-0.5 rounded">{feat.code}</code>
                        </div>
                        <p className="text-[10px] text-slate-400">{feat.description}</p>
                      </div>
                      
                      {/* Checkbox wrapper with glowing effect */}
                      <label className="relative inline-flex items-center cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={feat.enabled}
                          onChange={(e) =>
                            setTenantFeatures((prev) =>
                              prev.map((x) =>
                                x.code === feat.code ? { ...x, enabled: e.target.checked } : x
                              )
                            )
                          }
                          className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 focus:ring-blue-500 focus:ring-2"
                        />
                      </label>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-slate-850 flex justify-end">
                    <button
                      type="button"
                      disabled={savingFeatures}
                      onClick={saveTenantFeatures}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      {savingFeatures ? "Saving relational state..." : "Save Module Limits"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-800 rounded-lg bg-[#050912]">
                  <HelpCircle className="text-slate-600 mb-2" size={24} />
                  <p className="text-xs text-slate-400 font-medium">Select a school node above</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs">Enforce plans and manage operational capabilities for individual school tenants.</p>
                </div>
              )}
            </div>

            {/* Separated Operations Modules */}
            <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Box size={16} className="text-purple-400" /> Operational Isolation Blueprint
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Decoupled modules prevent cross-permission leakages.</p>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Rather than merging transport, library, and inventory into one generic "Operations" block, the SchoolOS system architecture segregates permissions explicitly:
              </p>

              <div className="space-y-3 pt-2">
                <ModuleIsolationCard
                  code="transport.*"
                  name="Transportation Routing & Stops"
                  role="Transport Officer"
                  description="Manages routes, stops, and vehicles. Librarians have zero access."
                />
                <ModuleIsolationCard
                  code="inventory.*"
                  name="Spars & Stationery Stock"
                  role="Inventory Manager"
                  description="Ensures purchasing and stock audits remain locked to operators."
                />
                <ModuleIsolationCard
                  code="library.*"
                  name="Library Catalog & Fines"
                  role="Librarian"
                  description="Scopes book issuing and fines. No inventory bypass permitted."
                />
                <ModuleIsolationCard
                  code="boarding.*"
                  name="Hostel & Boarding Allocations"
                  role="Boarding Master"
                  description="Manages student dorm allocation, beds, and welfare logs."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Registered Schools */}
      {activeTab === "schools" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main search and count header */}
          <div className="bg-[#090f1c]/80 backdrop-blur-md border border-slate-900 rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Registered Multi-Tenant Nodes</h3>
                <p className="text-xs text-slate-400 mt-1">
                  List of individual educational schools. Enforces separate database settings, regional minor-unit pricing models, and specific student bounds.
                </p>
              </div>
              <div className="relative shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by school name or slug..."
                  className="bg-[#060a12] border border-slate-800 text-xs rounded-lg pl-9 pr-4 py-2 w-64 text-slate-200 focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/20 text-slate-450 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-4 px-6">Educational Institution</th>
                    <th className="py-4 px-6">Domain Context Route</th>
                    <th className="py-4 px-6">Geographic Settings</th>
                    <th className="py-4 px-6">Assigned Plan</th>
                    <th className="py-4 px-6 text-center">Enrolled Pupils</th>
                    <th className="py-4 px-6 text-center">ERP Operators</th>
                    <th className="py-4 px-6">Safety Node Status</th>
                    <th className="py-4 px-6 text-right">Operational Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-350">
                  {filteredTenants.length > 0 ? (
                    filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-[#0c1424]/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-white text-[13px]">{t.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {t.id}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-xs text-blue-400 bg-blue-500/[0.04] border border-blue-500/10 px-2.5 py-1 rounded">
                            /s/{t.slug}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          <span className="font-medium">{t.country || "—"}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({t.currency || "USD"})</span>
                        </td>
                        <td className="py-4 px-6 text-slate-300 font-semibold text-[11px]">
                          {t.planName ?? t.planCode ?? "Starter"}
                        </td>
                        <td className="py-4 px-6 text-center text-slate-200 font-semibold">{t.studentCount ?? 0}</td>
                        <td className="py-4 px-6 text-center text-slate-200 font-semibold">{t.erpUserCount ?? 0}</td>
                        <td className="py-4 px-6">{statusBadge(t.status)}</td>
                        <td className="py-4 px-6 text-right space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleImpersonate(t)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/[0.04] border border-blue-500/20 px-2 py-1.5 rounded transition-all"
                          >
                            <Shield size={10} /> Shadow
                          </button>
                          
                          {t.status === "active" ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/[0.04] border border-rose-500/20 px-2 py-1.5 rounded transition-all"
                              onClick={() => toggleStatus(t.slug, "suspended")}
                            >
                              <Ban size={10} /> Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/[0.04] border border-emerald-500/20 px-2 py-1.5 rounded transition-all"
                              onClick={() => toggleStatus(t.slug, "active")}
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        No active multi-tenant educational nodes matching search constraint.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Bento Card styling with modern design
function BentoCard({
  title, value, sub, icon: Icon, accent, highlight,
}: {
  title: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: "blue" | "purple" | "emerald";
  highlight?: boolean;
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  
  return (
    <div className="bg-gradient-to-b from-[#090f1c] to-[#050912] border border-slate-900 rounded-xl p-5 hover:border-slate-800 transition-all shadow-lg hover:shadow-xl group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-full bg-blue-500/[0.01] group-hover:bg-blue-500/[0.03] transition-all rounded-full blur-xl pointer-events-none" />
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className={`text-2xl font-bold mt-1 tracking-tight ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</h3>
        </div>
        <div className={`p-2.5 rounded-lg border ${colors[accent]} transition-all group-hover:scale-105`}><Icon size={18} /></div>
      </div>
      <p className="mt-3.5 text-[10px] font-medium text-slate-450 leading-relaxed">{sub}</p>
    </div>
  );
}

// Compliance checking items for the inspect panel
function ComplianceItem({ table, description, checked }: { table: string; description: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-[#050912] border border-slate-850 rounded-lg hover:border-slate-800 transition-all">
      <div className="flex items-center gap-2">
        {checked ? (
          <CheckCircle size={14} className="text-emerald-400" />
        ) : (
          <AlertCircle size={14} className="text-slate-600 animate-pulse" />
        )}
        <span className="text-[11px] font-semibold text-slate-300 font-mono">schema.{table}</span>
      </div>
      <span className="text-[9px] text-slate-500 font-medium text-right">{description}</span>
    </div>
  );
}

// Module isolation cards
function ModuleIsolationCard({ code, name, role, description }: { code: string; name: string; role: string; description: string }) {
  return (
    <div className="bg-[#050912] border border-slate-850 p-3 rounded-lg space-y-1 hover:border-slate-800 transition-all">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold font-mono text-purple-400">{code}</p>
        <span className="text-[8px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-semibold">{role}</span>
      </div>
      <p className="text-[11px] font-bold text-slate-200 mt-1">{name}</p>
      <p className="text-[9px] text-slate-400 leading-normal">{description}</p>
    </div>
  );
}
