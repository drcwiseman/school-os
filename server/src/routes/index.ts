import { Router } from "express";
import { resolveTenant } from "../middleware/tenant";
import { blockWriteIfImpersonationReadOnly } from "../middleware/auth";
import { requireTenantFeature } from "../middleware/require-feature";
import { API_ROUTE_FEATURES } from "../lib/feature-module-map";
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

function featureGuard(routeKey: string) {
  const code = API_ROUTE_FEATURES[routeKey];
  return code ? [requireTenantFeature(code)] : [];
}

router.use("/s/:schoolSlug/api/auth",       ...schoolApi, authRoutes);
router.use("/s/:schoolSlug/api/admin",      ...schoolApi, tenantRoutes);
router.use("/s/:schoolSlug/api/dashboard",   ...schoolApi, dashboardRoutes);
router.use("/s/:schoolSlug/api/settings",    ...schoolApi, settingsRoutes);
router.use("/s/:schoolSlug/api/students",   ...schoolApi, ...featureGuard("students"), studentRoutes);
router.use("/s/:schoolSlug/api/admissions", ...schoolApi, ...featureGuard("admissions"), admissionsRouter);
router.use("/s/:schoolSlug/api/attendance", ...schoolApi, ...featureGuard("attendance"), attendanceRouter);
router.use("/s/:schoolSlug/api/academics",   ...schoolApi, ...featureGuard("academics"), academicsRoutes);
router.use("/s/:schoolSlug/api/finance",     ...schoolApi, ...featureGuard("finance"), financeRoutes);
router.use("/s/:schoolSlug/api/exams",       ...schoolApi, ...featureGuard("exams"), examsRoutes);
router.use("/s/:schoolSlug/api/hr",          ...schoolApi, ...featureGuard("hr"), hrRoutes);
router.use("/s/:schoolSlug/api/payroll",     ...schoolApi, ...featureGuard("payroll"), payrollRoutes);
router.use("/s/:schoolSlug/api/discipline",  ...schoolApi, ...featureGuard("discipline"), disciplineRoutes);
router.use("/s/:schoolSlug/api/health",      ...schoolApi, ...featureGuard("health"), healthRoutes);
router.use("/s/:schoolSlug/api/library",     ...schoolApi, ...featureGuard("library"), libraryRoutes);
router.use("/s/:schoolSlug/api/inventory",   ...schoolApi, ...featureGuard("inventory"), inventoryRoutes);
router.use("/s/:schoolSlug/api/transport",   ...schoolApi, ...featureGuard("transport"), transportRoutes);
router.use("/s/:schoolSlug/api/boarding",    ...schoolApi, ...featureGuard("boarding"), boardingRoutes);
router.use("/s/:schoolSlug/api/messaging",   ...schoolApi, ...featureGuard("messaging"), messagingRoutes);
router.use("/s/:schoolSlug/api/reports",     ...schoolApi, ...featureGuard("reports"), reportsRoutes);
router.use("/s/:schoolSlug/api/portal",      resolveTenant, requireTenantFeature("portal_enabled"), portalRoutes);
router.use("/s/:schoolSlug/api/saas",        ...schoolApi, saasRoutes);

export default router;
