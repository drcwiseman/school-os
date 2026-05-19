import { Router } from "express";
import { resolveTenant } from "../middleware/tenant";
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

router.use("/s/:schoolSlug/api/auth",       resolveTenant, authRoutes);
router.use("/s/:schoolSlug/api/admin",      resolveTenant, tenantRoutes);
router.use("/s/:schoolSlug/api/students",   resolveTenant, studentRoutes);
router.use("/s/:schoolSlug/api/admissions", resolveTenant, admissionsRouter);
router.use("/s/:schoolSlug/api/attendance", resolveTenant, attendanceRouter);
router.use("/s/:schoolSlug/api/academics",   resolveTenant, academicsRoutes);
router.use("/s/:schoolSlug/api/finance",     resolveTenant, financeRoutes);
router.use("/s/:schoolSlug/api/exams",       resolveTenant, examsRoutes);
router.use("/s/:schoolSlug/api/hr",          resolveTenant, hrRoutes);
router.use("/s/:schoolSlug/api/payroll",     resolveTenant, payrollRoutes);
router.use("/s/:schoolSlug/api/discipline",  resolveTenant, disciplineRoutes);
router.use("/s/:schoolSlug/api/health",      resolveTenant, healthRoutes);
router.use("/s/:schoolSlug/api/library",     resolveTenant, libraryRoutes);
router.use("/s/:schoolSlug/api/inventory",   resolveTenant, inventoryRoutes);
router.use("/s/:schoolSlug/api/transport",   resolveTenant, transportRoutes);
router.use("/s/:schoolSlug/api/boarding",    resolveTenant, boardingRoutes);
router.use("/s/:schoolSlug/api/messaging",   resolveTenant, messagingRoutes);
router.use("/s/:schoolSlug/api/reports",     resolveTenant, reportsRoutes);
router.use("/s/:schoolSlug/api/portal",      resolveTenant, portalRoutes);
router.use("/s/:schoolSlug/api/settings",    resolveTenant, settingsRoutes);
router.use("/s/:schoolSlug/api/dashboard",   resolveTenant, dashboardRoutes);

export default router;
