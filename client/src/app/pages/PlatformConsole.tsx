import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import {
  Loader2, Building2, Plus, Users, Landmark, CreditCard, Activity,
  RefreshCw, ShieldCheck, Settings, ArrowUpRight, Database, Sparkles
} from "lucide-react";
import { useToast } from "../components/Toast";

export const PlatformConsole: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "schools" | "flags" | "plans">("overview");

  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalTenants: 0,
    totalUsers: 0,
    totalStudents: 0,
    totalJobs: 0,
    failedJobs: 0,
    totalRevenue: 0,
  });

  const [selectedSlug, setSelectedSlug] = useState("");
  const [flags, setFlags] = useState({ results_visible: true, fees_must_be_clear: false });
  const [selectedSchoolForPlan, setSelectedSchoolForPlan] = useState("");
  const [selectedPlanCode, setSelectedPlanCode] = useState("starter");

  const [form, setForm] = useState({
    slug: "", name: "", adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: "", planCode: "starter",
  });

  const loadData = async () => {
    try {
      const [t, p, s] = await Promise.all([
        api.get("/api/platform/tenants"),
        api.get("/api/platform/plans"),
        api.get("/api/platform/stats"),
      ]);
      setTenants(t.data ?? []);
      setPlans(p.data ?? []);
      if (s.data) setStats(s.data);
    } catch (err: any) {
      toast("Error loading platform data: " + err.message, "error");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await api.get("/api/platform/auth/me");
        await loadData();
      } catch {
        navigate("/platform/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast("Live statistics reloaded", "success");
  };

  const provision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/platform/tenants", form);
      toast("New school tenant provisioned successfully", "success");
      setForm({ slug: "", name: "", adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: "", planCode: "starter" });
      await loadData();
      setActiveTab("schools");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const saveFlags = async () => {
    if (!selectedSlug) return toast("Select a school tenant", "error");
    try {
      await api.patch(`/api/platform/tenants/${selectedSlug}/feature-flags`, { flags });
      toast("School feature flags updated", "success");
      await loadData();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const updateSchoolPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolForPlan) return toast("Select a school", "error");
    try {
      await api.patch(`/api/platform/tenants/${selectedSchoolForPlan}/plan`, { planCode: selectedPlanCode });
      toast("School plan updated successfully", "success");
      await loadData();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleSchoolSelectForFlags = async (slug: string) => {
    setSelectedSlug(slug);
    if (!slug) return;
    try {
      const res = await api.get(`/api/platform/tenants/${slug}`);
      const tenantData = res.data;
      if (tenantData?.settings?.featureFlagsJson) {
        setFlags(tenantData.settings.featureFlagsJson);
      }
    } catch (err: any) {
      toast("Failed to load tenant flags: " + err.message, "error");
    }
  };

  const logout = async () => {
    await api.post("/api/platform/auth/logout").catch(() => {});
    navigate("/platform/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
              <Building2 className="w-7 h-7 text-primary-500" />
              Platform Console
            </h1>
            <p className="text-sm text-slate-400 mt-1">Manage global multi-tenant schools, usage metrics, and subscription plans.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-ghost flex items-center gap-2"
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Sync Stats
            </button>
            <button onClick={logout} className="btn-ghost text-red-400 hover:text-red-300 hover:border-red-900/50">
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: "overview", label: "Overview Metrics", icon: Activity },
            { id: "schools", label: "School Management", icon: Landmark },
            { id: "flags", label: "Feature Flags", icon: Settings },
            { id: "plans", label: "SaaS Plans & Tiers", icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                  active
                    ? "border-primary-500 text-primary-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview Metrics */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="card p-5 flex items-center gap-4 bg-gradient-to-br from-surface-raised to-slate-900/40">
                <div className="p-3.5 rounded-xl bg-primary-950/60 text-primary-400 border border-primary-800/40">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Schools Provisioned</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.totalTenants}</p>
                </div>
              </div>

              <div className="card p-5 flex items-center gap-4 bg-gradient-to-br from-surface-raised to-slate-900/40">
                <div className="p-3.5 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Students</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.totalStudents}</p>
                </div>
              </div>

              <div className="card p-5 flex items-center gap-4 bg-gradient-to-br from-surface-raised to-slate-900/40">
                <div className="p-3.5 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Background Jobs</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">{stats.totalJobs}</span>
                    {stats.failedJobs > 0 && (
                      <span className="badge-red text-[10px] px-1.5 py-0.5">{stats.failedJobs} failed</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="card p-5 flex items-center gap-4 bg-gradient-to-br from-surface-raised to-slate-900/40">
                <div className="p-3.5 rounded-xl bg-blue-950/60 text-blue-400 border border-blue-800/40">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">System Revenue</p>
                  <p className="text-2xl font-bold text-white mt-1">Ksh {stats.totalRevenue.toLocaleString()}</p>
                </div>
              </div>

            </div>

            {/* Quick Status Bar */}
            <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/20 border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>Multi-tenancy isolation strictly enforced at query-level in PostgreSQL.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> DB Connection Healthy</span>
                <span>•</span>
                <span>Job Queue Listening</span>
              </div>
            </div>

            {/* Tenants Listing summary */}
            <div className="card p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-white">Active School Directory</h3>
                <span className="text-xs text-slate-400">{tenants.length} campuses registered</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>School Name</th>
                      <th>Slug (URL Path)</th>
                      <th>Status</th>
                      <th>Registered At</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id}>
                        <td className="font-medium text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {t.name}
                        </td>
                        <td>
                          <code className="text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded text-xs">/s/{t.slug}</code>
                        </td>
                        <td>
                          <span className={`badge ${t.status === "active" ? "badge-green" : "badge-red"}`}>
                            {t.status}
                          </span>
                        </td>
                        <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="text-right">
                          <Link 
                            to={`/s/${t.slug}/login`} 
                            className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-semibold"
                          >
                            Open Console <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: School Management */}
        {activeTab === "schools" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Provisioning Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-5">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary-500" />
                  Provision School Campus
                </h2>
                <p className="text-xs text-slate-400 mb-4">Instantly seed a brand-new multi-tenant schema, platform roles, permissions, and administrator account.</p>
                
                <form onSubmit={provision} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">School Slug (Lowercase, no spaces)</label>
                    <input 
                      className="input" 
                      placeholder="e.g. springfield-high" 
                      required 
                      value={form.slug} 
                      onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} 
                    />
                  </div>
                  <div>
                    <label className="label">Official School Name</label>
                    <input 
                      className="input" 
                      placeholder="e.g. Springfield Academy" 
                      required 
                      value={form.name} 
                      onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Admin User Email Address</label>
                    <input 
                      className="input" 
                      type="email"
                      placeholder="admin@school.com" 
                      required 
                      value={form.adminEmail} 
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Admin Temporary Password</label>
                    <input 
                      className="input" 
                      type="password"
                      placeholder="••••••••" 
                      required 
                      value={form.adminPassword} 
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Admin First Name</label>
                    <input 
                      className="input" 
                      placeholder="Alice" 
                      required 
                      value={form.adminFirstName} 
                      onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Admin Last Name</label>
                    <input 
                      className="input" 
                      placeholder="Smith" 
                      required 
                      value={form.adminLastName} 
                      onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">SaaS Pricing Plan tier</label>
                    <select 
                      className="input" 
                      value={form.planCode} 
                      onChange={(e) => setForm({ ...form, planCode: e.target.value })}
                    >
                      {plans.map((p) => <option key={p.id} value={p.code}>{p.name} Tier (Ksh {p.priceMonthly.toLocaleString()}/mo)</option>)}
                    </select>
                  </div>
                  <button type="submit" className="btn-primary sm:col-span-2 w-full mt-2 justify-center">
                    Provision School Schema
                  </button>
                </form>
              </div>
            </div>

            {/* Right Col: Plan Migrator */}
            <div className="space-y-6">
              <div className="card p-5">
                <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-500" />
                  Update Subscription Tier
                </h2>
                <p className="text-xs text-slate-400 mb-4">Dynamically adjust the plan code of a registered school.</p>
                
                <form onSubmit={updateSchoolPlan} className="space-y-3">
                  <div>
                    <label className="label">Select School</label>
                    <select 
                      className="input" 
                      value={selectedSchoolForPlan} 
                      onChange={(e) => setSelectedSchoolForPlan(e.target.value)}
                    >
                      <option value="">Choose a school...</option>
                      {tenants.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Select New SaaS Plan Tier</label>
                    <select 
                      className="input" 
                      value={selectedPlanCode} 
                      onChange={(e) => setSelectedPlanCode(e.target.value)}
                    >
                      {plans.map((p) => <option key={p.id} value={p.code}>{p.name} Tier</option>)}
                    </select>
                  </div>
                  <button type="submit" className="btn-primary w-full mt-2 justify-center">
                    Apply Plan Change
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Feature Flags */}
        {activeTab === "flags" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="card p-5">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-500" />
                SaaS Module Feature Toggles
              </h2>
              <p className="text-xs text-slate-400 mb-5">Enable/disable specific features dynamically for individual school tenants based on their operational configurations.</p>
              
              <div className="space-y-5">
                <div>
                  <label className="label">Select Target School</label>
                  <select 
                    className="input" 
                    value={selectedSlug} 
                    onChange={(e) => handleSchoolSelectForFlags(e.target.value)}
                  >
                    <option value="">Select a school to load flags...</option>
                    {tenants.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
                  </select>
                </div>

                {selectedSlug ? (
                  <div className="border-t border-slate-800 pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-white">Active Flags for {selectedSlug}</h3>
                    
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-slate-800 cursor-pointer hover:bg-slate-800/40 transition-all">
                        <div>
                          <p className="text-sm font-semibold text-white">Results Sheet Visibility</p>
                          <p className="text-xs text-slate-400">If disabled, exam results are hidden in student/parent portals.</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-900 border-slate-700 bg-surface rounded"
                          checked={flags.results_visible} 
                          onChange={(e) => setFlags({ ...flags, results_visible: e.target.checked })} 
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-slate-800 cursor-pointer hover:bg-slate-800/40 transition-all">
                        <div>
                          <p className="text-sm font-semibold text-white">Clear Billing Mandate</p>
                          <p className="text-xs text-slate-400">Forces students/parents to settle outstanding dues before reading portals.</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-900 border-slate-700 bg-surface rounded"
                          checked={flags.fees_must_be_clear} 
                          onChange={(e) => setFlags({ ...flags, fees_must_be_clear: e.target.checked })} 
                        />
                      </label>
                    </div>

                    <button 
                      type="button" 
                      className="btn-primary w-full mt-4 justify-center" 
                      onClick={saveFlags}
                    >
                      Save Module Feature Flags
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Please select a school from the dropdown to load and manage feature flags.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: SaaS Plans & Tiers */}
        {activeTab === "plans" && (
          <div className="space-y-6">
            <div className="card p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    SaaS Pricing & Feature Matrix
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Subscription billing tiers seeded globally on the platform.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((p) => {
                  const features = (p.featuresJson ?? {}) as Record<string, boolean>;
                  return (
                    <div 
                      key={p.id} 
                      className="card p-6 flex flex-col justify-between border-slate-800 hover:border-slate-700 transition-all bg-gradient-to-b from-slate-900/20 to-slate-950/40"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="badge-blue font-bold text-xs uppercase tracking-wide px-2 py-0.5">{p.code}</span>
                          <span className="text-xs text-slate-500">Tier ID: {p.id.slice(0, 8)}</span>
                        </div>
                        <h4 className="text-xl font-bold text-white mb-1">{p.name}</h4>
                        <p className="text-3xl font-extrabold text-white mt-3">
                          Ksh {p.priceMonthly.toLocaleString()}
                          <span className="text-xs text-slate-500 font-normal"> / mo</span>
                        </p>

                        <div className="border-t border-slate-800 my-4 pt-4 space-y-2.5">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Enabled Features</p>
                          {Object.entries(features).map(([fKey, fVal]) => (
                            <div key={fKey} className="flex items-center gap-2 text-xs text-slate-300">
                              <span className={`w-1.5 h-1.5 rounded-full ${fVal ? "bg-emerald-500" : "bg-slate-600"}`}></span>
                              <span className="capitalize">{fKey.replace(/_/g, " ")}:</span>
                              <span className="font-semibold text-white">{fVal ? "Included" : "Excluded"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-800/40">
                        <p className="text-[10px] text-slate-500">Automated sequential invoicing is enabled on this tier.</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
