import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Globe, Package, BarChart3, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

export const TenantDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [customDomain, setCustomDomain] = useState("");

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/platform/tenants/${slug}`);
      setDetail(res.data);
      setCustomDomain(res.data?.domain?.customDomain ?? "");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [slug]);

  const saveDomain = async () => {
    try {
      await api.patch(`/api/platform/tenants/${slug}/domain`, { customDomain });
      toast("Custom domain saved — add DNS TXT then verify", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const verifyDomain = async () => {
    try {
      await api.post(`/api/platform/tenants/${slug}/domain/verify`);
      toast("Domain marked verified", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const toggleAddon = async (code: string, active: boolean) => {
    try {
      await api.post(`/api/platform/tenants/${slug}/addons`, { code, active });
      toast(active ? "Add-on activated" : "Add-on deactivated", "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const generateLines = async () => {
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/usage/generate-lines`, {
        cycle: detail?.billingCycle,
      });
      toast(`Generated ${res.data?.lines?.length ?? 0} billing line(s)`, "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const shadow = async () => {
    try {
      const res = await api.post(`/api/platform/tenants/${slug}/impersonate`);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
      toast("Shadow session opened in new tab (read-only)", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!detail) return <p className="text-slate-400">School not found.</p>;

  const { tenant, domain, addons, usage, billingLines, billingCycle, plan } = detail;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/platform/tenants" className="text-slate-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-white">{tenant.name}</h2>
          <p className="text-xs text-slate-500 font-mono">/s/{tenant.slug} · {plan?.name ?? "—"}</p>
        </div>
        <button type="button" onClick={shadow} className="ml-auto text-xs bg-blue-600/20 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-lg">
          Shadow (read-only)
        </button>
      </div>

      <section className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Globe size={16} /> Domains & routing
        </h3>
        <p className="text-xs text-slate-400">
          Subdomain: <span className="font-mono text-slate-300">{domain?.subdomain ?? tenant.slug}</span>
          {domain?.suggestedSubdomainUrl && (
            <> · <span className="font-mono text-blue-400">{domain.suggestedSubdomainUrl}</span></>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input text-sm flex-1 min-w-[200px]"
            placeholder="erp.schoolname.ac.ug"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
          <button type="button" className="btn-primary text-sm" onClick={saveDomain}>Save domain</button>
          <button type="button" className="text-sm border border-slate-700 px-3 py-2 rounded-lg text-slate-300" onClick={verifyDomain}>
            Mark verified
          </button>
        </div>
        {domain?.customDomain && (
          <div className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-3 font-mono">
            TXT {domain.dnsTxtRecord?.host} = {domain.dnsTxtRecord?.value}
            <br />
            Status: {domain.domainVerified ? "verified" : domain.sslStatus}
          </div>
        )}
      </section>

      <section className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Package size={16} /> Add-on marketplace
        </h3>
        {addons?.map((a: any) => (
          <label key={a.code} className="flex justify-between items-center text-xs text-slate-300 border border-slate-800 rounded-lg px-3 py-2">
            <span>
              <strong className="text-white">{a.name}</strong>
              <span className="text-slate-500 ml-2">{a.code}</span>
            </span>
            <input
              type="checkbox"
              checked={a.active}
              onChange={(e) => toggleAddon(a.code, e.target.checked)}
            />
          </label>
        ))}
      </section>

      <section className="bg-[#090f1c] border border-slate-900 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 size={16} /> Usage billing — {billingCycle}
          </h3>
          <button type="button" className="btn-primary text-xs" onClick={generateLines}>
            Generate overage lines
          </button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {usage?.map((u: any) => (
            <div key={u.metric} className="border border-slate-800 rounded-lg p-3">
              <p className="text-[10px] uppercase text-slate-500">{u.metric}</p>
              <p className="text-lg font-bold text-white">{u.quantityUsed}</p>
            </div>
          ))}
        </div>
        {billingLines?.length > 0 && (
          <table className="w-full text-xs text-slate-400">
            <thead>
              <tr className="text-left border-b border-slate-800">
                <th className="py-2">Metric</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {billingLines.map((l: any) => (
                <tr key={l.id} className="border-b border-slate-900/50">
                  <td className="py-2">{l.metric}</td>
                  <td>{l.quantity}</td>
                  <td>{(l.amount / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
