import { Router } from "express";
import { resolveTenant } from "../middleware/tenant";
import { blockWriteIfImpersonationReadOnly } from "../middleware/auth";
import { requireTenantFeature } from "../middleware/require-feature";
import { API_ROUTE_FEATURES } from "../lib/feature-module-map";
import authRoutes     from "./auth";
import tenantRoutes   from "./tenant";
import studentRoutes  from "./students";
import parentsRoutes from "./parents";
import platformRoutes from "./platform";
import { admissionsRouter } from "./admissions";
import { attendanceRouter } from "./attendance";
import academicsRoutes from "./academics";
import financeRoutes from "./finance";
import examsRoutes from "./exams";
import curriculumRoutes from "./curriculum";
import cbtRoutes from "./cbt";
import campusesRoutes from "./campuses";
import securityRoutes from "./security";
import searchRoutes from "./search";
import hrRoutes from "./hr";
import payrollRoutes from "./payroll";
import disciplineRoutes from "./discipline";
import healthRoutes from "./health";
import libraryRoutes from "./library";
import inventoryRoutes from "./inventory";
import transportRoutes from "./transport";
import boardingRoutes from "./boarding";
import messagingRoutes from "./messaging";
import eventsRoutes from "./events";
import reportsRoutes from "./reports";
import portalRoutes from "./portal";
import settingsRoutes from "./settings";
import dashboardRoutes from "./dashboard";
import aiAdminRoutes from "./ai-admin";
import helpRoutes from "./help";
import tenantPublicRoutes from "./tenant-public";
import teacherRoutes from "./teacher";
import publicRoutes from "./public";
import saasRoutes from "./saas-features";
import webhooksRoutes from "./webhooks";

const router = Router();

// Public marketing (no auth)
router.use("/api/public", publicRoutes);

// Inbound provider webhooks (no session auth — verify per provider)
router.use("/api/webhooks", webhooksRoutes);

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
router.use("/s/:schoolSlug/api/ai-admin",    ...schoolApi, aiAdminRoutes);
router.use("/s/:schoolSlug/api/help",        ...schoolApi, helpRoutes);
router.use("/s/:schoolSlug/api/public",      resolveTenant, tenantPublicRoutes);
router.use("/s/:schoolSlug/api/settings",    ...schoolApi, settingsRoutes);
router.use("/s/:schoolSlug/api/students",   ...schoolApi, ...featureGuard("students"), studentRoutes);
router.use("/s/:schoolSlug/api/parents",   ...schoolApi, ...featureGuard("students"), parentsRoutes);
router.use("/s/:schoolSlug/api/admissions", ...schoolApi, ...featureGuard("admissions"), admissionsRouter);
router.use("/s/:schoolSlug/api/attendance", ...schoolApi, ...featureGuard("attendance"), attendanceRouter);
router.use("/s/:schoolSlug/api/academics",   ...schoolApi, ...featureGuard("academics"), academicsRoutes);
router.use("/s/:schoolSlug/api/teacher",     ...schoolApi, ...featureGuard("academics"), teacherRoutes);
router.use("/s/:schoolSlug/api/finance",     ...schoolApi, ...featureGuard("finance"), financeRoutes);
router.use("/s/:schoolSlug/api/exams",       ...schoolApi, ...featureGuard("exams"), examsRoutes);
router.use("/s/:schoolSlug/api/curriculum", ...schoolApi, ...featureGuard("academics"), curriculumRoutes);
router.use("/s/:schoolSlug/api/cbt",        ...schoolApi, ...featureGuard("exams"), cbtRoutes);
router.use("/s/:schoolSlug/api/campuses",   ...schoolApi, campusesRoutes);
router.use("/s/:schoolSlug/api/security",   ...schoolApi, securityRoutes);
router.use("/s/:schoolSlug/api/search",     ...schoolApi, searchRoutes);
router.use("/s/:schoolSlug/api/hr",          ...schoolApi, ...featureGuard("hr"), hrRoutes);
router.use("/s/:schoolSlug/api/payroll",     ...schoolApi, ...featureGuard("payroll"), payrollRoutes);
router.use("/s/:schoolSlug/api/discipline",  ...schoolApi, ...featureGuard("discipline"), disciplineRoutes);
router.use("/s/:schoolSlug/api/health",      ...schoolApi, ...featureGuard("health"), healthRoutes);
router.use("/s/:schoolSlug/api/library",     ...schoolApi, ...featureGuard("library"), libraryRoutes);
router.use("/s/:schoolSlug/api/inventory",   ...schoolApi, ...featureGuard("inventory"), inventoryRoutes);
router.use("/s/:schoolSlug/api/transport",   ...schoolApi, ...featureGuard("transport"), transportRoutes);
router.use("/s/:schoolSlug/api/boarding",    ...schoolApi, ...featureGuard("boarding"), boardingRoutes);
router.use("/s/:schoolSlug/api/messaging",   ...schoolApi, ...featureGuard("messaging"), messagingRoutes);
router.use("/s/:schoolSlug/api/events",      ...schoolApi, ...featureGuard("messaging"), eventsRoutes);
router.use("/s/:schoolSlug/api/reports",     ...schoolApi, ...featureGuard("reports"), reportsRoutes);
router.use("/s/:schoolSlug/api/portal",      resolveTenant, requireTenantFeature("portal_enabled"), portalRoutes);
router.use("/s/:schoolSlug/api/saas",        ...schoolApi, saasRoutes);

export default router;
