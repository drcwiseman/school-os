import { Router } from "express";
import { resolveTenant } from "../middleware/tenant";
import { blockWriteIfImpersonationReadOnly } from "../middleware/auth";
import authRoutes     from "./auth";
import tenantRoutes   from "./tenant";
import studentRoutes  from "./students";
import platformRoutes from "./platform";
import { admissionsRouter } from "./admissions";
import { attendanceRouter } from "./attendance";
import academicsRoutes from "./academics";
import financeRoutes from "./finance";
import examsRoutes from "./exams";
import hrRoutes from "./hr";
import payrollRoutes from "./payroll";
import disciplineRoutes from "./discipline";
import healthRoutes from "./health";
import libraryRoutes from "./library";
import inventoryRoutes from "./inventory";
import transportRoutes from "./transport";
import boardingRoutes from "./boarding";
import messagingRoutes from "./messaging";
import reportsRoutes from "./reports";
import portalRoutes from "./portal";
import settingsRoutes from "./settings";
import dashboardRoutes from "./dashboard";
import publicRoutes from "./public";
import saasRoutes from "./saas-features";

const router = Router();

// Public marketing (no auth)
router.use("/api/public", publicRoutes);

// Platform-level routes (no school slug required)
router.use("/api/platform", platformRoutes);

// School-scoped routes — all require valid :schoolSlug
router.use("/s/:schoolSlug", resolveTenant, (req, res, next) => {
  // forward schoolSlug param into nested routers
  req.params.schoolSlug = req.params.schoolSlug;
  next();
});

const schoolApi = [resolveTenant, blockWriteIfImpersonationReadOnly];

router.use("/s/:schoolSlug/api/auth",       ...schoolApi, authRoutes);
router.use("/s/:schoolSlug/api/admin",      ...schoolApi, tenantRoutes);
router.use("/s/:schoolSlug/api/students",   ...schoolApi, studentRoutes);
router.use("/s/:schoolSlug/api/admissions", ...schoolApi, admissionsRouter);
router.use("/s/:schoolSlug/api/attendance", ...schoolApi, attendanceRouter);
router.use("/s/:schoolSlug/api/academics",   ...schoolApi, academicsRoutes);
router.use("/s/:schoolSlug/api/finance",     ...schoolApi, financeRoutes);
router.use("/s/:schoolSlug/api/exams",       ...schoolApi, examsRoutes);
router.use("/s/:schoolSlug/api/hr",          ...schoolApi, hrRoutes);
router.use("/s/:schoolSlug/api/payroll",     ...schoolApi, payrollRoutes);
router.use("/s/:schoolSlug/api/discipline",  ...schoolApi, disciplineRoutes);
router.use("/s/:schoolSlug/api/health",      ...schoolApi, healthRoutes);
router.use("/s/:schoolSlug/api/library",     ...schoolApi, libraryRoutes);
router.use("/s/:schoolSlug/api/inventory",   ...schoolApi, inventoryRoutes);
router.use("/s/:schoolSlug/api/transport",   ...schoolApi, transportRoutes);
router.use("/s/:schoolSlug/api/boarding",    ...schoolApi, boardingRoutes);
router.use("/s/:schoolSlug/api/messaging",   ...schoolApi, messagingRoutes);
router.use("/s/:schoolSlug/api/reports",     ...schoolApi, reportsRoutes);
router.use("/s/:schoolSlug/api/portal",      resolveTenant, portalRoutes);
router.use("/s/:schoolSlug/api/settings",    ...schoolApi, settingsRoutes);
router.use("/s/:schoolSlug/api/dashboard",   ...schoolApi, dashboardRoutes);
router.use("/s/:schoolSlug/api/saas",        ...schoolApi, saasRoutes);

export default router;
