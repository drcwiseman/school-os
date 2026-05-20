import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Check,
  Globe,
  Loader2,
  MinusCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import {
  formatMoneyMinor,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  currencyForCountry,
} from "../../../lib/currencies";
import { FEATURE_CATEGORY_LABELS, FEATURE_CATEGORY_ORDER } from "../../../lib/feature-catalog";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type CatalogFeature = {
  id: string;
  code: string;
  name: string;
  description: string;
  category?: string;
};

function categoryLabel(cat?: string) {
  return FEATURE_CATEGORY_LABELS[cat ?? "modules"] ?? cat ?? "Other";
}

function groupCatalogByCategory(items: CatalogFeature[]) {
  const groups = new Map<string, CatalogFeature[]>();
  for (const f of items) {
    const cat = f.category ?? "modules";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(f);
  }
  const order = [...FEATURE_CATEGORY_ORDER];
  return [...groups.entries()].sort(([a], [b]) => {
    const ia = order.indexOf(a as typeof FEATURE_CATEGORY_ORDER[number]);
    const ib = order.indexOf(b as typeof FEATURE_CATEGORY_ORDER[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

type PlanRow = {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  featuresJson?: Record<string, boolean>;
  regionalPrices?: RegionalRow[];
  resolvedPrice?: { priceMonthly: number; currency: string; source: string };
};

type RegionalRow = {
  id: string;
  countryCode: string;
  currency: string;
  priceMonthly: number;
};

function majorToMinor(major: number) {
  return Math.round(major * 100);
}

function minorToMajor(minor: number) {
  return minor / 100;
}

function slugifyCode(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function featureLabel(catalog: CatalogFeature[], code: string) {
  return catalog.find((f) => f.code === code)?.name ?? code.replace(/_/g, " ");
}

function FeatureList({
  features,
  catalog,
}: {
  features: Record<string, boolean>;
  catalog: CatalogFeature[];
}) {
  const assigned = Object.keys(features);
  if (assigned.length === 0) {
    return <p className="mt-3 text-xs text-slate-400">No features assigned — edit plan to add.</p>;
  }
  const ordered = catalog.length
    ? catalog.filter((f) => f.code in features).map((f) => f.code)
    : assigned;
  const extra = assigned.filter((c) => !ordered.includes(c));
  return (
    <ul className="mt-3 space-y-1.5">
      {[...ordered, ...extra].map((key) => {
        const on = features[key];
        return (
          <li key={key} className="flex items-center gap-2 text-xs">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
              {on ? <Check size={10} /> : <X size={10} />}
            </span>
            <span className={on ? "text-slate-700" : "text-slate-400"}>{featureLabel(catalog, key)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export const PlanManager: React.FC = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formPriceMajor, setFormPriceMajor] = useState(0);
  const [formFeatures, setFormFeatures] = useState<Record<string, boolean>>({});
  const [addFeatureCode, setAddFeatureCode] = useState("");
  const [regionalRows, setRegionalRows] = useState<RegionalRow[]>([]);
  const [newRegional, setNewRegional] = useState({ countryCode: "UG", currency: "UGX", priceMajor: 0 });

  const assignedCodes = useMemo(() => {
    const keys = Object.keys(formFeatures);
    if (!catalog.length) return keys.sort();
    const order = catalog.map((f) => f.code);
    return keys.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [formFeatures, catalog]);
  const unassignedCatalog = useMemo(
    () => catalog.filter((f) => !(f.code in formFeatures)),
    [catalog, formFeatures],
  );

  const loadCatalog = useCallback(async () => {
    try {
      const res = await api.get("/api/platform/plans/meta/features");
      setCatalog(res.data ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  const addFeatureToPlan = (code: string) => {
    if (!code || code in formFeatures) return;
    setFormFeatures((prev) => ({ ...prev, [code]: true }));
    setAddFeatureCode("");
  };

  const removeFeatureFromPlan = (code: string) => {
    setFormFeatures((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const setFeatureEnabled = (code: string, enabled: boolean) => {
    setFormFeatures((prev) => ({ ...prev, [code]: enabled }));
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const q = country ? `country=${country}&currency=${currency}` : `currency=${currency}`;
      const res = await api.get(`/api/platform/plans?${q}`);
      setPlans(res.data ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [country, currency, toast]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setModalMode("create");
    setEditCode(null);
    setFormCode("");
    setFormName("");
    setFormPriceMajor(0);
    setFormFeatures({});
    setAddFeatureCode("");
    setRegionalRows([]);
    setModalOpen(true);
  };

  const openEdit = async (plan: PlanRow) => {
    setModalMode("edit");
    setEditCode(plan.code);
    setFormCode(plan.code);
    setFormName(plan.name);
    setFormPriceMajor(minorToMajor(plan.priceMonthly));
    setFormFeatures({ ...(plan.featuresJson ?? {}) });
    setAddFeatureCode("");
    setModalOpen(true);
    try {
      const res = await api.get(`/api/platform/plans/${plan.code}`);
      setFormFeatures({ ...(res.data?.featuresJson ?? {}) });
      setRegionalRows(res.data?.regionalPrices ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        priceMonthly: majorToMinor(formPriceMajor),
        featuresJson: formFeatures,
      };
      if (modalMode === "create") {
        await api.post("/api/platform/plans", {
          code: formCode.trim() || slugifyCode(formName),
          ...body,
        });
        toast("Plan created", "success");
      } else if (editCode) {
        await api.patch(`/api/platform/plans/${editCode}`, body);
        toast("Plan updated", "success");
      }
      setModalOpen(false);
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (plan: PlanRow) => {
    if (!window.confirm(`Delete plan "${plan.name}"? Schools must be moved off this plan first.`)) return;
    try {
      await api.delete(`/api/platform/plans/${plan.code}`);
      toast("Plan deleted", "success");
      await load(true);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const addRegional = async () => {
    if (!editCode) return;
    try {
      await api.post(`/api/platform/plans/${editCode}/regional-prices`, {
        countryCode: newRegional.countryCode || "*",
        currency: newRegional.currency,
        priceMonthly: majorToMinor(newRegional.priceMajor),
      });
      toast("Regional price saved", "success");
      const res = await api.get(`/api/platform/plans/${editCode}`);
      setRegionalRows(res.data?.regionalPrices ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const removeRegional = async (id: string) => {
    if (!editCode) return;
    try {
      await api.delete(`/api/platform/plans/${editCode}/regional-prices/${id}`);
      setRegionalRows((rows) => rows.filter((r) => r.id !== id));
      toast("Regional price removed", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const stats = useMemo(() => ({
    total: plans.length,
    withRegional: plans.filter((p) => (p.regionalPrices?.length ?? 0) > 0).length,
  }), [plans]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers size={20} className="text-blue-600" />
              SaaS plans & geo pricing
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Plan catalog — define tiers, prices, regional overrides, and feature bundles. To assign plans to schools, use{" "}
              <Link to="/platform/subscriptions" className="text-blue-600 font-medium hover:underline">Subscriptions</Link>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-slate-200 bg-white text-xs px-3 py-2 text-slate-700"
              value={country}
              onChange={(e) => {
                const next = e.target.value;
                setCountry(next);
                if (next) setCurrency(currencyForCountry(next));
              }}
            >
              <option value="">Global (*)</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-200 bg-white text-xs px-3 py-2 text-slate-700"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              Add plan
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={`${CARD} p-4`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Plans</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{stats.total}</p>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">With regional pricing</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{stats.withRegional}</p>
        </div>
        <div className={`${CARD} p-4 col-span-2 sm:col-span-1`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Preview</p>
          <p className="text-sm font-medium text-slate-800 mt-1 flex items-center gap-1">
            <Globe size={14} className="text-blue-600" />
            {country || "*"} / {currency}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((p) => {
          const resolved = p.resolvedPrice ?? { priceMonthly: p.priceMonthly, currency, source: "base" };
          const features = p.featuresJson ?? {};
          return (
            <article key={p.id} className={`${CARD} p-5 flex flex-col`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wide">{p.code}</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">{p.name}</h3>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                    title="Edit plan"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePlan(p)}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete plan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-3 tabular-nums">
                {formatMoneyMinor(resolved.priceMonthly, resolved.currency)}
                <span className="text-xs font-normal text-slate-500"> / mo</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Source: {resolved.source} · base {formatMoneyMinor(p.priceMonthly, currency)}
              </p>
              <p className="text-[10px] text-slate-500 mt-2">{Object.keys(features).length} feature(s) on plan</p>
              <FeatureList features={features} catalog={catalog} />
              {(p.regionalPrices?.length ?? 0) > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Regional overrides</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {(p.regionalPrices as RegionalRow[]).slice(0, 6).map((r) => (
                      <div key={r.id} className="text-[11px] text-slate-600 flex justify-between gap-2">
                        <span className="font-mono">{r.countryCode}/{r.currency}</span>
                        <span className="tabular-nums">{formatMoneyMinor(r.priceMonthly, r.currency)}</span>
                      </div>
                    ))}
                    {(p.regionalPrices?.length ?? 0) > 6 && (
                      <p className="text-[10px] text-slate-400">+{(p.regionalPrices?.length ?? 0) - 6} more</p>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {plans.length === 0 && (
          <div className={`${CARD} p-8 text-center text-slate-500 md:col-span-2`}>
            No plans yet. Click <strong>Add plan</strong> to create your first tier.
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-xl rounded-xl bg-white shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === "create" ? "Add plan" : "Edit plan"}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={savePlan} className="p-6 space-y-4">
              {modalMode === "create" ? (
                <div>
                  <label className="text-xs font-medium text-slate-600">Plan code</label>
                  <input
                    className="input text-sm mt-1 w-full font-mono"
                    placeholder="enterprise"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  />
                  {formName && !formCode && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Auto: <span className="font-mono">{slugifyCode(formName)}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Code: <span className="font-mono font-medium text-slate-800">{formCode}</span>
                </p>
              )}

              <div>
                <label className="text-xs font-medium text-slate-600">Display name</label>
                <input
                  className="input text-sm mt-1 w-full"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Base monthly price ({currency})</label>
                <input
                  type="number"
                  min={0}
                  step={currency === "UGX" || currency === "KES" ? 1000 : 0.01}
                  className="input text-sm mt-1 w-full"
                  value={formPriceMajor}
                  onChange={(e) => setFormPriceMajor(Number(e.target.value) || 0)}
                />
                <p className="text-[10px] text-slate-400 mt-1">Stored in minor units (×100). Preview uses regional overrides when set.</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-slate-600">
                    Plan features ({assignedCodes.length} assigned)
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">
                  Assign modules from the global catalog. Enabled = included on this tier; disabled = blocked for subscribers.
                </p>

                {assignedCodes.length === 0 && (
                  <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center mb-3">
                    No features yet. Add from the catalog below.
                  </p>
                )}

                <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                  {groupCatalogByCategory(
                    assignedCodes.map((code) => catalog.find((f) => f.code === code) ?? {
                      id: code,
                      code,
                      name: code,
                      description: "",
                      category: "modules",
                    }),
                  ).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                        {categoryLabel(cat)}
                      </p>
                      <div className="space-y-2">
                        {items.map((meta) => {
                          const code = meta.code;
                          return (
                      <div
                        key={code}
                        className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{meta?.name ?? code}</p>
                            <p className="text-[10px] font-mono text-slate-500">{code}</p>
                            {meta?.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{meta.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFeatureFromPlan(code)}
                            className="shrink-0 text-slate-400 hover:text-red-600 p-0.5"
                            title="Remove from plan"
                          >
                            <MinusCircle size={18} />
                          </button>
                        </div>
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formFeatures[code] ?? false}
                            onChange={(e) => setFeatureEnabled(code, e.target.checked)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="text-xs text-slate-600">
                            {formFeatures[code] ? "Enabled on this plan" : "Disabled on this plan"}
                          </span>
                        </label>
                      </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {unassignedCatalog.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      className="input text-sm flex-1"
                      value={addFeatureCode}
                      onChange={(e) => setAddFeatureCode(e.target.value)}
                    >
                      <option value="">Add feature to plan…</option>
                      {groupCatalogByCategory(unassignedCatalog).map(([cat, items]) => (
                        <optgroup key={cat} label={categoryLabel(cat)}>
                          {items.map((f) => (
                            <option key={f.id} value={f.code}>{f.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!addFeatureCode}
                      onClick={() => addFeatureToPlan(addFeatureCode)}
                      className="shrink-0 rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ) : catalog.length > 0 ? (
                  <p className="text-[11px] text-emerald-600">All catalog features are assigned to this plan.</p>
                ) : (
                  <p className="text-[11px] text-amber-600">Feature catalog empty — run DB seed/migrations.</p>
                )}

                {catalog.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-700">
                      View full catalog ({catalog.length} services — Odoo-class ERP)
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-2">
                      {groupCatalogByCategory(catalog).map(([cat, items]) => (
                        <div key={cat}>
                          <p className="text-[10px] font-bold text-slate-600">{categoryLabel(cat)}</p>
                          <ul className="text-[11px] text-slate-500">
                            {items.map((f) => (
                              <li key={f.id} className="py-0.5">
                                <span className="font-medium text-slate-700">{f.name}</span>
                                <span className="font-mono text-slate-400 ml-1">{f.code}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {modalMode === "edit" && editCode && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs font-bold text-slate-900">Regional price overrides</p>
                  {regionalRows.length > 0 && (
                    <div className="rounded-md border border-slate-100 divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {regionalRows.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                          <span className="font-mono text-slate-700">{r.countryCode} / {r.currency}</span>
                          <span className="tabular-nums text-slate-600">{formatMoneyMinor(r.priceMonthly, r.currency)}</span>
                          <button type="button" onClick={() => removeRegional(r.id)} className="text-red-500 hover:text-red-700 shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="input text-xs"
                      value={newRegional.countryCode}
                      onChange={(e) => {
                        const cc = e.target.value;
                        setNewRegional({ ...newRegional, countryCode: cc, currency: cc ? currencyForCountry(cc) : newRegional.currency });
                      }}
                    >
                      <option value="*">Global *</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <select
                      className="input text-xs"
                      value={newRegional.currency}
                      onChange={(e) => setNewRegional({ ...newRegional, currency: e.target.value })}
                    >
                      {CURRENCY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      className="input text-xs"
                      placeholder="Price"
                      value={newRegional.priceMajor}
                      onChange={(e) => setNewRegional({ ...newRegional, priceMajor: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addRegional}
                    className="w-full rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add / update regional price
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : modalMode === "create" ? "Create plan" : "Save plan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
