import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { inventoryItems, inventoryStockMoves, inventorySuppliers, purchaseRequests } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { safeList } from "../lib/safe-route";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/dashboard", ...guard, requirePermission("inventory.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const data = { items: 0, lowStock: 0, suppliers: 0, pendingRequests: 0 };
    try {
      const [items] = await db.select({ n: sql<number>`count(*)` }).from(inventoryItems).where(eq(inventoryItems.tenantId, tenant.id));
      data.items = Number(items?.n ?? 0);
      const [low] = await db.select({ n: sql<number>`count(*)` }).from(inventoryItems).where(and(
        eq(inventoryItems.tenantId, tenant.id),
        sql`${inventoryItems.quantity} <= 5`,
      ));
      data.lowStock = Number(low?.n ?? 0);
    } catch { /* ignore */ }
    try {
      const [sup] = await db.select({ n: sql<number>`count(*)` }).from(inventorySuppliers).where(eq(inventorySuppliers.tenantId, tenant.id));
      data.suppliers = Number(sup?.n ?? 0);
    } catch { /* ignore */ }
    try {
      const [pr] = await db.select({ n: sql<number>`count(*)` }).from(purchaseRequests).where(and(
        eq(purchaseRequests.tenantId, tenant.id),
        eq(purchaseRequests.status, "pending"),
      ));
      data.pendingRequests = Number(pr?.n ?? 0);
    } catch { /* ignore */ }
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get("/items", ...guard, requirePermission("inventory.view"), safeList("inventory-items", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenant.id)).orderBy(inventoryItems.name);
}));

router.post("/items", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ sku: z.string().min(1), name: z.string().min(1), quantity: z.number().int().optional(), unit: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(inventoryItems).values({
        tenantId: tenant.id,
        sku: req.body.sku.trim(),
        name: req.body.name.trim(),
        quantity: req.body.quantity ?? 0,
        unit: req.body.unit ?? "pcs",
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/items/:id", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ sku: z.string().optional(), name: z.string().optional(), quantity: z.number().int().optional(), unit: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(inventoryItems).set(req.body).where(and(
        eq(inventoryItems.id, req.params.id),
        eq(inventoryItems.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Item not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/items/:id", ...guard, requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(inventoryStockMoves).where(and(
      eq(inventoryStockMoves.tenantId, tenant.id),
      eq(inventoryStockMoves.itemId, req.params.id),
    ));
    const [row] = await db.delete(inventoryItems).where(and(
      eq(inventoryItems.id, req.params.id),
      eq(inventoryItems.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Item not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/items/:id/moves", ...guard, requirePermission("inventory.view"), safeList("inventory-moves", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(inventoryStockMoves).where(and(
    eq(inventoryStockMoves.tenantId, tenant.id),
    eq(inventoryStockMoves.itemId, req.params.id),
  )).orderBy(desc(inventoryStockMoves.movedAt));
}));

router.post("/items/:id/move", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ delta: z.number().int(), reason: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [item] = await db.select().from(inventoryItems).where(and(
        eq(inventoryItems.id, req.params.id),
        eq(inventoryItems.tenantId, tenant.id),
      )).limit(1);
      if (!item) throw new NotFoundError("Item not found");
      const nextQty = item.quantity + req.body.delta;
      if (nextQty < 0) return res.status(400).json({ success: false, message: "Stock cannot go below zero" });
      await db.insert(inventoryStockMoves).values({
        tenantId: tenant.id,
        itemId: item.id,
        delta: req.body.delta,
        reason: req.body.reason ?? null,
      });
      const [updated] = await db.update(inventoryItems).set({ quantity: nextQty }).where(eq(inventoryItems.id, item.id)).returning();
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  },
);

router.get("/suppliers", ...guard, requirePermission("inventory.view"), safeList("inventory-suppliers", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(inventorySuppliers).where(eq(inventorySuppliers.tenantId, tenant.id)).orderBy(inventorySuppliers.name);
}));

router.post("/suppliers", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ name: z.string().min(1), contact: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(inventorySuppliers).values({
        tenantId: tenant.id,
        name: req.body.name.trim(),
        contact: req.body.contact ?? null,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/suppliers/:id", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ name: z.string().optional(), contact: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(inventorySuppliers).set(req.body).where(and(
        eq(inventorySuppliers.id, req.params.id),
        eq(inventorySuppliers.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Supplier not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/suppliers/:id", ...guard, requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(inventorySuppliers).where(and(
      eq(inventorySuppliers.id, req.params.id),
      eq(inventorySuppliers.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Supplier not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/purchase-requests", ...guard, requirePermission("inventory.view"), safeList("purchase-requests", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select({
    request: purchaseRequests,
    supplier: { name: inventorySuppliers.name, contact: inventorySuppliers.contact },
  }).from(purchaseRequests)
    .leftJoin(inventorySuppliers, eq(purchaseRequests.supplierId, inventorySuppliers.id))
    .where(eq(purchaseRequests.tenantId, tenant.id))
    .orderBy(desc(purchaseRequests.createdAt));
}));

router.post("/purchase-requests", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ itemName: z.string().min(1), quantity: z.number().int().positive(), supplierId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(purchaseRequests).values({
        tenantId: tenant.id,
        itemName: req.body.itemName.trim(),
        quantity: req.body.quantity,
        supplierId: req.body.supplierId ?? null,
        status: "pending",
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/purchase-requests/:id", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ status: z.enum(["pending", "approved", "ordered", "received", "cancelled"]).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(purchaseRequests).set(req.body).where(and(
        eq(purchaseRequests.id, req.params.id),
        eq(purchaseRequests.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Request not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/purchase-requests/:id", ...guard, requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(purchaseRequests).where(and(
      eq(purchaseRequests.id, req.params.id),
      eq(purchaseRequests.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Request not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

export default router;
