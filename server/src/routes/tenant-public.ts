import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { applicants } from "../db/schema";
import { eq } from "drizzle-orm";
import { validate } from "../utils/validate";
import { resolveTenant } from "../middleware/tenant";

const router = Router({ mergeParams: true });

router.post("/apply", resolveTenant, validate({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    dob: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
  }),
}), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.insert(applicants).values({
      tenantId: tenant.id,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email ?? null,
      phone: req.body.phone,
      dob: req.body.dob ? new Date(req.body.dob) : null,
      gender: req.body.gender,
      stage: "inquiry",
      notes: "Public online application",
    }).returning();
    res.status(201).json({ success: true, data: { id: row.id, message: "Application received. The school will contact you." } });
  } catch (e) { next(e); }
});

router.get("/school-info", resolveTenant, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: { slug: tenant.slug, name: tenant.name } });
  } catch (e) { next(e); }
});

export default router;
