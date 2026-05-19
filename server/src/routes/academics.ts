import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  academicYears, terms, classes, streams, subjects, rooms, teacherAssignments,
  timetables, timetablePeriods, assignments, assignmentSubmissions,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/years", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(academicYears).where(eq(academicYears.tenantId, tenant.id)).orderBy(desc(academicYears.startDate));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/years", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1), startDate: z.string(), endDate: z.string(), isCurrent: z.boolean().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(academicYears).values({
        tenantId: tenant.id,
        name: req.body.name,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: req.body.isCurrent ?? false,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.get("/terms", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(terms).where(eq(terms.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/terms", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ academicYearId: z.string().uuid(), name: z.string().min(1), startDate: z.string(), endDate: z.string(), isCurrent: z.boolean().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(terms).values({
        tenantId: tenant.id,
        academicYearId: req.body.academicYearId,
        name: req.body.name,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: req.body.isCurrent ?? false,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.get("/classes", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(classes).where(eq(classes.tenantId, tenant.id)).orderBy(classes.level);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/classes", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1), level: z.number().int().min(1).optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(classes).values({
        tenantId: tenant.id,
        name: req.body.name,
        level: req.body.level ?? 1,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.get("/classes/:classId/streams", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [cls] = await db.select().from(classes).where(and(eq(classes.id, req.params.classId), eq(classes.tenantId, tenant.id))).limit(1);
    if (!cls) throw new NotFoundError("Class not found");
    const rows = await db.select().from(streams).where(and(eq(streams.classId, cls.id), eq(streams.tenantId, tenant.id)));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/classes/:classId/streams", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [cls] = await db.select().from(classes).where(and(eq(classes.id, req.params.classId), eq(classes.tenantId, tenant.id))).limit(1);
      if (!cls) throw new NotFoundError("Class not found");
      const [row] = await db.insert(streams).values({ tenantId: tenant.id, classId: cls.id, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.get("/subjects", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(subjects).where(eq(subjects.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/subjects", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ code: z.string(), name: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(subjects).values({ tenantId: tenant.id, code: req.body.code, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/rooms", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(rooms).where(eq(rooms.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/rooms", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string(), capacity: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(rooms).values({ tenantId: tenant.id, name: req.body.name, capacity: req.body.capacity }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/timetables", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(timetables).where(eq(timetables.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/timetables", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ classId: z.string().uuid(), termId: z.string().uuid().optional(), name: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [tt] = await db.insert(timetables).values({ tenantId: tenant.id, classId: req.body.classId, termId: req.body.termId, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: tt });
    } catch (e) { next(e); }
  }
);

router.get("/timetables/:id/periods", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(timetablePeriods).where(and(eq(timetablePeriods.timetableId, req.params.id), eq(timetablePeriods.tenantId, tenant.id)));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/timetables/:id/periods", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ dayOfWeek: z.number(), periodNo: z.number(), subjectId: z.string().uuid().optional(), teacherUserId: z.string().uuid().optional(), roomId: z.string().uuid().optional(), startTime: z.string().optional(), endTime: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(timetablePeriods).values({ tenantId: tenant.id, timetableId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/assignments", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(assignments).where(eq(assignments.tenantId, tenant.id)).orderBy(desc(assignments.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/assignments", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ classId: z.string().uuid(), subjectId: z.string().uuid(), title: z.string(), description: z.string().optional(), dueDate: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(assignments).values({
        tenantId: tenant.id, classId: req.body.classId, subjectId: req.body.subjectId,
        title: req.body.title, description: req.body.description, createdBy: user.id,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/assignments/:id/submit", ...guard, requirePermission("academics.view"),
  validate({ body: z.object({ studentId: z.string().uuid(), content: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(assignmentSubmissions).values({
        tenantId: tenant.id, assignmentId: req.params.id, studentId: req.body.studentId, content: req.body.content,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

export default router;
