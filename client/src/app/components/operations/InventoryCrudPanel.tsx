import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { useAuth } from "../../state/AuthContext";
import { ConfirmAction } from "../ConfirmAction";
import { Loader2, Plus, Pencil, Package, Truck, ClipboardList, ArrowUpDown } from "lucide-react";

type ItemRow = { id: string; sku: string; name: string; quantity: number; unit?: string | null };
type SupplierRow = { id: string; name: string; contact?: string | null };
type MoveRow = { id: string; delta: number; reason?: string | null; movedAt: string };
type PurchaseRow = {
  request: { id: string; itemName: string; quantity: number; status: string; supplierId?: string | null; createdAt: string };
  supplier?: { name: string | null; contact?: string | null } | null;
};

type Section = "items" | "moves" | "suppliers" | "purchases";

const EMPTY_ITEM = { sku: "", name: "", quantity: "0", unit: "pcs" };
const EMPTY_SUPPLIER = { name: "", contact: "" };
const EMPTY_PURCHASE = { itemName: "", quantity: "1", supplierId: "" };

export const InventoryCrudPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("inventory.manage");
  const [section, setSection] = useState<Section>("items");
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<{ items: number; lowStock: number; suppliers: number; pendingRequests: number } | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [moveForm, setMoveForm] = useState({ delta: "", reason: "" });
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, it, sup, pr] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/inventory/dashboard`).catch(() => ({ data: null })),
        api.get(`/s/${schoolSlug}/api/inventory/items`).catch(() => ({ data: [] })),
        api.get(`/s/${schoolSlug}/api/inventory/suppliers`).catch(() => ({ data: [] })),
        api.get(`/s/${schoolSlug}/api/inventory/purchase-requests`).catch(() => ({ data: [] })),
      ]);
      setDash(d.data);
      setItems(it.data ?? []);
      setSuppliers(sup.data ?? []);
      setPurchases(pr.data ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to load inventory", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  const loadMoves = useCallback(async (itemId: string) => {
    if (!itemId) { setMoves([]); return; }
    try {
      const r = await api.get(`/s/${schoolSlug}/api/inventory/items/${itemId}/moves`);
      setMoves(r.data ?? []);
    } catch {
      setMoves([]);
    }
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMoves(selectedItemId); }, [selectedItemId, loadMoves]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [items, search]);

  const tabCls = (active: boolean) =>
    `shrink-0 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 whitespace-nowrap ${
      active ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
    }`;

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      sku: itemForm.sku.trim(),
      name: itemForm.name.trim(),
      quantity: Number(itemForm.quantity) || 0,
      unit: itemForm.unit.trim() || "pcs",
    };
    try {
      if (editItemId) {
        await api.patch(`/s/${schoolSlug}/api/inventory/items/${editItemId}`, body);
        toast("Item updated", "success");
      } else {
        await api.post(`/s/${schoolSlug}/api/inventory/items`, body);
        toast("Item added", "success");
      }
      setShowItemForm(false);
      setEditItemId(null);
      setItemForm(EMPTY_ITEM);
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/inventory/items/${id}`);
      toast("Item removed", "success");
      if (selectedItemId === id) setSelectedItemId("");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const applyMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !moveForm.delta) return;
    try {
      await api.post(`/s/${schoolSlug}/api/inventory/items/${selectedItemId}/move`, {
        delta: Number(moveForm.delta),
        reason: moveForm.reason.trim() || undefined,
      });
      toast("Stock updated", "success");
      setMoveForm({ delta: "", reason: "" });
      load();
      loadMoves(selectedItemId);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Move failed", "error");
    }
  };

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: supplierForm.name.trim(), contact: supplierForm.contact.trim() || undefined };
    try {
      if (editSupplierId) {
        await api.patch(`/s/${schoolSlug}/api/inventory/suppliers/${editSupplierId}`, body);
        toast("Supplier updated", "success");
      } else {
        await api.post(`/s/${schoolSlug}/api/inventory/suppliers`, body);
        toast("Supplier added", "success");
      }
      setShowSupplierForm(false);
      setEditSupplierId(null);
      setSupplierForm(EMPTY_SUPPLIER);
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/inventory/suppliers/${id}`);
      toast("Supplier removed", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const createPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/inventory/purchase-requests`, {
        itemName: purchaseForm.itemName.trim(),
        quantity: Number(purchaseForm.quantity) || 1,
        supplierId: purchaseForm.supplierId || undefined,
      });
      toast("Purchase request created", "success");
      setPurchaseForm(EMPTY_PURCHASE);
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Request failed", "error");
    }
  };

  const updatePurchaseStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/inventory/purchase-requests/${id}`, { status });
      toast("Status updated", "success");
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="card p-3"><span className="text-slate-500">Items</span><p className="text-xl font-bold text-white">{dash.items}</p></div>
          <div className="card p-3"><span className="text-slate-500">Low stock (≤5)</span><p className="text-xl font-bold text-amber-400">{dash.lowStock}</p></div>
          <div className="card p-3"><span className="text-slate-500">Suppliers</span><p className="text-xl font-bold text-white">{dash.suppliers}</p></div>
          <div className="card p-3"><span className="text-slate-500">Pending POs</span><p className="text-xl font-bold text-white">{dash.pendingRequests}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabCls(section === "items")} onClick={() => setSection("items")}>
          <Package className="w-4 h-4" /> Items
        </button>
        <button type="button" className={tabCls(section === "moves")} onClick={() => setSection("moves")}>
          <ArrowUpDown className="w-4 h-4" /> Stock moves
        </button>
        <button type="button" className={tabCls(section === "suppliers")} onClick={() => setSection("suppliers")}>
          <Truck className="w-4 h-4" /> Suppliers
        </button>
        <button type="button" className={tabCls(section === "purchases")} onClick={() => setSection("purchases")}>
          <ClipboardList className="w-4 h-4" /> Purchase requests
        </button>
      </div>

      {section === "items" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <input className="input max-w-md flex-1" placeholder="Search SKU or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canManage && (
              <button type="button" className="btn-primary" onClick={() => { setEditItemId(null); setItemForm(EMPTY_ITEM); setShowItemForm(!showItemForm); }}>
                <Plus className="w-4 h-4" /> {showItemForm ? "Close" : "Add item"}
              </button>
            )}
          </div>
          {showItemForm && canManage && (
            <form onSubmit={saveItem} className="card p-5 grid md:grid-cols-4 gap-4">
              <div><label className="label">SKU *</label><input className="input" required value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} /></div>
              <div><label className="label">Name *</label><input className="input" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></div>
              <div><label className="label">Quantity</label><input className="input" type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>
              <div><label className="label">Unit</label><input className="input" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} /></div>
              <div className="md:col-span-4 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setShowItemForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editItemId ? "Update" : "Save"}</button>
              </div>
            </form>
          )}
          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Unit</th>{canManage && <th></th>}</tr></thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={canManage ? 5 : 4} className="text-center py-10 text-slate-400">No inventory items yet.</td></tr>
                ) : filteredItems.map((i) => (
                  <tr key={i.id} className={i.quantity <= 5 ? "bg-amber-950/20" : undefined}>
                    <td className="font-mono text-teal-300">{i.sku}</td>
                    <td className="text-white">{i.name}</td>
                    <td>{i.quantity}</td>
                    <td className="text-slate-400">{i.unit ?? "pcs"}</td>
                    {canManage && (
                      <td className="space-x-1 whitespace-nowrap">
                        <button type="button" className="btn-ghost text-xs inline-flex items-center gap-0.5" onClick={() => {
                          setEditItemId(i.id);
                          setItemForm({ sku: i.sku, name: i.name, quantity: String(i.quantity), unit: i.unit ?? "pcs" });
                          setShowItemForm(true);
                        }}><Pencil className="w-3 h-3" /> Edit</button>
                        <ConfirmAction label="Delete" confirmMessage={`Delete ${i.name}?`} onConfirm={() => deleteItem(i.id)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "moves" && (
        <div className="space-y-4">
          <select className="input max-w-md" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
            <option value="">Select item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name} ({i.quantity})</option>)}
          </select>
          {canManage && selectedItemId && (
            <form onSubmit={applyMove} className="card p-5 flex flex-wrap gap-3 items-end">
              <div><label className="label">Adjust (+/-) *</label><input className="input w-28" type="number" required value={moveForm.delta} onChange={(e) => setMoveForm({ ...moveForm, delta: e.target.value })} /></div>
              <div className="flex-1 min-w-[200px]"><label className="label">Reason</label><input className="input" placeholder="Received shipment, issued to class…" value={moveForm.reason} onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })} /></div>
              <button type="submit" className="btn-primary">Apply move</button>
            </form>
          )}
          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead><tr><th>Date</th><th>Change</th><th>Reason</th></tr></thead>
              <tbody>
                {moves.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-400">No moves for this item.</td></tr>
                ) : moves.map((m) => (
                  <tr key={m.id}>
                    <td className="text-slate-400">{new Date(m.movedAt).toLocaleString()}</td>
                    <td className={m.delta >= 0 ? "text-emerald-400" : "text-rose-400"}>{m.delta >= 0 ? `+${m.delta}` : m.delta}</td>
                    <td>{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "suppliers" && (
        <div className="space-y-4">
          {canManage && (
            <button type="button" className="btn-primary" onClick={() => { setEditSupplierId(null); setSupplierForm(EMPTY_SUPPLIER); setShowSupplierForm(!showSupplierForm); }}>
              <Plus className="w-4 h-4" /> {showSupplierForm ? "Close" : "Add supplier"}
            </button>
          )}
          {showSupplierForm && canManage && (
            <form onSubmit={saveSupplier} className="card p-5 grid md:grid-cols-2 gap-4">
              <div><label className="label">Name *</label><input className="input" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></div>
              <div><label className="label">Contact</label><input className="input" value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} /></div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="submit" className="btn-primary">{editSupplierId ? "Update" : "Save"}</button>
              </div>
            </form>
          )}
          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead><tr><th>Name</th><th>Contact</th>{canManage && <th></th>}</tr></thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr><td colSpan={canManage ? 3 : 2} className="text-center py-8 text-slate-400">No suppliers.</td></tr>
                ) : suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="text-slate-400">{s.contact ?? "—"}</td>
                    {canManage && (
                      <td className="space-x-1">
                        <button type="button" className="btn-ghost text-xs" onClick={() => {
                          setEditSupplierId(s.id);
                          setSupplierForm({ name: s.name, contact: s.contact ?? "" });
                          setShowSupplierForm(true);
                        }}>Edit</button>
                        <ConfirmAction label="Delete" confirmMessage={`Delete supplier ${s.name}?`} onConfirm={() => deleteSupplier(s.id)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "purchases" && (
        <div className="space-y-4">
          {canManage && (
            <form onSubmit={createPurchase} className="card p-5 grid md:grid-cols-3 gap-4 items-end">
              <div><label className="label">Item *</label><input className="input" required value={purchaseForm.itemName} onChange={(e) => setPurchaseForm({ ...purchaseForm, itemName: e.target.value })} /></div>
              <div><label className="label">Quantity *</label><input className="input" type="number" min={1} required value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} /></div>
              <div>
                <label className="label">Supplier</label>
                <select className="input" value={purchaseForm.supplierId} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}>
                  <option value="">Optional…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary md:col-span-3 md:max-w-[200px]">Create request</button>
            </form>
          )}
          <div className="card overflow-hidden">
            <table className="table text-sm">
              <thead><tr><th>Item</th><th>Qty</th><th>Supplier</th><th>Status</th>{canManage && <th></th>}</tr></thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr><td colSpan={canManage ? 5 : 4} className="text-center py-8 text-slate-400">No purchase requests.</td></tr>
                ) : purchases.map((row) => (
                  <tr key={row.request.id}>
                    <td>{row.request.itemName}</td>
                    <td>{row.request.quantity}</td>
                    <td className="text-slate-400">{row.supplier?.name ?? "—"}</td>
                    <td><span className="capitalize">{row.request.status}</span></td>
                    {canManage && (
                      <td>
                        <select
                          className="input py-1 text-xs"
                          value={row.request.status}
                          onChange={(e) => updatePurchaseStatus(row.request.id, e.target.value)}
                        >
                          {["pending", "approved", "ordered", "received", "cancelled"].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
