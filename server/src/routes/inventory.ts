import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { inventoryItems, inventoryStockMoves, inventorySuppliers, purchaseRequests } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/items", ...guard, requirePermission("inventory.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/items", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ sku: z.string(), name: z.string(), quantity: z.number().optional(), unit: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(inventoryItems).values({ tenantId: tenant.id, sku: req.body.sku, name: req.body.name, quantity: req.body.quantity ?? 0, unit: req.body.unit }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/items/:id/move", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ delta: z.number(), reason: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, req.params.id), eq(inventoryItems.tenantId, tenant.id))).limit(1);
      if (!item) return res.status(404).json({ success: false, message: "Item not found" });
      await db.insert(inventoryStockMoves).values({ tenantId: tenant.id, itemId: item.id, delta: req.body.delta, reason: req.body.reason });
      const [updated] = await db.update(inventoryItems).set({ quantity: item.quantity + req.body.delta }).where(eq(inventoryItems.id, item.id)).returning();
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }
);

router.get("/suppliers", ...guard, requirePermission("inventory.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(inventorySuppliers).where(eq(inventorySuppliers.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/purchase-requests", ...guard, requirePermission("inventory.manage"),
  validate({ body: z.object({ itemName: z.string(), quantity: z.number(), supplierId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(purchaseRequests).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

export default router;
