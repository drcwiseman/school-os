import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { admissionForms, admissionFormFields } from "../db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { NotFoundError } from "../middleware/error";

export const admissionFormsRouter = Router();
admissionFormsRouter.use(requireAuth, requireTenantMatch);

async function assertFormInTenant(tenantId: string, formId: string) {
  const [form] = await db
    .select({ id: admissionForms.id })
    .from(admissionForms)
    .where(and(eq(admissionForms.id, formId), eq(admissionForms.tenantId, tenantId)))
    .limit(1);
  if (!form) throw new NotFoundError("Admission form not found");
}

// GET /s/:schoolSlug/api/admission-forms
admissionFormsRouter.get("/", requirePermission("admissions.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant.id;
    const forms = await db
      .select()
      .from(admissionForms)
      .where(eq(admissionForms.tenantId, tenantId))
      .orderBy(desc(admissionForms.createdAt));
    res.json({ success: true, data: forms });
  } catch (err) {
    next(err);
  }
});

// GET /s/:schoolSlug/api/admission-forms/:id/fields
admissionFormsRouter.get("/:id/fields", requirePermission("admissions.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant.id;
    const { id } = req.params;
    await assertFormInTenant(tenantId, id);
    const fields = await db
      .select()
      .from(admissionFormFields)
      .where(and(eq(admissionFormFields.formId, id), eq(admissionFormFields.tenantId, tenantId)))
      .orderBy(asc(admissionFormFields.orderIdx));
    res.json({ success: true, data: fields });
  } catch (err) {
    next(err);
  }
});

const createFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// POST /s/:schoolSlug/api/admission-forms
admissionFormsRouter.post("/", requirePermission("admissions.edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant.id;
    const parsed = createFormSchema.parse(req.body);

    const [form] = await db.insert(admissionForms).values({
      tenantId,
      name: parsed.name,
      description: parsed.description ?? null,
    }).returning();

    res.status(201).json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
});

const createFieldSchema = z.object({
  fieldName: z.string().min(1),
  fieldKey: z.string().min(1),
  fieldType: z.enum(["text", "email", "phone", "number", "date", "select"]).default("text"),
  optionsJson: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
  orderIdx: z.number().int().default(0),
});

// POST /s/:schoolSlug/api/admission-forms/:id/fields
admissionFormsRouter.post("/:id/fields", requirePermission("admissions.edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant.id;
    const { id } = req.params;
    await assertFormInTenant(tenantId, id);
    const parsed = createFieldSchema.parse(req.body);

    const [field] = await db.insert(admissionFormFields).values({
      tenantId,
      formId: id,
      fieldName: parsed.fieldName,
      fieldKey: parsed.fieldKey,
      fieldType: parsed.fieldType,
      optionsJson: parsed.optionsJson ?? null,
      isRequired: parsed.isRequired,
      orderIdx: parsed.orderIdx,
    }).returning();

    res.status(201).json({ success: true, data: field });
  } catch (err) {
    next(err);
  }
});

// DELETE /s/:schoolSlug/api/admission-forms/:id/fields/:fieldId
admissionFormsRouter.delete("/:id/fields/:fieldId", requirePermission("admissions.edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant.id;
    const { id, fieldId } = req.params;
    await assertFormInTenant(tenantId, id);

    await db.delete(admissionFormFields).where(
      and(
        eq(admissionFormFields.id, fieldId),
        eq(admissionFormFields.formId, id),
        eq(admissionFormFields.tenantId, tenantId),
      ),
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
